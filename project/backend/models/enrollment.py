from datetime import datetime
from bson import ObjectId
from config.database import db

class Enrollment:
    def __init__(self):
        self.collection = db.get_db()['enrollments']
    
    def enroll_student(self, enrollment_data):
        enrollment_data['enrolled_at'] = datetime.utcnow()
        enrollment_data['updated_at'] = datetime.utcnow()
        enrollment_data['progress'] = 0
        result = self.collection.insert_one(enrollment_data)
        return str(result.inserted_id)
    
    def find_by_student_and_course(self, student_id, course_id):
        return self.collection.find_one({
            'student_id': ObjectId(student_id),
            'course_id': ObjectId(course_id)
        })
    
    def get_student_enrollments(self, student_id):
        enrollments = list(self.collection.find({'student_id': ObjectId(student_id)}))
        return enrollments
    
    def get_course_enrollments(self, course_id):
        enrollments = list(self.collection.find({'course_id': ObjectId(course_id)}))
        return enrollments
    
    def update_progress(self, enrollment_id, progress):
        result = self.collection.update_one(
            {'_id': ObjectId(enrollment_id)},
            {'$set': {'progress': progress, 'updated_at': datetime.utcnow()}}
        )
        return result.modified_count > 0
    
    def get_enrollment_count(self):
        return self.collection.count_documents({})
    
    def unenroll_student(self, enrollment_id):
        result = self.collection.delete_one({'_id': ObjectId(enrollment_id)})
        return result.deleted_count > 0

    def update_lesson_progress(self, enrollment_id, module_id, lesson_id, completed, total_lessons_count):
        # Store completed lessons as strings "module_id:lesson_id" in a list
        lesson_key = f"{module_id}:{lesson_id}"
        
        enrollment = self.collection.find_one({'_id': ObjectId(enrollment_id)})
        if not enrollment:
            return False
            
        completed_lessons = enrollment.get('completed_lessons', [])
        
        if completed:
            if lesson_key not in completed_lessons:
                completed_lessons.append(lesson_key)
        else:
            if lesson_key in completed_lessons:
                completed_lessons.remove(lesson_key)
                
        # Recalculate progress percentage
        progress = 0
        if total_lessons_count > 0:
            progress = int((len(completed_lessons) / total_lessons_count) * 100)
            progress = min(max(progress, 0), 100)
            
        result = self.collection.update_one(
            {'_id': ObjectId(enrollment_id)},
            {
                '$set': {
                    'completed_lessons': completed_lessons,
                    'progress': progress,
                    'updated_at': datetime.utcnow()
                }
            }
        )
        return True
