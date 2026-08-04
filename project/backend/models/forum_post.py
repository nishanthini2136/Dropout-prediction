from datetime import datetime
from bson import ObjectId
from config.database import db

class ForumPostModel:
    def __init__(self):
        self.collection = db.get_collection('forum_posts')

    def create_thread(self, course_id: str, author_id: str, author_name: str, title: str, content: str):
        thread = {
            'course_id': ObjectId(course_id) if ObjectId.is_valid(course_id) else str(course_id),
            'author_id': ObjectId(author_id) if ObjectId.is_valid(author_id) else str(author_id),
            'author_name': author_name,
            'title': title,
            'content': content,
            'replies': [],
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        result = self.collection.insert_one(thread)
        thread['_id'] = result.inserted_id
        return thread

    def get_thread(self, thread_id: str):
        return self.collection.find_one({'_id': ObjectId(thread_id) if ObjectId.is_valid(thread_id) else str(thread_id)})

    def get_threads_by_course(self, course_id: str):
        return list(self.collection.find({
            'course_id': ObjectId(course_id) if ObjectId.is_valid(course_id) else str(course_id)
        }).sort('updated_at', -1))

    def add_reply(self, thread_id: str, author_id: str, author_name: str, content: str):
        reply = {
            'reply_id': ObjectId(),
            'author_id': ObjectId(author_id) if ObjectId.is_valid(author_id) else str(author_id),
            'author_name': author_name,
            'content': content,
            'created_at': datetime.utcnow()
        }
        
        result = self.collection.update_one(
            {'_id': ObjectId(thread_id) if ObjectId.is_valid(thread_id) else str(thread_id)},
            {
                '$push': {'replies': reply},
                '$set': {'updated_at': datetime.utcnow()}
            }
        )
        return result.modified_count > 0
