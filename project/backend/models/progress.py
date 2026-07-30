from config.database import db
from datetime import datetime

class ProgressModel:
    def __init__(self):
        self.collection = db.get_db()['progress']

    def set_video_watched(self, user_id: str, module_id: str):
        # Store as plain strings so both ObjectId-format and integer-format IDs work
        filter_query = {'user_id': str(user_id), 'module_id': str(module_id)}
        update = {'$set': {'video_watched': True}}
        self.collection.update_one(filter_query, update, upsert=True)
        return self.collection.find_one(filter_query, {'_id': 0})

    def is_video_watched(self, user_id: str, module_id: str) -> bool:
        record = self.collection.find_one({'user_id': str(user_id), 'module_id': str(module_id)})
        return bool(record and record.get('video_watched'))

    def set_quiz_completed(self, user_id: str, module_id: str, score: int, total: int, answers: dict = None):
        filter_query = {'user_id': str(user_id), 'module_id': str(module_id)}
        update = {
            '$set': {
                'quiz_completed': True,
                'score': score,
                'total': total,
                'percentage': int((score / total * 100)) if total > 0 else 0,
                'answers': answers or {},
                'completed_at': datetime.utcnow()
            }
        }
        self.collection.update_one(filter_query, update, upsert=True)
        return self.collection.find_one(filter_query, {'_id': 0})

    def is_quiz_completed(self, user_id: str, module_id: str) -> bool:
        record = self.collection.find_one({'user_id': str(user_id), 'module_id': str(module_id)})
        return bool(record and record.get('quiz_completed'))

    def get_user_module_progress(self, user_id: str, module_id: str):
        record = self.collection.find_one({'user_id': str(user_id), 'module_id': str(module_id)})
        if not record:
            return {'video_watched': False, 'quiz_completed': False}
        return {
            'video_watched': bool(record.get('video_watched')),
            'quiz_completed': bool(record.get('quiz_completed')),
            'score': record.get('score', 0),
            'total': record.get('total', 0),
            'percentage': record.get('percentage', 0)
        }

    def get_all_user_progress(self, user_id: str):
        records = list(self.collection.find({'user_id': str(user_id)}))
        res = {}
        for r in records:
            res[str(r.get('module_id'))] = {
                'video_watched': bool(r.get('video_watched')),
                'quiz_completed': bool(r.get('quiz_completed')),
                'score': r.get('score', 0),
                'total': r.get('total', 0)
            }
        return res


