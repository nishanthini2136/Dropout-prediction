from datetime import datetime
from bson import ObjectId
from config.database import db

class SubmissionModel:
    def __init__(self):
        self.collection = db.get_collection('submissions')

    def create_submission(self, assignment_id: str, student_id: str, course_id: str, file_path: str = None, text_content: str = None):
        submission = {
            'assignment_id': ObjectId(assignment_id) if ObjectId.is_valid(assignment_id) else str(assignment_id),
            'student_id': ObjectId(student_id) if ObjectId.is_valid(student_id) else str(student_id),
            'course_id': ObjectId(course_id) if ObjectId.is_valid(course_id) else str(course_id),
            'file_path': file_path,
            'text_content': text_content,
            'status': 'Submitted',
            'submitted_at': datetime.utcnow(),
            'grade': None,
            'feedback': None
        }
        
        # Check if previous submission exists
        existing = self.get_submission(assignment_id, student_id)
        if existing:
            self.collection.update_one({'_id': existing['_id']}, {'$set': submission})
            return str(existing['_id'])
            
        result = self.collection.insert_one(submission)
        return str(result.inserted_id)

    def get_submission(self, assignment_id: str, student_id: str):
        return self.collection.find_one({
            'assignment_id': ObjectId(assignment_id) if ObjectId.is_valid(assignment_id) else str(assignment_id),
            'student_id': ObjectId(student_id) if ObjectId.is_valid(student_id) else str(student_id)
        })

    def get_submissions_by_assignment(self, assignment_id: str):
        return list(self.collection.find({
            'assignment_id': ObjectId(assignment_id) if ObjectId.is_valid(assignment_id) else str(assignment_id)
        }))
        
    def get_submissions_by_student(self, student_id: str):
        return list(self.collection.find({
            'student_id': ObjectId(student_id) if ObjectId.is_valid(student_id) else str(student_id)
        }))

    def grade_submission(self, submission_id: str, grade: float, feedback: str = None):
        result = self.collection.update_one(
            {'_id': ObjectId(submission_id) if ObjectId.is_valid(submission_id) else str(submission_id)},
            {'$set': {
                'status': 'Graded',
                'grade': grade,
                'feedback': feedback,
                'graded_at': datetime.utcnow()
            }}
        )
        return result.modified_count > 0
