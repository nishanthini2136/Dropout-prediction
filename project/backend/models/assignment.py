from config.database import db
from bson.objectid import ObjectId
from datetime import datetime

class AssignmentModel:
    def __init__(self):
        self.collection = db.get_collection('assignments')

    def create_assignment(self, course_id: str, module_id: str, title: str, description: str = '', due_date: str = None, max_score: int = 100):
        assignment = {
            'course_id': ObjectId(course_id),
            'module_id': ObjectId(module_id),
            'title': title,
            'description': description,
            'due_date': datetime.fromisoformat(due_date) if due_date else None,
            'max_score': max_score,
            'created_at': datetime.utcnow()
        }
        result = self.collection.insert_one(assignment)
        assignment['_id'] = result.inserted_id
        return assignment

    def get_assignment(self, assignment_id: str):
        return self.collection.find_one({'_id': ObjectId(assignment_id)})

    def get_assignments_by_module(self, module_id: str):
        # Try ObjectId lookup first
        try:
            return list(self.collection.find({'module_id': ObjectId(module_id)}))
        except:
            # If that fails, try direct lookup (for integer/string module IDs)
            return list(self.collection.find({'module_id': module_id}))

    def update_assignment(self, assignment_id: str, data: dict):
        allowed = {'title', 'description', 'due_date', 'max_score'}
        update_data = {}
        for k, v in data.items():
            if k not in allowed:
                continue
            if k == 'due_date' and v:
                update_data[k] = datetime.fromisoformat(v)
            else:
                update_data[k] = v
        if update_data:
            self.collection.update_one({'_id': ObjectId(assignment_id)}, {'$set': update_data})
        return self.get_assignment(assignment_id)

    def delete_assignment(self, assignment_id: str):
        return self.collection.delete_one({'_id': ObjectId(assignment_id)})

    def delete_assignment_by_module(self, module_id: str):
        # Try ObjectId lookup first
        try:
            return self.collection.delete_many({'module_id': ObjectId(module_id)})
        except:
            # If that fails, try direct lookup (for integer/string module IDs)
            return self.collection.delete_many({'module_id': module_id})
