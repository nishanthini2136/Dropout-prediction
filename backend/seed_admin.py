from models.user import User
from utils.auth import AuthUtils
from config.database import db

def seed_admin():
    """Create a predefined admin account"""
    db.connect()
    
    user_model = User()
    
    # Check if admin already exists
    existing_admin = user_model.find_by_email("admin@elearning.com")
    if existing_admin:
        print("Admin account already exists!")
        return
    
    # Create admin account
    hashed_password = AuthUtils.hash_password("admin123")
    
    admin_data = {
        'name': 'System Administrator',
        'email': 'admin@elearning.com',
        'password': hashed_password,
        'role': 'admin',
        'phone': '',
        'bio': 'System administrator with full access to the platform'
    }
    
    admin_id = user_model.create_user(admin_data)
    print(f"Admin account created successfully! ID: {admin_id}")
    print("Email: admin@elearning.com")
    print("Password: admin123")

if __name__ == '__main__':
    seed_admin()
