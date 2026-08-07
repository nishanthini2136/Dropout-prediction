from datetime import datetime
from bson import ObjectId
from config.database import db

class RoadmapModel:
    def __init__(self):
        self.collection = db.get_collection('roadmaps')

    def create_or_update_roadmap(self, student_id: str, week_num: int, tasks: list, course_id: str = None):
        s_id = ObjectId(student_id) if ObjectId.is_valid(student_id) else str(student_id)
        c_id = ObjectId(course_id) if course_id and ObjectId.is_valid(course_id) else str(course_id) if course_id else None
        
        roadmap = {
            'student_id': s_id,
            'course_id': c_id,
            'week_num': week_num,
            'tasks': tasks,
            'updated_at': datetime.utcnow()
        }
        
        existing = self.get_roadmap(student_id, week_num, course_id)
        
        if existing:
            self.collection.update_one({'_id': existing['_id']}, {'$set': roadmap})
            return str(existing['_id'])
        else:
            roadmap['created_at'] = datetime.utcnow()
            result = self.collection.insert_one(roadmap)
            return str(result.inserted_id)

    def get_roadmap(self, student_id: str, week_num: int, course_id: str = None):
        s_id = ObjectId(student_id) if ObjectId.is_valid(student_id) else str(student_id)
        query = {'student_id': s_id, 'week_num': week_num}
        if course_id:
            c_id = ObjectId(course_id) if ObjectId.is_valid(course_id) else str(course_id)
            query['course_id'] = c_id
        return self.collection.find_one(query)
        
    def update_task_status(self, student_id: str, week_num: int, task_index: int, new_status: str, course_id: str = None):
        roadmap = self.get_roadmap(student_id, week_num, course_id)
        if roadmap and task_index < len(roadmap['tasks']):
            roadmap['tasks'][task_index]['status'] = new_status
            self.collection.update_one(
                {'_id': roadmap['_id']},
                {'$set': {'tasks': roadmap['tasks'], 'updated_at': datetime.utcnow()}}
            )
            return True
        return False

    def generate_personalized_roadmap(self, student_id: str, course_id: str = None, week_num: int = 1):
        s_id = ObjectId(student_id) if ObjectId.is_valid(student_id) else str(student_id)
        
        # Look up per-course prediction if course_id provided
        risk_level = 'Medium'
        course_title = "Enrolled Course"
        
        if course_id:
            c_id = ObjectId(course_id) if ObjectId.is_valid(course_id) else str(course_id)
            pred = db.get_collection('predictions').find_one({'student_id': s_id, 'course_id': c_id})
            if pred:
                risk_level = pred.get('risk_level', 'Medium')
            course_doc = db.get_collection('courses').find_one({'_id': c_id})
            if course_doc:
                course_title = course_doc.get('title', 'Enrolled Course')
        else:
            user_doc = db.get_collection('users').find_one({'_id': s_id})
            if user_doc:
                risk_level = user_doc.get('risk_badge', 'Medium')
        
        if risk_level == 'High':
            tasks = [
                {'day': 'Monday', 'task_desc': f'Watch Module 1 & 2 video lessons for {course_title}', 'status': 'Not Started', 'rationale': 'Urgent catch-up needed'},
                {'day': 'Wednesday', 'task_desc': f'Complete Module 1 assessment quiz for {course_title}', 'status': 'Not Started', 'rationale': 'Assess baseline comprehension'},
                {'day': 'Friday', 'task_desc': f'Submit pending assignment for {course_title}', 'status': 'Not Started', 'rationale': 'Improve assignment completion rate'},
                {'day': 'Saturday', 'task_desc': 'Review study notes and participate in discussion forum', 'status': 'Not Started', 'rationale': 'Increase active engagement'}
            ]
        elif risk_level == 'Medium':
            tasks = [
                {'day': 'Monday', 'task_desc': f'Review upcoming module topics in {course_title}', 'status': 'Not Started', 'rationale': 'Build consistent study habit'},
                {'day': 'Wednesday', 'task_desc': f'Watch module lecture and complete practice quiz for {course_title}', 'status': 'Not Started', 'rationale': 'Reinforce core concepts'},
                {'day': 'Friday', 'task_desc': f'Work on practical coding assignment for {course_title}', 'status': 'Not Started', 'rationale': 'Apply knowledge practically'},
                {'day': 'Sunday', 'task_desc': 'Check weekly progress on student dashboard', 'status': 'Not Started', 'rationale': 'Monitor risk trend'}
            ]
        else:
            tasks = [
                {'day': 'Tuesday', 'task_desc': f'Advance through advanced modules in {course_title}', 'status': 'Not Started', 'rationale': 'Maintain strong momentum'},
                {'day': 'Thursday', 'task_desc': f'Attempt bonus challenge quiz for {course_title}', 'status': 'Not Started', 'rationale': 'Deepen subject mastery'},
                {'day': 'Saturday', 'task_desc': 'Explore recommended courses in catalog', 'status': 'Completed', 'rationale': 'Expand learning portfolio'}
            ]
            
        self.create_or_update_roadmap(student_id, week_num, tasks, course_id)
        return self.get_roadmap(student_id, week_num, course_id)
