from flask import Blueprint, request, jsonify
from models.course import Course
from utils.auth import admin_required, token_required

courses_bp = Blueprint('courses', __name__)

@courses_bp.route('/api/courses', methods=['GET'])
def get_all_courses():
    try:
        search_term = request.args.get('search')
        category = request.args.get('category')
        difficulty = request.args.get('difficulty')
        
        course_model = Course()
        
        if search_term or category or difficulty:
            courses = course_model.search_courses(search_term, category, difficulty)
        else:
            courses = course_model.get_all_courses(active_only=True)
        
        # Convert ObjectId to string for JSON serialization
        for course in courses:
            course['_id'] = str(course['_id'])
        
        return jsonify({'courses': courses}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@courses_bp.route('/api/courses/<course_id>', methods=['GET'])
def get_course(course_id):
    try:
        course_model = Course()
        course = course_model.find_by_id(course_id)
        
        if not course:
            return jsonify({'error': 'Course not found'}), 404
        
        course['_id'] = str(course['_id'])
        
        return jsonify({'course': course}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@courses_bp.route('/api/courses', methods=['POST'])
@admin_required
def create_course():
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['title', 'description', 'instructor', 'category', 'duration', 'difficulty']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400
        
        # Validate difficulty level
        if data['difficulty'] not in ['Beginner', 'Intermediate', 'Advanced']:
            return jsonify({'error': 'Invalid difficulty level. Must be Beginner, Intermediate, or Advanced'}), 400
        
        course_model = Course()
        course_id = course_model.create_course(data)
        
        return jsonify({
            'message': 'Course created successfully',
            'course_id': course_id
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@courses_bp.route('/api/courses/<course_id>', methods=['PUT'])
@admin_required
def update_course(course_id):
    try:
        data = request.get_json()
        
        course_model = Course()
        course = course_model.find_by_id(course_id)
        
        if not course:
            return jsonify({'error': 'Course not found'}), 404
        
        # Validate difficulty if provided
        if 'difficulty' in data and data['difficulty'] not in ['Beginner', 'Intermediate', 'Advanced']:
            return jsonify({'error': 'Invalid difficulty level. Must be Beginner, Intermediate, or Advanced'}), 400
        
        updated = course_model.update_course(course_id, data)
        
        if updated:
            return jsonify({'message': 'Course updated successfully'}), 200
        else:
            return jsonify({'error': 'Failed to update course'}), 500
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@courses_bp.route('/api/courses/<course_id>', methods=['DELETE'])
@admin_required
def delete_course(course_id):
    try:
        course_model = Course()
        course = course_model.find_by_id(course_id)
        
        if not course:
            return jsonify({'error': 'Course not found'}), 404
        
        deleted = course_model.delete_course(course_id)
        
        if deleted:
            return jsonify({'message': 'Course deleted successfully'}), 200
        else:
            return jsonify({'error': 'Failed to delete course'}), 500
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@courses_bp.route('/api/courses/<course_id>/toggle-status', methods=['PUT'])
@admin_required
def toggle_course_status(course_id):
    try:
        course_model = Course()
        course = course_model.find_by_id(course_id)
        
        if not course:
            return jsonify({'error': 'Course not found'}), 404
        
        new_status = not course.get('is_active', True)
        updated = course_model.update_course(course_id, {'is_active': new_status})
        
        if updated:
            return jsonify({
                'message': f'Course {"activated" if new_status else "deactivated"} successfully',
                'is_active': new_status
            }), 200
        else:
            return jsonify({'error': 'Failed to update course status'}), 500
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
