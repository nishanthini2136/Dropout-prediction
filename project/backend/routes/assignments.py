from flask import Blueprint, jsonify, request
from utils.auth import token_required, admin_required
from models.assignment import AssignmentModel
from models.submission import SubmissionModel

assignments_bp = Blueprint('assignments', __name__, url_prefix='/api/assignments')

@assignments_bp.route('/course/<course_id>', methods=['GET'])
@token_required
def get_course_assignments(course_id):
    try:
        from datetime import datetime
        assignments = AssignmentModel().get_assignments_by_course(course_id)
        for a in assignments:
            a['_id'] = str(a['_id'])
            a['course_id'] = str(a.get('course_id', ''))
            if isinstance(a.get('due_date'), datetime):
                a['due_date'] = a['due_date'].isoformat()
            if isinstance(a.get('created_at'), datetime):
                a['created_at'] = a['created_at'].isoformat()
            if isinstance(a.get('updated_at'), datetime):
                a['updated_at'] = a['updated_at'].isoformat()
        return jsonify(assignments), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@assignments_bp.route('/', methods=['POST'])
@admin_required
def create_assignment():
    try:
        data = request.get_json()
        course_id = data.get('course_id')
        title = data.get('title')
        description = data.get('description')
        due_date = data.get('due_date') # ISO string
        weight = data.get('weight', 10.0)
        
        # Simple date parsing fallback
        import dateutil.parser
        dt = dateutil.parser.isoparse(due_date) if due_date else None

        assignment = AssignmentModel().create_assignment(course_id, title, description, dt, weight)
        assignment['_id'] = str(assignment['_id'])
        return jsonify(assignment), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@assignments_bp.route('/<assignment_id>/submit', methods=['POST'])
@token_required
def submit_assignment(assignment_id):
    try:
        user_id = request.current_user_id
        data = request.get_json()
        course_id = data.get('course_id')
        text_content = data.get('text_content')
        file_path = data.get('file_path')

        submission_id = SubmissionModel().create_submission(assignment_id, user_id, course_id, file_path, text_content)
        
        # trigger engagement log
        from models.engagement import EngagementModel
        EngagementModel().log_event(user_id, course_id, str(assignment_id), 'submit_assignment')
        
        return jsonify({'message': 'Submission successful', 'submission_id': submission_id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@assignments_bp.route('/<assignment_id>/submissions', methods=['GET'])
@admin_required
def get_submissions(assignment_id):
    try:
        from datetime import datetime
        from config.database import db
        from bson import ObjectId
        
        submissions = SubmissionModel().get_submissions_by_assignment(assignment_id)
        
        user_ids = []
        for s in submissions:
            uid = s.get('student_id') or s.get('user_id')
            if uid:
                if ObjectId.is_valid(str(uid)):
                    user_ids.append(ObjectId(str(uid)))
                user_ids.append(str(uid))
                
        users = list(db.get_db()['users'].find({'_id': {'$in': user_ids}}, {'name': 1, 'email': 1}))
        users_map = {str(u['_id']): u for u in users}
        
        for s in submissions:
            s['_id'] = str(s['_id'])
            s['assignment_id'] = str(s.get('assignment_id', ''))
            s['course_id'] = str(s.get('course_id', ''))
            uid = str(s.get('student_id') or s.get('user_id') or '')
            s['student_id'] = uid
            user_info = users_map.get(uid, {})
            s['student_name'] = user_info.get('name', 'Student')
            s['student_email'] = user_info.get('email', '')
            if isinstance(s.get('submitted_at'), datetime):
                s['submitted_at'] = s['submitted_at'].isoformat()
            if isinstance(s.get('graded_at'), datetime):
                s['graded_at'] = s['graded_at'].isoformat()
        return jsonify(submissions), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@assignments_bp.route('/submission/<submission_id>/grade', methods=['POST'])
@admin_required
def grade_submission(submission_id):
    try:
        data = request.get_json()
        grade = data.get('grade')
        feedback = data.get('feedback')
        
        success = SubmissionModel().grade_submission(submission_id, grade, feedback)
        if success:
            return jsonify({'message': 'Graded successfully'}), 200
        return jsonify({'error': 'Submission not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500
