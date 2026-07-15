from datetime import datetime
from bson import ObjectId
from config.database import db

class User:
    def __init__(self):
        self.collection = db.get_db()['users']
    
    def create_user(self, user_data):
        user_data['created_at'] = datetime.utcnow()
        user_data['updated_at'] = datetime.utcnow()
        result = self.collection.insert_one(user_data)
        return str(result.inserted_id)
    
    def find_by_email(self, email):
        return self.collection.find_one({'email': email})
    
    def find_by_id(self, user_id):
        return self.collection.find_one({'_id': ObjectId(user_id)})
    
    def update_user(self, user_id, update_data):
        update_data['updated_at'] = datetime.utcnow()
        result = self.collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': update_data}
        )
        return result.modified_count > 0
    
    def get_all_students(self):
        return list(self.collection.find({'role': 'student'}))
    
    def get_student_count(self):
        return self.collection.count_documents({'role': 'student'})
    
    def delete_user(self, user_id):
        result = self.collection.delete_one({'_id': ObjectId(user_id)})
        return result.deleted_count > 0
