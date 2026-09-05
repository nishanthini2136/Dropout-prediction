from flask import Blueprint, request, jsonify
from datetime import datetime
from bson import ObjectId
from config.database import db
from models.course import Course
from models.submission import SubmissionModel
from models.assignment import AssignmentModel
from middleware.rbac import requires_role, requires_ownership

instructor_bp = Blueprint('instructor', __name__, url_prefix='/api/instructor')

def _serialize_doc(doc):
    """Helper to convert ObjectIds and datetime objects to JSON-serializable strings."""
    if not doc:
        return doc
    if isinstance(doc, list):
        return [_serialize_doc(item) for item in doc]
    if isinstance(doc, dict):
        res = {}
        for k, v in doc.items():
            if isinstance(v, ObjectId):
                res[k] = str(v)
            elif isinstance(v, datetime):
                res[k] = v.isoformat()
            elif isinstance(v, (dict, list)):
                res[k] = _serialize_doc(v)
            else:
                res[k] = v
        return res
    return doc


@instructor_bp.route('/courses', methods=['POST'])
@requires_role('instructor', 'admin')
def create_course():
    """
    Create a new course as draft.
    Auto-injects instructor_id from authenticated user and forces initial status to 'draft'.
    """
    try:
        import json
        if request.is_json:
            data = request.get_json() or {}
        else:
            data = request.form.to_dict()
            for json_field in ['modules', 'completionCriteria', 'learningConfig', 'discussionTopics', 'learning_outcomes', 'syllabus', 'prerequisites']:
                if json_field in data:
                    try:
                        data[json_field] = json.loads(data[json_field])
                    except Exception:
                        pass
        
        from routes.courses import process_course_files
        process_course_files(request.files, data)
        
        # Validate required title
        title = data.get('title', '').strip()
        if not title:
            return jsonify({'error': 'Course title is required'}), 400

        # Auto-set instructor_id from authenticated user token, never trust request body
        user_id = request.current_user_id
        course_data = {
            'title': title,
            'description': data.get('description', '').strip(),
            'category': data.get('category', 'Programming'),
            'difficulty': data.get('difficulty', 'Beginner'),
            'credits': float(data.get('credits', 30.0)),
            'capacity': int(data.get('capacity', 50)),
            'is_active': data.get('is_active', True),
            'thumbnail': data.get('thumbnail', ''),
            'learning_outcomes': data.get('learning_outcomes', []),
            'modules': data.get('modules', []),
            'completionCriteria': data.get('completionCriteria', {}),
            'learningConfig': data.get('learningConfig', {}),
            'discussionTopics': data.get('discussionTopics', []),
            'syllabus_pdf': data.get('syllabus_pdf'),
            'reference_materials_pdf': data.get('reference_materials_pdf'),
            'practice_exercises_pdf': data.get('practice_exercises_pdf'),
            'studyMaterials': data.get('studyMaterials', []),
            'course_video_url': data.get('course_video_url', ''),
            'youtube_url': data.get('youtube_url', ''),
            'instructor_id': ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id,
            'status': 'draft',
            'reviewed_by': None,
            'rejection_reason': None
        }

        course_model = Course()
        course_id = course_model.create_course(course_data)
        
        created_course = course_model.find_by_id(course_id)
        return jsonify({
            'message': 'Course created successfully as draft',
            'course': _serialize_doc(created_course)
        }), 201

    except Exception as e:
        return jsonify({'error': f'Failed to create course: {str(e)}'}), 500


