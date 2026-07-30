from config.database import db
from bson.objectid import ObjectId

class ModuleModel:
    def __init__(self):
        self.collection = db.get_collection('modules')

    def create_module(self, course_id: str, title: str, description: str = '', order: int = 0):
        module = {
            'course_id': ObjectId(course_id),
            'title': title,
            'description': description,
            'order': order
        }
        result = self.collection.insert_one(module)
        module['_id'] = result.inserted_id
        return module

    def get_modules_by_course(self, course_id: str):
        return list(self.collection.find({'course_id': ObjectId(course_id)}).sort('order', 1))

    def get_module(self, module_id: str):
        return self.collection.find_one({'_id': ObjectId(module_id)})

    def update_module(self, module_id: str, data: dict):
        update_data = {k: v for k, v in data.items() if k in ['title', 'description', 'order']}
        self.collection.update_one({'_id': ObjectId(module_id)}, {'$set': update_data})
        return self.get_module(module_id)

    def delete_module(self, module_id: str):
        # Cascade delete related media, quizzes, assignments
        from .media import MediaModel
        from .quiz import QuizModel
        from .assignment import AssignmentModel
        MediaModel().delete_media_by_module(module_id)
        QuizModel().delete_quiz_by_module(module_id)
        AssignmentModel().delete_assignment_by_module(module_id)
        return self.collection.delete_one({'_id': ObjectId(module_id)})

    def move_module(self, module_id: str, direction: str):
        # direction: 'up' or 'down'
        module = self.get_module(module_id)
        if not module:
            return None
        current_order = module.get('order', 0)
        query = {'course_id': module['course_id']}
        if direction == 'up':
            adjacent = self.collection.find_one({**query, 'order': {'$lt': current_order}}, sort=[('order', -1)])
        else:
            adjacent = self.collection.find_one({**query, 'order': {'$gt': current_order}}, sort=[('order', 1)])
        if not adjacent:
            return module
        self.collection.update_one({'_id': module['_id']}, {'$set': {'order': adjacent['order']}})
        self.collection.update_one({'_id': adjacent['_id']}, {'$set': {'order': current_order}})
        return self.get_modules_by_course(str(module['course_id']))
