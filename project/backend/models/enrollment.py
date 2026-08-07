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
                
        # Recalculate progress percentage based on lessons
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

    def update_module_progress(self, enrollment_id, course_id):
        """Recalculate progress based on completed modules (video watched or quiz completed)"""
        from models.progress import ProgressModel
        
        enrollment = self.collection.find_one({'_id': ObjectId(enrollment_id)})
        if not enrollment:
            print(f"Enrollment {enrollment_id} not found")
            return False
        
        # Get course to count total modules
        from models.course import Course
        course_model = Course()
        course = course_model.find_by_id(course_id)
        if not course:
            print(f"Course {course_id} not found")
            return False
        
        modules = course.get('modules', [])
        total_modules = len(modules)
        print(f"Total modules in course: {total_modules}")
        if total_modules == 0:
            return False
        
        # Get student progress for all modules (try with and without course_id)
        progress_model = ProgressModel()
        student_id = str(enrollment['student_id'])
        print(f"Student ID: {student_id}")
        
        # Try to get progress with course_id first
        all_progress = progress_model.get_all_user_progress(student_id, course_id=str(course_id))
        print(f"Progress with course_id: {all_progress}")
        
        # If no progress found, try without course_id (for backward compatibility)
        if not all_progress:
            all_progress = progress_model.get_all_user_progress(student_id)
            print(f"Progress without course_id: {all_progress}")
        
        # Count completed modules (video watched OR quiz completed)
        completed_modules = 0
        for module in modules:
            # Get module ID - handle both integer and string IDs
            module_id = module.get('id', module.get('_id', ''))
            module_id_str = str(module_id)
            
            # Try to find progress with different ID formats
            module_progress = all_progress.get(module_id_str, {})
            
            # If not found with string ID, try with integer ID
            if not module_progress and isinstance(module_id, int):
                module_progress = all_progress.get(module_id, {})
            
            # If still not found, try looking for any matching module_id in progress
            if not module_progress:
                for progress_key, progress_data in all_progress.items():
                    if str(progress_key) == module_id_str:
                        module_progress = progress_data
                        break
            
            print(f"Module {module_id_str}: video_watched={module_progress.get('video_watched')}, quiz_completed={module_progress.get('quiz_completed')}")
            
            if module_progress.get('video_watched') or module_progress.get('quiz_completed'):
                completed_modules += 1
        
        print(f"Completed modules: {completed_modules}/{total_modules}")
        
        # Calculate progress percentage
        progress = int((completed_modules / total_modules) * 100)
        progress = min(max(progress, 0), 100)
        print(f"Calculated progress: {progress}%")
        
        # Update enrollment
        result = self.collection.update_one(
            {'_id': ObjectId(enrollment_id)},
            {
                '$set': {
                    'progress': progress,
                    'updated_at': datetime.utcnow()
                }
            }
        )
        print(f"Update result: modified_count={result.modified_count}")
        return result.modified_count > 0
