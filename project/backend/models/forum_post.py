from config.database import db
from bson.objectid import ObjectId
from datetime import datetime

class ForumPostModel:
    def __init__(self):
        self.collection = db.get_collection('forum_posts')

    def create_post(self, course_id: str, module_id: str, author_id: str, content: str, parent_post_id: str = None):
        post = {
            'course_id': ObjectId(course_id),
            'module_id': ObjectId(module_id),
            'author_id': ObjectId(author_id),
            'content': content,
            'parent_post_id': ObjectId(parent_post_id) if parent_post_id else None,
            'created_at': datetime.utcnow()
        }
        result = self.collection.insert_one(post)
        post['_id'] = result.inserted_id
        return post

    def get_posts_by_course_module(self, course_id: str, module_id: str):
        return list(self.collection.find({'course_id': ObjectId(course_id), 'module_id': ObjectId(module_id), 'parent_post_id': None}).sort('created_at', 1))

    def get_replies(self, parent_post_id: str):
        return list(self.collection.find({'parent_post_id': ObjectId(parent_post_id)}).sort('created_at', 1))

    def delete_post(self, post_id: str):
        # Delete post and its replies (single level only)
        self.collection.delete_many({'parent_post_id': ObjectId(post_id)})
        return self.collection.delete_one({'_id': ObjectId(post_id)})
