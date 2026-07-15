from flask import Blueprint, request, jsonify
from models.enrollment import Enrollment
from models.course import Course
from models.user import User
from utils.auth import token_required, student_required, admin_required
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
        
        # Create enrollment
        enrollment_data = {
            'student_id': ObjectId(request.current_user_id),
            'course_id': ObjectId(data['course_id'])
        }
        
        enrollment_id = enrollment_model.enroll_student(enrollment_data)
        
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
        
        enrollments = enrollment_model.get_student_enrollments(request.current_user_id)
        
        # Get course details for each enrollment
        my_courses = []
        for enrollment in enrollments:
            course = course_model.find_by_id(enrollment['course_id'])
            if course:
                course['_id'] = str(course['_id'])
                enrollment['_id'] = str(enrollment['_id'])
                enrollment['course_id'] = str(enrollment['course_id'])
                enrollment['student_id'] = str(enrollment['student_id'])
                my_courses.append({
                    'enrollment': enrollment,
                    'course': course
                })
        
        return jsonify({'enrollments': my_courses}), 200
        
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

@enrollments_bp.route('/api/enrollments/<enrollment_id>', methods=['DELETE'])
@student_required
def unenroll(enrollment_id):
    try:
        enrollment_model = Enrollment()
        deleted = enrollment_model.unenroll_student(enrollment_id)
        
        if deleted:
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
