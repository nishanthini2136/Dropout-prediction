from datetime import datetime
from bson import ObjectId
from config.database import db

class Course:
    def __init__(self):
        self.collection = db.get_db()['courses']
    
    def create_course(self, course_data):
        course_data['created_at'] = datetime.utcnow()
        course_data['updated_at'] = datetime.utcnow()
        if 'is_active' in course_data:
            if isinstance(course_data['is_active'], str):
                course_data['is_active'] = course_data['is_active'].lower() == 'true'
        else:
            course_data['is_active'] = True
        result = self.collection.insert_one(course_data)
        return str(result.inserted_id)
    
    def find_by_id(self, course_id):
        return self.collection.find_one({'_id': ObjectId(course_id)})
    
    def get_all_courses(self, active_only=True):
        if active_only:
            return list(self.collection.find({'is_active': True}))
        return list(self.collection.find())
    
    def update_course(self, course_id, update_data):
        update_data['updated_at'] = datetime.utcnow()
        result = self.collection.update_one(
            {'_id': ObjectId(course_id)},
            {'$set': update_data}
        )
        return result.modified_count > 0
    
    def delete_course(self, course_id):
        result = self.collection.delete_one({'_id': ObjectId(course_id)})
        return result.deleted_count > 0
    
    def get_course_count(self):
        return self.collection.count_documents({'is_active': True})
    
    def search_courses(self, search_term=None, category=None, difficulty=None):
        query = {'is_active': True}
        
        if search_term:
            query['$or'] = [
                {'title': {'$regex': search_term, '$options': 'i'}},
                {'description': {'$regex': search_term, '$options': 'i'}}
            ]
        
        if category:
            query['category'] = category
        
        if difficulty:
            query['difficulty'] = difficulty
        
        return list(self.collection.find(query))
