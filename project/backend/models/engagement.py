from datetime import datetime
from bson import ObjectId
from config.database import db

class EngagementModel:
    def __init__(self):
        self.collection = db.get_collection('engagement_logs')

    def log_event(self, student_id: str, course_id: str, module_id: str, event_type: str, duration: int = 0):
        # event_type can be 'play', 'pause', 'complete', 'login'
        log = {
            'student_id': ObjectId(student_id) if ObjectId.is_valid(student_id) else str(student_id),
            'course_id': ObjectId(course_id) if course_id and ObjectId.is_valid(course_id) else str(course_id) if course_id else None,
            'module_id': ObjectId(module_id) if module_id and ObjectId.is_valid(module_id) else str(module_id) if module_id else None,
            'event_type': event_type,
            'duration': duration,
            'timestamp': datetime.utcnow()
        }
        result = self.collection.insert_one(log)
        return str(result.inserted_id)

    def get_logs_by_student(self, student_id: str):
        return list(self.collection.find({
            'student_id': ObjectId(student_id) if ObjectId.is_valid(student_id) else str(student_id)
        }).sort('timestamp', -1))
