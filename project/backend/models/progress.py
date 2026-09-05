from config.database import db
from datetime import datetime
from bson import ObjectId

class ProgressModel:
    def __init__(self):
        self.collection = db.get_db()['progress']

    def _get_module_videos(self, module_id: str, course_id: str = None):
        """Helper to find all video lessons in a module."""
        try:
            courses_col = db.get_db()['courses']
            courses_to_search = []
            if course_id:
                try:
                    c = courses_col.find_one({'_id': ObjectId(course_id)})
                    if c:
                        courses_to_search.append(c)
                except Exception:
                    pass
                if not courses_to_search:
                    c = courses_col.find_one({'_id': str(course_id)})
                    if c:
                        courses_to_search.append(c)
            if not courses_to_search:
                courses_to_search = list(courses_col.find())

            for course in courses_to_search:
                for mod in course.get('modules', []):
                    mod_id = str(mod.get('_id') if mod.get('_id') is not None else mod.get('id', ''))
                    if mod_id == str(module_id) or (str(module_id).isdigit() and str(mod.get('id')) == str(module_id)):
                        lessons = mod.get('lessons') or mod.get('resources') or []
                        video_ids = []
                        for l in lessons:
                            if not isinstance(l, dict):
                                continue
                            is_vid = l.get('type') == 'video' or (isinstance(l.get('url'), str) and ('youtube.com' in l['url'] or 'youtu.be' in l['url'] or l['url'].endswith('.mp4') or l['url'].endswith('.webm') or '/static/uploads/' in l['url']))
                            if is_vid:
                                lid = str(l.get('id') if l.get('id') is not None else (l.get('_id') if l.get('_id') is not None else l.get('title', '')))
                                if lid:
                                    video_ids.append(lid)
                        return video_ids
        except Exception as e:
            print(f"[ProgressModel] Error finding module videos: {e}")
        return []

    def set_video_watched(self, user_id: str, module_id: str, lesson_id: str = None, course_id: str = None):
        filter_query = {'user_id': str(user_id), 'module_id': str(module_id)}
        if course_id:
            filter_query['course_id'] = str(course_id)
        
        record = self.collection.find_one(filter_query) or {}
        watched_lessons = set(record.get('watched_lessons', []))
        if lesson_id:
            watched_lessons.add(str(lesson_id))

        # Check all required video lessons for this module
        required_video_ids = self._get_module_videos(module_id, course_id=course_id)
        
        # If specific video lessons exist, mark video_watched True ONLY when all videos are completed
        if required_video_ids:
            all_watched = all(v_id in watched_lessons for v_id in required_video_ids)
        else:
            all_watched = True

        update = {
            '$set': {
                'user_id': str(user_id),
                'module_id': str(module_id),
                'watched_lessons': list(watched_lessons),
                'video_watched': all_watched,
                'updated_at': datetime.utcnow()
            }
        }
        if course_id:
            update['$set']['course_id'] = str(course_id)
            
        self.collection.update_one(filter_query, update, upsert=True)
        return self.collection.find_one(filter_query, {'_id': 0})

    def is_video_watched(self, user_id: str, module_id: str, course_id: str = None) -> bool:
        required_video_ids = self._get_module_videos(module_id, course_id=course_id)
        
        # 1. Check enrollment completed lessons first
        if course_id:
            try:
                enrollments_col = db.get_db()['enrollments']
                try:
                    c_oid = ObjectId(course_id)
                except Exception:
                    c_oid = course_id
                try:
                    u_oid = ObjectId(user_id)
                except Exception:
                    u_oid = user_id
                
                enrollment = enrollments_col.find_one({
                    '$or': [
                        {'user_id': u_oid, 'course_id': c_oid},
                        {'user_id': str(user_id), 'course_id': str(course_id)},
                        {'user_id': u_oid, 'course_id': str(course_id)},
                        {'user_id': str(user_id), 'course_id': c_oid}
                    ]
                })
                if enrollment:
                    completed_lessons = set(enrollment.get('completed_lessons', []))
                    if required_video_ids:
                        all_in_enrollment = all(
                            f"{module_id}:{v_id}" in completed_lessons or 
                            f"{str(module_id)}:{v_id}" in completed_lessons
                            for v_id in required_video_ids
                        )
                        if all_in_enrollment:
                            return True
            except Exception as e:
                print(f"[ProgressModel] Enrollment check error: {e}")

        # 2. Check progress collection
        filter_query = {'user_id': str(user_id), 'module_id': str(module_id)}
        if course_id:
            filter_query['course_id'] = str(course_id)
        record = self.collection.find_one(filter_query)
        if not record and course_id:
            record = self.collection.find_one({'user_id': str(user_id), 'module_id': str(module_id)})
        
        if not record:
            return len(required_video_ids) == 0

        watched_lessons = set(record.get('watched_lessons', []))
        if required_video_ids:
            return all(v_id in watched_lessons for v_id in required_video_ids)
            
        return bool(record.get('video_watched'))

    def set_quiz_completed(self, user_id: str, module_id: str, score: int, total: int, answers: dict = None, course_id: str = None):
        filter_query = {'user_id': str(user_id), 'module_id': str(module_id)}
        if course_id:
            filter_query['course_id'] = str(course_id)
            
        update = {
            '$set': {
                'user_id': str(user_id),
                'module_id': str(module_id),
                'quiz_completed': True,
                'score': score,
                'total': total,
                'percentage': int((score / total * 100)) if total > 0 else 0,
                'answers': answers or {},
                'completed_at': datetime.utcnow()
            }
        }
        # Always store course_id if provided
        if course_id:
            update['$set']['course_id'] = str(course_id)
            
        self.collection.update_one(filter_query, update, upsert=True)
        return self.collection.find_one(filter_query, {'_id': 0})

    def is_quiz_completed(self, user_id: str, module_id: str, course_id: str = None) -> bool:
        filter_query = {'user_id': str(user_id), 'module_id': str(module_id)}
        if course_id:
            filter_query['course_id'] = str(course_id)
        record = self.collection.find_one(filter_query)
        if not record and course_id:
            record = self.collection.find_one({'user_id': str(user_id), 'module_id': str(module_id)})
        return bool(record and record.get('quiz_completed'))

    def get_user_module_progress(self, user_id: str, module_id: str, course_id: str = None, requesting_user_id: str = None, requesting_role: str = None):
        from middleware.rbac import check_student_data_access
        check_student_data_access(requesting_user_id, requesting_role, user_id, course_id)

        filter_query = {'user_id': str(user_id), 'module_id': str(module_id)}
        if course_id:
            filter_query['course_id'] = str(course_id)
        record = self.collection.find_one(filter_query)
        if not record:
            return {'video_watched': False, 'quiz_completed': False}
        return {
            'video_watched': bool(record.get('video_watched')),
            'quiz_completed': bool(record.get('quiz_completed')),
            'score': record.get('score', 0),
            'total': record.get('total', 0),
            'percentage': record.get('percentage', 0)
        }

    def get_all_user_progress(self, user_id: str, course_id: str = None, requesting_user_id: str = None, requesting_role: str = None):
        from middleware.rbac import check_student_data_access
        check_student_data_access(requesting_user_id, requesting_role, user_id, course_id)

        query = {'user_id': str(user_id)}
        if course_id:
            query['course_id'] = str(course_id)
            
        records = list(self.collection.find(query))
        res = {}
        for r in records:
            mod_id = str(r.get('module_id'))
            quiz_done = bool(r.get('quiz_completed'))
            vid_done = bool(r.get('video_watched'))
            res[mod_id] = {
                'module_id': mod_id,
                'video_watched': vid_done,
                'quiz_completed': quiz_done,
                'module_completed': quiz_done or vid_done,
                'watched_lessons': list(r.get('watched_lessons', [])),
                'score': r.get('score', 0),
                'total': r.get('total', 0)
            }
        return res

