from datetime import datetime
from bson import ObjectId
from config.database import db

class RoadmapModel:
    def __init__(self):
        self.collection = db.get_collection('roadmaps')

    def create_or_update_roadmap(self, student_id: str, week_num: int, tasks: list):
        # tasks = [{'day': 'Monday', 'task_desc': '...', 'status': 'Not Started', 'rationale': '...'}]
        roadmap = {
            'student_id': ObjectId(student_id) if ObjectId.is_valid(student_id) else str(student_id),
            'week_num': week_num,
            'tasks': tasks,
            'updated_at': datetime.utcnow()
        }
        
        existing = self.get_roadmap(student_id, week_num)
        
        if existing:
            self.collection.update_one({'_id': existing['_id']}, {'$set': roadmap})
            return str(existing['_id'])
        else:
            roadmap['created_at'] = datetime.utcnow()
            result = self.collection.insert_one(roadmap)
            return str(result.inserted_id)

    def get_roadmap(self, student_id: str, week_num: int):
        return self.collection.find_one({
            'student_id': ObjectId(student_id) if ObjectId.is_valid(student_id) else str(student_id),
            'week_num': week_num
        })
        
    def update_task_status(self, student_id: str, week_num: int, task_index: int, new_status: str):
        roadmap = self.get_roadmap(student_id, week_num)
        if roadmap and task_index < len(roadmap['tasks']):
            roadmap['tasks'][task_index]['status'] = new_status
            self.collection.update_one(
                {'_id': roadmap['_id']},
                {'$set': {'tasks': roadmap['tasks'], 'updated_at': datetime.utcnow()}}
            )
            return True
        return False
