from datetime import datetime
from bson import ObjectId
from config.database import db

class User:
    VALID_ROLES = ['student', 'instructor', 'admin']

    def __init__(self):
        self.collection = db.get_db()['users']
    
    def create_user(self, user_data):
        user_data['created_at'] = datetime.utcnow()
        user_data['updated_at'] = datetime.utcnow()
        user_data['last_active_at'] = datetime.utcnow()
        
        # Validate role (student, instructor, admin)
        role = user_data.get('role', 'student')
        if role not in self.VALID_ROLES:
            raise ValueError(f"Invalid role: '{role}'. Must be one of {self.VALID_ROLES}")
        user_data['role'] = role

        # Initialize default risk fields for students
        if role == 'student':
            if 'risk_badge' not in user_data:
                user_data['risk_badge'] = 'Low'
            if 'risk_score' not in user_data:
                user_data['risk_score'] = 0.0
                
        result = self.collection.insert_one(user_data)
        return str(result.inserted_id)
    
    def find_by_email(self, email):
        return self.collection.find_one({'email': email})
    
    def find_by_id(self, user_id):
        if not user_id:
            return None
        q_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
        return self.collection.find_one({'_id': q_id})
    
    def update_user(self, user_id, update_data):
        update_data['updated_at'] = datetime.utcnow()
        if 'role' in update_data and update_data['role'] not in self.VALID_ROLES:
            raise ValueError(f"Invalid role: '{update_data['role']}'. Must be one of {self.VALID_ROLES}")
        q_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
        result = self.collection.update_one(
            {'_id': q_id},
            {'$set': update_data}
        )
        return result.modified_count > 0
    
    def get_all_students(self):
        return list(self.collection.find({'role': 'student'}, {'password': 0}))
    
    def get_student_count(self):
        return self.collection.count_documents({'role': 'student'})
    
    def get_all_instructors(self):
        return list(self.collection.find({'role': 'instructor'}, {'password': 0}))
    
    def get_instructor_count(self):
        return self.collection.count_documents({'role': 'instructor'})
    
    def get_users_by_role(self, role):
        if role not in self.VALID_ROLES:
            raise ValueError(f"Invalid role: '{role}'. Must be one of {self.VALID_ROLES}")
        return list(self.collection.find({'role': role}, {'password': 0}))
    
    def delete_user(self, user_id):
        q_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
        result = self.collection.delete_one({'_id': q_id})
        return result.deleted_count > 0
