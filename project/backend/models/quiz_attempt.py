from config.database import db
from bson.objectid import ObjectId
from datetime import datetime

class QuizAttemptModel:
    def __init__(self):
        self.collection = db.get_collection('quiz_attempts')

    def record_attempt(self, quiz_id: str, student_id: str, answers: list, score: float, max_score: float):
        attempt = {
            'quiz_id': ObjectId(quiz_id),
            'student_id': ObjectId(student_id),
            'answers': answers,
            'score': score,
            'max_score': max_score,
            'timestamp': datetime.utcnow()
        }
        result = self.collection.insert_one(attempt)
        attempt['_id'] = result.inserted_id
        return attempt

    def get_attempts_by_student(self, student_id: str):
        return list(self.collection.find({'student_id': ObjectId(student_id)}))