@instructor_bp.route('/courses', methods=['GET'])
@requires_role('instructor', 'admin')
def get_instructor_courses():
    """
    List all courses owned by the authenticated instructor with live enrollment metrics.
    """
    try:
        user_id = request.current_user_id
        course_model = Course()
        
        # If admin passed instructor_id query param, respect it; otherwise filter by current user
        target_instructor_id = user_id
        if request.current_user_role == 'admin' and request.args.get('instructor_id'):
            target_instructor_id = request.args.get('instructor_id')
            
        courses = course_model.get_courses_by_instructor(target_instructor_id)
        
        # Attach enrollment counts to each course
        database = db.get_db()
        for course in courses:
            c_id = course['_id']
            enroll_query = {
                'course_id': {'$in': [c_id, str(c_id), ObjectId(str(c_id)) if ObjectId.is_valid(str(c_id)) else str(c_id)]}
            }
            course['enrollment_count'] = database['enrollments'].count_documents(enroll_query)
            course['completed_count'] = database['enrollments'].count_documents({
                **enroll_query,
                '$or': [{'progress': 100}, {'status': 'completed'}]
            })

        return jsonify({
            'courses': _serialize_doc(courses),
            'total_courses': len(courses)
        }), 200

    except Exception as e:
        return jsonify({'error': f'Failed to retrieve courses: {str(e)}'}), 500


