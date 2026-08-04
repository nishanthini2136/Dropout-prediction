from datetime import datetime
from bson import ObjectId
from config.database import db

class AssignmentModel:
    def __init__(self):
        self.collection = db.get_collection('assignments')

    def create_assignment(self, course_id: str, title: str, description: str, due_date: datetime, weight: float = 10.0, max_score: float = 100.0):
        assignment = {
            'course_id': ObjectId(course_id) if ObjectId.is_valid(course_id) else str(course_id),
            'title': title,
            'description': description,
            'due_date': due_date,
            'weight': weight,
            'max_score': max_score,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        result = self.collection.insert_one(assignment)
        assignment['_id'] = result.inserted_id
        return assignment

    def get_assignment(self, assignment_id: str):
        return self.collection.find_one({'_id': ObjectId(assignment_id) if ObjectId.is_valid(assignment_id) else assignment_id})

    def get_assignments_by_course(self, course_id: str):
        return list(self.collection.find({
            'course_id': ObjectId(course_id) if ObjectId.is_valid(course_id) else str(course_id)
        }))
