from config.database import db
from bson.objectid import ObjectId
from datetime import datetime

class QuizAttemptModel:
    def __init__(self):
        self.collection = db.get_collection('quiz_attempts')

    def record_attempt(self, quiz_id: str, student_id: str, answers: list, score: float, max_score: float, course_id: str = None, weight: float = 10.0):
        # Calculate attempt number
        existing_attempts = self.collection.count_documents({
            'quiz_id': ObjectId(quiz_id) if ObjectId.is_valid(quiz_id) else quiz_id,
            'student_id': ObjectId(student_id) if ObjectId.is_valid(student_id) else student_id
        })
        attempt_number = existing_attempts + 1
        
        attempt = {
            'quiz_id': ObjectId(quiz_id) if ObjectId.is_valid(quiz_id) else str(quiz_id),
            'student_id': ObjectId(student_id) if ObjectId.is_valid(student_id) else str(student_id),
            'course_id': ObjectId(course_id) if course_id and ObjectId.is_valid(course_id) else str(course_id) if course_id else None,
            'answers': answers,
            'score': score,
            'max_score': max_score,
            'weight': weight,
            'attempt_number': attempt_number,
            'timestamp': datetime.utcnow()
        }
        result = self.collection.insert_one(attempt)
        attempt['_id'] = result.inserted_id
        return attempt

    def get_attempts_by_student(self, student_id: str):
        return list(self.collection.find({'student_id': ObjectId(student_id)}))
