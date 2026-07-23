from flask import Blueprint, request, jsonify, current_app
from models.course import Course
from utils.auth import admin_required, token_required
from utils.notifier import stats_notifier
import json
import os
import uuid
from werkzeug.utils import secure_filename

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
        
        return jsonify(courses), 200
        
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
        if request.is_json:
            data = request.get_json()
        else:
            data = request.form.to_dict()
            for json_field in ['modules', 'completionCriteria', 'learningConfig', 'discussionTopics']:
                if json_field in data:
                    try:
                        data[json_field] = json.loads(data[json_field])
                    except Exception:
                        pass
            
            if 'thumbnail' in request.files:
                file = request.files['thumbnail']
                if file and file.filename != '':
                    upload_folder = os.path.join(current_app.root_path, 'static', 'uploads')
                    os.makedirs(upload_folder, exist_ok=True)
                    filename = secure_filename(file.filename)
                    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else 'jpg'
                    new_filename = f"{uuid.uuid4().hex}.{ext}"
                    file.save(os.path.join(upload_folder, new_filename))
                    data['thumbnail'] = f"/static/uploads/{new_filename}"

        if 'code' not in data or not data['code']:
            import random
            category = data.get('category', 'CS')
            prefix = ''.join([w[0] for w in category.split() if w]).upper()
            if not prefix:
                prefix = 'CS'
            data['code'] = f"{prefix}-{random.randint(100, 999)}"

        required_fields = ['title', 'description', 'instructor', 'category', 'duration', 'difficulty', 'code']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400
        
        if data['difficulty'] not in ['Beginner', 'Intermediate', 'Advanced']:
            return jsonify({'error': 'Invalid difficulty level. Must be Beginner, Intermediate, or Advanced'}), 400
            
        if 'is_active' in data:
            if isinstance(data['is_active'], str):
                data['is_active'] = data['is_active'].lower() == 'true'
        
        course_model = Course()
        course_id = course_model.create_course(data)
        
        # Notify stats listeners of course change
        stats_notifier.notify()
        
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
        if request.is_json:
            data = request.get_json()
        else:
            data = request.form.to_dict()
            for json_field in ['modules', 'completionCriteria', 'learningConfig', 'discussionTopics']:
                if json_field in data:
                    try:
                        data[json_field] = json.loads(data[json_field])
                    except Exception:
                        pass
            
            if 'thumbnail' in request.files:
                file = request.files['thumbnail']
                if file and file.filename != '':
                    upload_folder = os.path.join(current_app.root_path, 'static', 'uploads')
                    os.makedirs(upload_folder, exist_ok=True)
                    filename = secure_filename(file.filename)
                    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else 'jpg'
                    new_filename = f"{uuid.uuid4().hex}.{ext}"
                    file.save(os.path.join(upload_folder, new_filename))
                    data['thumbnail'] = f"/static/uploads/{new_filename}"

        course_model = Course()
        course = course_model.find_by_id(course_id)
        
        if not course:
            return jsonify({'error': 'Course not found'}), 404
        
        if 'difficulty' in data and data['difficulty'] not in ['Beginner', 'Intermediate', 'Advanced']:
            return jsonify({'error': 'Invalid difficulty level. Must be Beginner, Intermediate, or Advanced'}), 400
            
        if 'is_active' in data:
            if isinstance(data['is_active'], str):
                data['is_active'] = data['is_active'].lower() == 'true'
        
        updated = course_model.update_course(course_id, data)
        
        if updated:
            stats_notifier.notify()
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
            stats_notifier.notify()
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
            stats_notifier.notify()
            return jsonify({
                'message': f'Course {"activated" if new_status else "deactivated"} successfully',
                'is_active': new_status
            }), 200
        else:
            return jsonify({'error': 'Failed to update course status'}), 500
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
