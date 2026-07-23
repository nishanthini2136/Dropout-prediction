from flask import Blueprint, request, jsonify
from models.user import User
from utils.auth import AuthUtils
from utils.notifier import stats_notifier

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/api/auth/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'email', 'password', 'role']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400
        
        # Validate role
        if data['role'] not in ['admin', 'student']:
            return jsonify({'error': 'Invalid role. Must be admin or student'}), 400
        
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
        data = request.get_json()
        
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
        
        # Generate token
        token = AuthUtils.generate_token(user['_id'], user['role'])
        
        return jsonify({
            'message': 'Login successful',
            'token': token,
            'user': {
                'id': str(user['_id']),
                'name': user['name'],
                'email': user['email'],
                'role': user['role']
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
                'name': user['name'],
                'email': user['email'],
                'role': user['role'],
                'phone': user.get('phone', ''),
                'bio': user.get('bio', '')
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
