import bcrypt
import jwt
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify
import os
from dotenv import load_dotenv

load_dotenv()

class AuthUtils:
    @staticmethod
    def hash_password(password):
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    
    @staticmethod
    def verify_password(password, hashed_password):
        return bcrypt.checkpw(password.encode('utf-8'), hashed_password)
    
    @staticmethod
    def generate_token(user_id, role):
        payload = {
            'user_id': str(user_id),
            'role': role,
            'exp': datetime.utcnow() + timedelta(hours=int(os.environ.get('JWT_ACCESS_TOKEN_EXPIRES', '3600')) // 3600)
        }
        return jwt.encode(payload, os.environ.get('JWT_SECRET_KEY', 'your-secret-key'), algorithm='HS256')
    
    @staticmethod
    def decode_token(token):
        try:
            payload = jwt.decode(token, os.environ.get('JWT_SECRET_KEY', 'your-secret-key'), algorithms=['HS256'])
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(' ')[1]
            except IndexError:
                return jsonify({'error': 'Token format invalid'}), 401
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        try:
            payload = AuthUtils.decode_token(token)
            if not payload:
                return jsonify({'error': 'Token is invalid or expired'}), 401
            
            request.current_user_id = payload['user_id']
            request.current_user_role = payload['role']
        except Exception as e:
            return jsonify({'error': str(e)}), 401
        
        return f(*args, **kwargs)
    
    return decorated

def admin_required(f):
    @token_required
    @wraps(f)
    def decorated(*args, **kwargs):
        if getattr(request, 'current_user_role', None) != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated

def student_required(f):
    @token_required
    @wraps(f)
    def decorated(*args, **kwargs):
        if getattr(request, 'current_user_role', None) != 'student':
            return jsonify({'error': 'Student access required'}), 403
        return f(*args, **kwargs)
    return decorated