@instructor_bp.route('/courses/<id>', methods=['GET'])
@requires_role('instructor', 'admin')
@requires_ownership(Course, id_param='id', owner_field='instructor_id')
def get_course_detail(id):
    """
    Retrieve single course details (accessible only by course owner or admin).
    """
    try:
        course = getattr(request, 'resource', None) or Course().find_by_id(id)
        if not course:
            return jsonify({'error': 'Course not found'}), 404
        return jsonify({'course': _serialize_doc(course)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@instructor_bp.route('/courses/<id>', methods=['PUT'])
@requires_role('instructor', 'admin')
@requires_ownership(Course, id_param='id', owner_field='instructor_id')
def update_course(id):
    """
    Update course details.
    Ensures instructor cannot bypass ownership or force 'published' status directly.
    """
    try:
        course = getattr(request, 'resource', None) or Course().find_by_id(id)
        if not course:
            return jsonify({'error': 'Course not found'}), 404

        import json
        if request.is_json:
            data = request.get_json() or {}
        else:
            data = request.form.to_dict()
            for json_field in ['modules', 'completionCriteria', 'learningConfig', 'discussionTopics', 'learning_outcomes', 'syllabus', 'prerequisites']:
                if json_field in data:
                    try:
                        data[json_field] = json.loads(data[json_field])
                    except Exception:
                        pass

        from routes.courses import process_course_files
        process_course_files(request.files, data, course)
        
        # Disallow changing instructor_id or forging review fields
        disallowed_keys = ['_id', 'instructor_id', 'reviewed_by']
        update_data = {k: v for k, v in data.items() if k not in disallowed_keys}

        # If instructor tries to set status directly to published, block it
        if 'status' in update_data and update_data['status'] == 'published' and request.current_user_role != 'admin':
            return jsonify({'error': 'Instructors cannot publish courses directly. Please submit for admin review.'}), 403

        # If a rejected course is modified, keep it as draft or allow re-submission
        if course.get('status') == 'rejected' and 'status' not in update_data:
            update_data['status'] = 'draft'

        course_model = Course()
        success = course_model.update_course(id, update_data)
        
        if not success:
            return jsonify({'error': 'Failed to update course or no changes made'}), 400

        updated_course = course_model.find_by_id(id)
        return jsonify({
            'message': 'Course updated successfully',
            'course': _serialize_doc(updated_course)
        }), 200

    except Exception as e:
        return jsonify({'error': f'Failed to update course: {str(e)}'}), 500


@instructor_bp.route('/courses/<id>/submit', methods=['POST'])
@requires_role('instructor', 'admin')
@requires_ownership(Course, id_param='id', owner_field='instructor_id')
def submit_course_for_review(id):
    """
    Transition course from 'draft' or 'rejected' to 'pending_review'.
    """
    try:
        course = getattr(request, 'resource', None) or Course().find_by_id(id)
        if not course:
            return jsonify({'error': 'Course not found'}), 404

        current_status = course.get('status', 'draft')
        if current_status not in ['draft', 'rejected']:
            return jsonify({
                'error': f"Cannot submit course for review. Current status is '{current_status}'. Only 'draft' or 'rejected' courses can be submitted."
            }), 400

        # Validate that course has at least a title and 1 module
        modules = course.get('modules', [])
        if not modules:
            return jsonify({'error': 'Course must have at least one module before submitting for review.'}), 400

        course_model = Course()
        course_model.update_status(id, 'pending_review')

        return jsonify({
            'message': 'Course submitted for admin review successfully',
            'course_id': str(id),
            'status': 'pending_review'
        }), 200

    except Exception as e:
        return jsonify({'error': f'Failed to submit course: {str(e)}'}), 500


@instructor_bp.route('/students/<course_id>', methods=['GET'])
@requires_role('instructor', 'admin')
@requires_ownership(Course, id_param='course_id', owner_field='instructor_id')
def get_enrolled_students(course_id):
    """
    View all enrolled students and their live progress/risk metrics for a course owned by this instructor.
    """
    try:
        course = getattr(request, 'resource', None) or Course().find_by_id(course_id)
        if not course:
            return jsonify({'error': 'Course not found'}), 404

        database = db.get_db()
        c_oid = ObjectId(course_id) if ObjectId.is_valid(course_id) else course_id
        
        # Find enrollments
        enroll_query = {'course_id': {'$in': [c_oid, str(course_id)]}}
        enrollments = list(database['enrollments'].find(enroll_query))
        
        student_ids = []
        for e in enrollments:
            uid = e.get('student_id') or e.get('user_id')
            if uid:
                if ObjectId.is_valid(str(uid)):
                    student_ids.append(ObjectId(str(uid)))
                student_ids.append(str(uid))
                
        # Batch fetch student profiles
        users = list(database['users'].find({'_id': {'$in': student_ids}}, {'password': 0}))
        users_map = {str(u['_id']): u for u in users}
        
        # Batch fetch predictions for this course
        pred_query = {'course_id': {'$in': [c_oid, str(course_id)]}}
        predictions = list(database['predictions'].find(pred_query))
        pred_map = {str(p.get('student_id')): p for p in predictions}

        student_list = []
        for e in enrollments:
            uid_str = str(e.get('student_id') or e.get('user_id') or '')
            user_info = users_map.get(uid_str, {})
            pred_info = pred_map.get(uid_str, {})
            
            student_list.append({
                'enrollment_id': str(e['_id']),
                'student_id': uid_str,
                'name': user_info.get('name', 'Student'),
                'email': user_info.get('email', ''),
                'enrolled_at': e.get('enrolled_at') or e.get('created_at'),
                'progress': e.get('progress', 0),
                'completed_lessons': len(e.get('completed_lessons', [])),
                'status': e.get('status', 'enrolled'),
                'risk_level': pred_info.get('risk_level', user_info.get('risk_badge', 'Low')),
                'risk_probability': pred_info.get('risk_probability', user_info.get('risk_score', 0.0) / 100.0 if user_info.get('risk_score') else 0.0),
                'last_active_at': user_info.get('last_active_at') or e.get('updated_at')
            })

        return jsonify({
            'course_id': str(course_id),
            'course_title': course.get('title'),
            'total_students': len(student_list),
            'students': _serialize_doc(student_list)
        }), 200

    except Exception as e:
        return jsonify({'error': f'Failed to retrieve enrolled students: {str(e)}'}), 500


@instructor_bp.route('/grade/<submission_id>', methods=['POST'])
@requires_role('instructor', 'admin')
def grade_submission(submission_id):
    """
    Grade an assignment submission.
    Enforces that the assignment belongs to a course owned by the authenticated instructor.
    """
    try:
        database = db.get_db()
        sub_oid = ObjectId(submission_id) if ObjectId.is_valid(submission_id) else submission_id
        submission = database['submissions'].find_one({'_id': sub_oid})
        
        if not submission:
            return jsonify({'error': 'Submission not found'}), 404

        # Verify course ownership
        course_id = submission.get('course_id')
        if not course_id:
            # Look up via assignment
            assign_id = submission.get('assignment_id')
            if assign_id:
                assign = database['assignments'].find_one({'_id': ObjectId(assign_id) if ObjectId.is_valid(assign_id) else assign_id})
                if assign:
                    course_id = assign.get('course_id')

        if not course_id:
            return jsonify({'error': 'Could not resolve course for this submission'}), 400

        c_oid = ObjectId(course_id) if ObjectId.is_valid(course_id) else course_id
        course = database['courses'].find_one({'_id': c_oid})
        
        if not course:
            return jsonify({'error': 'Course not found'}), 404

        # Check ownership unless admin
        if request.current_user_role != 'admin':
            course_owner = course.get('instructor_id')
            if not course_owner or str(course_owner) != str(request.current_user_id):
                return jsonify({'error': 'Forbidden: You can only grade submissions for your own courses'}), 403

        data = request.get_json() or {}
        if 'grade' not in data:
            return jsonify({'error': 'Grade is required'}), 400

        grade = float(data.get('grade'))
        feedback = data.get('feedback', '')

        success = SubmissionModel().grade_submission(submission_id, grade, feedback)
        if not success:
            return jsonify({'error': 'Failed to save grade'}), 500

        return jsonify({
            'message': 'Submission graded successfully',
            'submission_id': str(submission_id),
            'grade': grade,
            'feedback': feedback
        }), 200

    except Exception as e:
        return jsonify({'error': f'Failed to grade submission: {str(e)}'}), 500


@instructor_bp.route('/earnings', methods=['GET'])
@requires_role('instructor', 'admin')
def get_instructor_earnings():
    """
    Returns analytics, student enrollments, and estimated earnings for courses owned by this instructor.
    """
    try:
        user_id = request.current_user_id
        target_instructor_id = user_id
        if request.current_user_role == 'admin' and request.args.get('instructor_id'):
            target_instructor_id = request.args.get('instructor_id')

        course_model = Course()
        courses = course_model.get_courses_by_instructor(target_instructor_id)
        
        database = db.get_db()
        course_ids = [c['_id'] for c in courses]
        
        # Course status breakdown
        status_counts = {'draft': 0, 'pending_review': 0, 'published': 0, 'rejected': 0, 'archived': 0}
        for c in courses:
            st = c.get('status', 'draft')
            status_counts[st] = status_counts.get(st, 0) + 1

        # Calculate enrollment metrics
        enroll_query = {'course_id': {'$in': course_ids + [str(cid) for cid in course_ids]}}
        total_enrollments = database['enrollments'].count_documents(enroll_query)
        completed_enrollments = database['enrollments'].count_documents({
            **enroll_query,
            '$or': [{'progress': 100}, {'status': 'completed'}]
        })

        # Base estimated revenue calculation ($49.99 per enrollment with 80% instructor split)
        PRICE_PER_COURSE = 49.99
        INSTRUCTOR_REV_SHARE = 0.80
        estimated_revenue = round(total_enrollments * PRICE_PER_COURSE * INSTRUCTOR_REV_SHARE, 2)
        
        return jsonify({
            'instructor_id': str(target_instructor_id),
            'total_courses': len(courses),
            'course_breakdown': status_counts,
            'total_enrollments': total_enrollments,
            'completed_students': completed_enrollments,
            'completion_rate_pct': round((completed_enrollments / total_enrollments * 100), 1) if total_enrollments > 0 else 0.0,
            'estimated_earnings_usd': estimated_revenue,
            'revenue_share_pct': int(INSTRUCTOR_REV_SHARE * 100),
            'generated_at': datetime.utcnow().isoformat()
        }), 200

    except Exception as e:
        return jsonify({'error': f'Failed to calculate earnings: {str(e)}'}), 500
