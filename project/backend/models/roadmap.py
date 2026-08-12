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
        student_match = {'$in': [ObjectId(student_id), str(student_id)]} if ObjectId.is_valid(student_id) else str(student_id)
        query = {'student_id': student_match, 'week_num': week_num}
        if course_id:
            course_match = {'$in': [ObjectId(course_id), str(course_id)]} if ObjectId.is_valid(course_id) else str(course_id)
            query['course_id'] = course_match
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
        s_match = {'$in': [s_id, ObjectId(s_id)]} if ObjectId.is_valid(student_id) else str(student_id)
        
        # Look up per-course prediction if course_id provided
        risk_level = 'Medium'
        course_title = "Enrolled Course"
        category = "Programming"
        modules = []
        
        if course_id:
            c_id = ObjectId(course_id) if ObjectId.is_valid(course_id) else str(course_id)
            pred = db.get_collection('predictions').find_one({'student_id': s_match, 'course_id': c_id})
            if pred:
                risk_level = pred.get('risk_level', 'Medium')
            course_doc = db.get_collection('courses').find_one({'_id': c_id})
            if course_doc:
                course_title = course_doc.get('title', 'Enrolled Course').strip()
                category = course_doc.get('category', 'Programming').strip()
                modules = course_doc.get('modules', [])
        else:
            user_doc = db.get_collection('users').find_one({'_id': s_match})
            if user_doc:
                risk_level = user_doc.get('risk_badge', 'Medium')

        # 1. Query student's actual module watch & quiz progress for this student
        watched_mod_ids = set()
        for p in db.get_collection('progress').find({'user_id': str(student_id)}):
            if p.get('video_watched'):
                watched_mod_ids.add(str(p.get('module_id')))
                
        unwatched_modules = []
        watched_modules = []
        
        for m in modules:
            m_id = str(m.get('_id') or m.get('id') or '')
            m_title = (m.get('title') or m.get('name') or 'Module').strip()
            if m_id in watched_mod_ids or (m.get('id') and str(m['id']) in watched_mod_ids):
                watched_modules.append(m_title)
            else:
                unwatched_modules.append(m_title)

        # 2. Query student's pending assignments for this course
        pending_assignments = []
        if course_id:
            c_oid = ObjectId(course_id) if ObjectId.is_valid(course_id) else course_id
            assigns = list(db.get_collection('assignments').find({'course_id': c_oid}))
            assign_ids = [a['_id'] for a in assigns]
            if assign_ids:
                subs = list(db.get_collection('submissions').find({'student_id': s_match, 'assignment_id': {'$in': assign_ids}}))
                submitted_assign_ids = {str(s['assignment_id']) for s in subs}
                pending_assignments = [a.get('title', 'Assignment') for a in assigns if str(a['_id']) not in submitted_assign_ids]

        tasks = []

        # Task 1: Video Learning (Prioritize Unwatched Module vs Advanced Review)
        if unwatched_modules:
            target_mod = unwatched_modules[0]
            tasks.append({
                'day': 'Monday',
                'task_desc': f'Watch video lesson: "{target_mod}"',
                'status': 'Not Started',
                'rationale': f'Next unwatched module in {course_title}'
            })
        elif watched_modules:
            target_mod = watched_modules[-1]
            tasks.append({
                'day': 'Monday',
                'task_desc': f'Review lesson notes: "{target_mod}"',
                'status': 'Not Started',
                'rationale': f'Consolidate understanding in {course_title}'
            })
        else:
            tasks.append({
                'day': 'Monday',
                'task_desc': f'Watch introductory video for {course_title}',
                'status': 'Not Started',
                'rationale': 'Start foundational module'
            })

        # Task 2: Quiz Assessment (Pending Knowledge Check vs Advanced Challenge)
        if unwatched_modules:
            target_mod = unwatched_modules[0]
            tasks.append({
                'day': 'Wednesday',
                'task_desc': f'Complete Knowledge Check Quiz for "{target_mod}"',
                'status': 'Not Started',
                'rationale': 'Validate comprehension after video'
            })
        elif watched_modules:
            target_mod = watched_modules[0]
            tasks.append({
                'day': 'Wednesday',
                'task_desc': f'Attempt Challenge Quiz for "{target_mod}"',
                'status': 'Not Started',
                'rationale': 'Deepen subject mastery'
            })
        else:
            tasks.append({
                'day': 'Wednesday',
                'task_desc': f'Complete Module 1 Quiz for {course_title}',
                'status': 'Not Started',
                'rationale': 'Assess baseline comprehension'
            })

        # Task 3: Assignment / Practical Coding
        if pending_assignments:
            next_assign = pending_assignments[0]
            tasks.append({
                'day': 'Friday',
                'task_desc': f'Submit assignment: "{next_assign}"',
                'status': 'Not Started',
                'rationale': 'Complete pending course assignment'
            })
        elif watched_modules and len(watched_modules) > 1:
            target_mod = watched_modules[1]
            tasks.append({
                'day': 'Friday',
                'task_desc': f'Complete practical exercise for "{target_mod}"',
                'status': 'Not Started',
                'rationale': 'Apply concepts practically'
            })
        else:
            tasks.append({
                'day': 'Friday',
                'task_desc': f'Work on practical exercises for {course_title}',
                'status': 'Not Started',
                'rationale': 'Hands-on practice'
            })

        # Task 4: Engagement & Portfolio
        if risk_level == 'High':
            tasks.append({
                'day': 'Saturday',
                'task_desc': f'Ask questions & participate in {course_title} discussion forum',
                'status': 'Not Started',
                'rationale': 'Urgent catch-up to reduce high dropout risk'
            })
        else:
            tasks.append({
                'day': 'Saturday',
                'task_desc': f'Explore related {category} projects & recommended courses',
                'status': 'Completed',
                'rationale': 'Expand learning portfolio'
            })

        self.create_or_update_roadmap(student_id, week_num, tasks, course_id)
        return self.get_roadmap(student_id, week_num, course_id)
