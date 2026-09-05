import time
from flask import Blueprint, request, jsonify
from models.user import User
from utils.auth import AuthUtils
from utils.notifier import stats_notifier

auth_bp = Blueprint('auth', __name__)

# IP-based in-memory rate limiter: {ip: [timestamp1, timestamp2, ...]}
_LOGIN_ATTEMPTS = {}
_RATE_LIMIT_WINDOW = 3 * 60  # 3 minutes
_RATE_LIMIT_MAX_ATTEMPTS = 5   # 5 attempts per window

def _is_rate_limited(ip_address):
    now = time.time()
    history = _LOGIN_ATTEMPTS.get(ip_address, [])
    # Retain only timestamps within the active 3-minute sliding window
    valid_history = [t for t in history if now - t < _RATE_LIMIT_WINDOW]
    _LOGIN_ATTEMPTS[ip_address] = valid_history
    if len(valid_history) >= _RATE_LIMIT_MAX_ATTEMPTS:
        return True
    return False

def _record_login_attempt(ip_address):
    now = time.time()
    history = _LOGIN_ATTEMPTS.setdefault(ip_address, [])
    history.append(now)

@auth_bp.route('/api/auth/register', methods=['POST'])
def register():
    try:
        data = request.get_json() or {}
        
        # Enforce Option B: Public self-registration is strictly for students
        requested_role = data.get('role', 'student')
        if requested_role != 'student':
            return jsonify({
                'error': 'Invalid role for self-registration. Public registration is restricted to students. Instructor accounts must be provisioned by an administrator.'
            }), 400
        data['role'] = 'student'
        
        # Check if user already exists
        user_model = User()
        existing_user = user_model.find_by_email(data['email'])
        if existing_user:
            return jsonify({'error': 'User with this email already exists'}), 400
        
        # Hash password
        hashed_password = AuthUtils.hash_password(data['password'])
        
        # Create user
        user_data = {
            'name': data['name'],
            'email': data['email'],
            'password': hashed_password,
            'role': data['role'],
            'phone': data.get('phone', ''),
            'bio': data.get('bio', '')
        }
        
        user_id = user_model.create_user(user_data)
        
        # Notify stats listeners of student registration
        if data.get('role') == 'student':
            stats_notifier.notify()
        
        return jsonify({
            'message': 'User registered successfully',
            'user_id': user_id
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    try:
        # Rate limiting check: 5 attempts per 3 minutes per client IP
        client_ip = request.headers.get('X-Forwarded-For', request.remote_addr or 'unknown').split(',')[0].strip()
        if _is_rate_limited(client_ip):
            return jsonify({
                'error': 'Too many login attempts. Please wait 3 minutes before trying again.'
            }), 429

        _record_login_attempt(client_ip)

        data = request.get_json() or {}
        
        # Validate required fields
        if 'email' not in data or 'password' not in data:
            return jsonify({'error': 'Email and password are required'}), 400
        
        # Find user
        user_model = User()
        user = user_model.find_by_email(data['email'])
        
        if not user:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Verify password
        if not AuthUtils.verify_password(data['password'], user['password']):
            return jsonify({'error': 'Invalid credentials'}), 401
            
        user_id_str = str(user['_id'])
            
        # Log login engagement in non-blocking manner for students
        if user.get('role') == 'student':
            from models.engagement import EngagementModel
            try:
                EngagementModel().log_event(
                    student_id=user_id_str,
                    course_id=None,
                    module_id=None,
                    event_type='login'
                )
            except Exception as e:
                print(f"[Auth] Failed to log login event: {e}")
        
        # Generate token
        token = AuthUtils.generate_token(user['_id'], user['role'])
        
        return jsonify({
            'message': 'Login successful',
            'token': token,
            'user': {
                'id': user_id_str,
                'name': user.get('name'),
                'email': user.get('email'),
                'role': user.get('role'),
                'risk_badge': user.get('risk_badge', 'Low'),
                'risk_score': user.get('risk_score', 0.0)
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/api/auth/me', methods=['GET'])
def get_current_user():
    try:
        from flask import request
        token = None
        
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(' ')[1]
            except IndexError:
                return jsonify({'error': 'Token format invalid'}), 401
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        payload = AuthUtils.decode_token(token)
        if not payload:
            return jsonify({'error': 'Token is invalid or expired'}), 401
        
        user_model = User()
        user = user_model.find_by_id(payload['user_id'])
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'user': {
                'id': str(user['_id']),
                'name': user.get('name'),
                'email': user.get('email'),
                'role': user.get('role'),
                'phone': user.get('phone', ''),
                'bio': user.get('bio', ''),
                'risk_badge': user.get('risk_badge'),
                'risk_score': user.get('risk_score')
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
