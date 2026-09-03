from flask import Blueprint, request, jsonify
from models.enrollment import Enrollment
from models.course import Course
from models.user import User
from utils.auth import token_required, student_required, admin_required
from utils.notifier import stats_notifier
from bson import ObjectId

enrollments_bp = Blueprint('enrollments', __name__)

@enrollments_bp.route('/api/enrollments', methods=['POST'])
@student_required
def enroll_in_course():
    try:
        data = request.get_json()
        
        if 'course_id' not in data:
            return jsonify({'error': 'Course ID is required'}), 400
        
        enrollment_model = Enrollment()
        course_model = Course()
        
        # Check if course exists and is active
        course = course_model.find_by_id(data['course_id'])
        if not course:
            return jsonify({'error': 'Course not found'}), 404
        
        if not course.get('is_active', True):
            return jsonify({'error': 'Course is not available for enrollment'}), 400
        
        # Check if already enrolled
        existing_enrollment = enrollment_model.find_by_student_and_course(
            request.current_user_id,
            data['course_id']
        )
        if existing_enrollment:
            return jsonify({'error': 'Already enrolled in this course'}), 400
        
        # Check seat capacity
        capacity = int(course.get('capacity', 30))
        enrolled_count = enrollment_model.collection.count_documents({'course_id': ObjectId(data['course_id'])})
        if enrolled_count >= capacity:
            return jsonify({'error': 'No seats available for this course'}), 400
        
        # Create enrollment
        enrollment_data = {
            'student_id': ObjectId(request.current_user_id),
            'course_id': ObjectId(data['course_id'])
        }
        
        enrollment_id = enrollment_model.enroll_student(enrollment_data)
        
        # Invalidate recommendation cache for student
        from services.recommendation_engine import RecommendationEngine
        RecommendationEngine.invalidate_cache(request.current_user_id)
        
        # Notify stats listeners of enrollment
        stats_notifier.notify()
        
        return jsonify({
            'message': 'Enrolled successfully',
            'enrollment_id': enrollment_id
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@enrollments_bp.route('/api/enrollments/my-courses', methods=['GET'])
@student_required
def get_my_enrollments():
    try:
        enrollment_model = Enrollment()
        course_model = Course()
        from config.database import db
        
        user_id = request.current_user_id
        enrollments = enrollment_model.get_student_enrollments(user_id)
        if not enrollments:
            return jsonify([]), 200

        # Batch query 1: Fetch all enrolled courses in 1 query
        course_ids = [e['course_id'] for e in enrollments if e.get('course_id')]
        c_matches = []
        for cid in course_ids:
            if ObjectId.is_valid(str(cid)):
                c_matches.append(ObjectId(str(cid)))
            c_matches.append(str(cid))

        courses = list(course_model.collection.find({'_id': {'$in': c_matches}}))
        courses_map = {}
        for c in courses:
            cid_str = str(c['_id'])
            c['_id'] = cid_str
            courses_map[cid_str] = c

        # Batch query 2: Fetch all predictions for this student in 1 query
        s_match = {'$in': [ObjectId(user_id), str(user_id)]} if ObjectId.is_valid(str(user_id)) else str(user_id)
        predictions = list(db.get_db()['predictions'].find({'student_id': s_match}))
        preds_map = {str(p.get('course_id')): p for p in predictions if p.get('course_id')}

        # Get fallback default prediction if any
        default_pred = next((p for p in predictions if not p.get('course_id')), None)
        
        my_courses = []
        for enrollment in enrollments:
            c_id_raw = enrollment.get('course_id')
            c_id_str = str(c_id_raw)
            course = courses_map.get(c_id_str)
            if course:
                enrollment['_id'] = str(enrollment['_id'])
                enrollment['course_id'] = course
                enrollment['student_id'] = str(enrollment.get('student_id', user_id))
                
                # Check for 100% completed course
                is_completed = enrollment.get('progress', 0) >= 100 or enrollment.get('status') == 'completed'
                enrollment['is_completed'] = is_completed

                pred = preds_map.get(c_id_str) or default_pred
                if is_completed:
                    enrollment['risk_badge'] = 'Low'
                    enrollment['risk_score'] = 0.0
                elif pred:
                    enrollment['risk_badge'] = pred.get('risk_level', 'Medium')
                    score_val = pred.get('risk_score')
                    if score_val is None:
                        score_val = pred.get('risk_probability', 0.5) * 100
                    enrollment['risk_score'] = float(score_val)
                else:
                    enrollment['risk_badge'] = 'Medium'
                    enrollment['risk_score'] = 50.0
                    
                my_courses.append(enrollment)
        
        return jsonify(my_courses), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@enrollments_bp.route('/api/enrollments/<enrollment_id>/progress', methods=['PUT'])
@student_required
def update_progress(enrollment_id):
    try:
        data = request.get_json()
        
        if 'progress' not in data:
            return jsonify({'error': 'Progress value is required'}), 400
        
        if not 0 <= data['progress'] <= 100:
            return jsonify({'error': 'Progress must be between 0 and 100'}), 400
        
        enrollment_model = Enrollment()
        updated = enrollment_model.update_progress(enrollment_id, data['progress'])
        
        if updated:
            return jsonify({'message': 'Progress updated successfully'}), 200
        else:
            return jsonify({'error': 'Failed to update progress'}), 500
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@enrollments_bp.route('/api/enrollments/<enrollment_id>/lesson-progress', methods=['PUT'])
@student_required
def update_lesson_progress(enrollment_id):
    try:
        data = request.get_json()
        
        required_fields = ['module_id', 'lesson_id', 'completed']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400
                
        enrollment_model = Enrollment()
        course_model = Course()
        
        enrollment = enrollment_model.collection.find_one({'_id': ObjectId(enrollment_id)})
        if not enrollment:
            return jsonify({'error': 'Enrollment not found'}), 404
            
        course = course_model.find_by_id(enrollment['course_id'])
        if not course:
            return jsonify({'error': 'Course not found'}), 404
            
        total_lessons = 0
        modules = course.get('modules', [])
        for m in modules:
            lessons = m.get('lessons') or m.get('resources') or []
            total_lessons += len(lessons)
            
        success = enrollment_model.update_lesson_progress(
            enrollment_id,
            data['module_id'],
            data['lesson_id'],
            data['completed'],
            total_lessons
        )
        
        if success:
            return jsonify({'message': 'Lesson progress updated successfully'}), 200
        else:
            return jsonify({'error': 'Failed to update lesson progress'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@enrollments_bp.route('/api/enrollments/<enrollment_id>/module-progress', methods=['PUT'])
@student_required
def update_module_progress(enrollment_id):
    """Recalculate progress based on completed modules (video watched or quiz completed)"""
    try:
        enrollment_model = Enrollment()
        course_model = Course()
        
        enrollment = enrollment_model.collection.find_one({'_id': ObjectId(enrollment_id)})
        if not enrollment:
            return jsonify({'error': 'Enrollment not found'}), 404
        
        print(f"Updating module progress for enrollment {enrollment_id}, course {enrollment['course_id']}")
            
        success = enrollment_model.update_module_progress(enrollment_id, enrollment['course_id'])
        
        if success:
            # Return the updated progress
            updated_enrollment = enrollment_model.collection.find_one({'_id': ObjectId(enrollment_id)})
            return jsonify({
                'message': 'Module progress updated successfully',
                'progress': updated_enrollment.get('progress', 0)
            }), 200
        else:
            return jsonify({'error': 'Failed to update module progress'}), 500
            
    except Exception as e:
        print(f"Error updating module progress: {str(e)}")
        return jsonify({'error': str(e)}), 500

@enrollments_bp.route('/api/enrollments/<enrollment_id>', methods=['DELETE'])
@student_required
def unenroll(enrollment_id):
    try:
        enrollment_model = Enrollment()
        deleted = enrollment_model.unenroll_student(enrollment_id)
        
        if deleted:
            from services.recommendation_engine import RecommendationEngine
            RecommendationEngine.invalidate_cache(request.current_user_id)
            stats_notifier.notify()
            return jsonify({'message': 'Unenrolled successfully'}), 200
        else:
            return jsonify({'error': 'Failed to unenroll'}), 500
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@enrollments_bp.route('/api/enrollments/course/<course_id>', methods=['GET'])
@admin_required
def get_course_enrollments(course_id):
    try:
        enrollment_model = Enrollment()
        user_model = User()
        
        enrollments = enrollment_model.get_course_enrollments(course_id)
        
        # Get student details for each enrollment
        enrollment_details = []
        for enrollment in enrollments:
            student = user_model.find_by_id(enrollment['student_id'])
            if student:
                enrollment['_id'] = str(enrollment['_id'])
                enrollment['course_id'] = str(enrollment['course_id'])
                enrollment['student_id'] = str(enrollment['student_id'])
                student['_id'] = str(student['_id'])
                enrollment_details.append({
                    'enrollment': enrollment,
                    'student': student
                })
        
        return jsonify({'enrollments': enrollment_details}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@enrollments_bp.route('/api/students', methods=['GET'])
@admin_required
def get_all_students():
    try:
        user_model = User()
        students = user_model.get_all_students()
        
        # Convert ObjectId to string
        for student in students:
            student['_id'] = str(student['_id'])
            # Remove password from response
            student.pop('password', None)
        
        return jsonify({'students': students}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@enrollments_bp.route('/api/students/<student_id>', methods=['GET'])
@admin_required
def get_student_details(student_id):
    try:
        user_model = User()
        enrollment_model = Enrollment()
        course_model = Course()
        
        student = user_model.find_by_id(student_id)
        if not student:
            return jsonify({'error': 'Student not found'}), 404
        
        student['_id'] = str(student['_id'])
        student.pop('password', None)
        
        # Get student enrollments
        enrollments = enrollment_model.get_student_enrollments(student_id)
        enrollment_details = []
        
        for enrollment in enrollments:
            course = course_model.find_by_id(enrollment['course_id'])
            if course:
                course['_id'] = str(course['_id'])
                enrollment['_id'] = str(enrollment['_id'])
                enrollment['course_id'] = str(enrollment['course_id'])
                enrollment['student_id'] = str(enrollment['student_id'])
                enrollment_details.append({
                    'enrollment': enrollment,
                    'course': course
                })
        
        return jsonify({
            'student': student,
            'enrollments': enrollment_details
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@enrollments_bp.route('/api/students/<student_id>', methods=['PUT'])
@admin_required
def update_student(student_id):
    try:
        data = request.get_json()
        
        user_model = User()
        updated = user_model.update_user(student_id, data)
        
        if updated:
            return jsonify({'message': 'Student updated successfully'}), 200
        else:
            return jsonify({'error': 'Failed to update student'}), 500
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@enrollments_bp.route('/api/students/<student_id>', methods=['DELETE'])
@admin_required
def delete_student(student_id):
    try:
        user_model = User()
        deleted = user_model.delete_user(student_id)
        
        if deleted:
            return jsonify({'message': 'Student deleted successfully'}), 200
        else:
            return jsonify({'error': 'Failed to delete student'}), 500
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@enrollments_bp.route('/api/students/<student_id>/profile', methods=['PUT'])
@student_required
def update_profile(student_id):
    try:
        # Students can only update their own profile
        if student_id != request.current_user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        data = request.get_json()
        
        # Remove sensitive fields
        data.pop('password', None)
        data.pop('role', None)
        data.pop('email', None)
        
        user_model = User()
        updated = user_model.update_user(student_id, data)
        
        if updated:
            return jsonify({'message': 'Profile updated successfully'}), 200
        else:
            return jsonify({'error': 'Failed to update profile'}), 500
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
