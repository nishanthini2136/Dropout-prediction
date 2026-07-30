from config.database import db

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

