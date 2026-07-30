from config.database import db
from bson.objectid import ObjectId
from datetime import datetime

class QuizModel:
    def __init__(self):
        self.collection = db.get_db()['quizzes']


    def create_quiz(self, course_id: str, module_id: str, title: str, questions: list, shuffle: bool = False):
        # Handle both ObjectId and integer/string module_id
        try:
            module_id_obj = ObjectId(module_id)
        except:
            module_id_obj = module_id  # Keep as string/integer if not valid ObjectId
        
        quiz = {
            'course_id': ObjectId(course_id) if course_id else None,
            'module_id': module_id_obj,
            'title': title,
            'questions': questions,  # each question dict: {question, type, options?, answer}
            'shuffle': shuffle,
            'created_at': datetime.utcnow()
        }
        result = self.collection.insert_one(quiz)
        quiz['_id'] = result.inserted_id
        return quiz

    def get_quiz(self, quiz_id: str):
        return self.collection.find_one({'_id': ObjectId(quiz_id)})

    def get_quizzes_by_module(self, module_id: str):
        # Try ObjectId lookup first
        try:
            return list(self.collection.find({'module_id': ObjectId(module_id)}))
        except:
            # If that fails, try direct lookup (for integer/string module IDs)
            return list(self.collection.find({'module_id': module_id}))

    def update_quiz(self, quiz_id: str, data: dict):
        allowed = {'title', 'questions', 'shuffle'}
        update_data = {k: v for k, v in data.items() if k in allowed}
        self.collection.update_one({'_id': ObjectId(quiz_id)}, {'$set': update_data})
        return self.get_quiz(quiz_id)

    def delete_quiz(self, quiz_id: str):
        return self.collection.delete_one({'_id': ObjectId(quiz_id)})

    def delete_quiz_by_module(self, module_id: str):
        # Try ObjectId lookup first
        try:
            return self.collection.delete_many({'module_id': ObjectId(module_id)})
        except:
            # If that fails, try direct lookup (for integer/string module IDs)
            return self.collection.delete_many({'module_id': module_id})
