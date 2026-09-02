from flask import Blueprint, request, jsonify, current_app
from models.course import Course
from utils.auth import admin_required, token_required
from utils.notifier import stats_notifier
import json
import os
import uuid
from werkzeug.utils import secure_filename

courses_bp = Blueprint('courses', __name__)

def enrich_course_module_durations(course):
    """Detect and ensure exact durations directly from local uploaded video files for all modules/lessons."""
    if not course or not isinstance(course, dict):
        return course
    upload_folder = os.path.join(current_app.root_path, 'static', 'uploads')
    from utils.media_utils import get_file_duration_formatted
    modules = course.get('modules', [])
    if isinstance(modules, list):
        for mod in modules:
            if not isinstance(mod, dict):
                continue
            lessons = mod.get('lessons') or mod.get('resources') or []
            for lesson in lessons:
                if not isinstance(lesson, dict):
                    continue
                url = lesson.get('url', '')
                if url and url.startswith('/static/uploads/'):
                    filename = secure_filename(url.replace('/static/uploads/', ''))
                    filepath = os.path.join(upload_folder, filename)
                    if os.path.exists(filepath):
                        detected = get_file_duration_formatted(filepath)
                        if detected:
                            lesson['duration'] = detected
    return course

@courses_bp.route('/api/courses', methods=['GET'])
def get_all_courses():
    try:
        from models.enrollment import Enrollment
        from bson import ObjectId
        
        search_term = request.args.get('search')
        category = request.args.get('category')
        difficulty = request.args.get('difficulty')
        
        course_model = Course()
        enrollment_model = Enrollment()
        
        if search_term or category or difficulty:
            courses = course_model.search_courses(search_term, category, difficulty)
        else:
            courses = course_model.get_all_courses(active_only=True)
        
        # Convert ObjectId to string for JSON serialization & calculate seats left dynamically
        for course in courses:
            c_id = str(course['_id'])
            course['_id'] = c_id
            capacity = int(course.get('capacity', 30))
            enrolled_count = enrollment_model.collection.count_documents({'course_id': ObjectId(c_id)})
            course['capacity'] = capacity
            course['enrolled_count'] = enrolled_count
            course['seats_left'] = max(0, capacity - enrolled_count)
            enrich_course_module_durations(course)
        
        return jsonify(courses), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@courses_bp.route('/api/courses/<course_id>', methods=['GET'])
def get_course(course_id):
    try:
        from models.enrollment import Enrollment
        from bson import ObjectId
        
        course_model = Course()
        enrollment_model = Enrollment()
        course = course_model.find_by_id(course_id)
        
        if not course:
            return jsonify({'error': 'Course not found'}), 404
        
        c_id = str(course['_id'])
        course['_id'] = c_id
        capacity = int(course.get('capacity', 30))
        enrolled_count = enrollment_model.collection.count_documents({'course_id': ObjectId(c_id)})
        course['capacity'] = capacity
        course['enrolled_count'] = enrolled_count
        course['seats_left'] = max(0, capacity - enrolled_count)
        enrich_course_module_durations(course)
        
        return jsonify({'course': course}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def process_course_files(request_files, data, course=None):
    upload_folder = os.path.join(current_app.root_path, 'static', 'uploads')
    os.makedirs(upload_folder, exist_ok=True)

    pdf_mapping = {
        'syllabus_pdf': ['syllabus_pdf', 'syllabus_file', 'syllabus'],
        'reference_materials_pdf': ['reference_materials_pdf', 'reference_file', 'reference_pdf'],
        'practice_exercises_pdf': ['practice_exercises_pdf', 'exercises_file', 'exercises_pdf']
    }

    for key, field_names in pdf_mapping.items():
        uploaded = False
        for field in field_names:
            if field in request_files:
                file = request_files[field]
                if file and file.filename != '':
                    filename = secure_filename(file.filename)
                    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else 'pdf'
                    new_filename = f"{key}_{uuid.uuid4().hex[:8]}.{ext}"
                    file.save(os.path.join(upload_folder, new_filename))
                    data[key] = f"/static/uploads/{new_filename}"
                    uploaded = True
                    break
        if not uploaded and course:
            if key in course:
                data[key] = course[key]

    if 'thumbnail' in request_files:
        file = request_files['thumbnail']
        if file and file.filename != '':
            filename = secure_filename(file.filename)
            ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else 'jpg'
            new_filename = f"{uuid.uuid4().hex}.{ext}"
            file.save(os.path.join(upload_folder, new_filename))
            data['thumbnail'] = f"/static/uploads/{new_filename}"

    existing_map = {}
    if course and 'studyMaterials' in course and isinstance(course['studyMaterials'], list):
        existing_map = {m.get('id'): m.get('url') for m in course['studyMaterials'] if isinstance(m, dict)}

    s_url = data.get('syllabus_pdf') or existing_map.get('syllabus') or '/static/uploads/sample_syllabus.pdf'
    r_url = data.get('reference_materials_pdf') or existing_map.get('reference') or '/static/uploads/sample_reference.pdf'
    e_url = data.get('practice_exercises_pdf') or existing_map.get('exercises') or '/static/uploads/sample_exercises.pdf'

    data['syllabus_pdf'] = s_url
    data['reference_materials_pdf'] = r_url
    data['practice_exercises_pdf'] = e_url

    data['studyMaterials'] = [
        {'id': 'syllabus', 'title': 'Course Syllabus PDF', 'type': 'pdf', 'url': s_url},
        {'id': 'reference', 'title': 'Reference Materials PDF', 'type': 'pdf', 'url': r_url},
        {'id': 'exercises', 'title': 'Practice Exercises PDF', 'type': 'pdf', 'url': e_url}
    ]

    # Process module video and resource file uploads
    from utils.media_utils import get_file_duration_formatted
    modules = data.get('modules', [])
    if isinstance(modules, list):
        for m_idx, mod in enumerate(modules):
            if not isinstance(mod, dict):
                continue
            # Check resources or lessons
            res_list = mod.get('resources') or mod.get('lessons') or []
            for r_idx, res in enumerate(res_list):
                if not isinstance(res, dict):
                    continue
                file_keys = [
                    f"module_{m_idx}_resource_{r_idx}_video",
                    f"module_{mod.get('id')}_resource_{res.get('id')}_video",
                    f"video_{m_idx}_{r_idx}",
                    f"module_{m_idx}_resource_{r_idx}_file"
                ]
                for fk in file_keys:
                    if fk in request_files:
                        vfile = request_files[fk]
                        if vfile and vfile.filename:
                            v_orig_name = secure_filename(vfile.filename)
                            v_ext = v_orig_name.rsplit('.', 1)[1].lower() if '.' in v_orig_name else 'mp4'
                            v_new_name = f"video_{uuid.uuid4().hex[:10]}.{v_ext}"
                            v_full_path = os.path.join(upload_folder, v_new_name)
                            vfile.save(v_full_path)
                            res['url'] = f"/static/uploads/{v_new_name}"
                            res['type'] = 'video'
                            detected_dur = get_file_duration_formatted(v_full_path)
                            if detected_dur:
                                res['duration'] = detected_dur
                            break

                # If local file url exists and duration is missing or empty, detect from disk
                r_url = res.get('url', '')
                if r_url and r_url.startswith('/static/uploads/') and not res.get('duration'):
                    local_fname = r_url.replace('/static/uploads/', '')
                    local_path = os.path.join(upload_folder, secure_filename(local_fname))
                    if os.path.exists(local_path):
                        detected_dur = get_file_duration_formatted(local_path)
                        if detected_dur:
                            res['duration'] = detected_dur

@courses_bp.route('/api/courses', methods=['POST'])
@admin_required
def create_course():
    try:
        if request.is_json:
            data = request.get_json()
        else:
            data = request.form.to_dict()
            for json_field in ['modules', 'completionCriteria', 'learningConfig', 'discussionTopics', 'syllabus', 'prerequisites']:
                if json_field in data:
                    try:
                        data[json_field] = json.loads(data[json_field])
                    except Exception:
                        pass

        process_course_files(request.files, data)

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
        course_model = Course()
        course = course_model.find_by_id(course_id)
        
        if not course:
            return jsonify({'error': 'Course not found'}), 404

        if request.is_json:
            data = request.get_json()
        else:
            data = request.form.to_dict()
            for json_field in ['modules', 'completionCriteria', 'learningConfig', 'discussionTopics', 'syllabus', 'prerequisites']:
                if json_field in data:
                    try:
                        data[json_field] = json.loads(data[json_field])
                    except Exception:
                        pass

        process_course_files(request.files, data, course)
        
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

@courses_bp.route('/api/admin/courses/import', methods=['POST'])
@admin_required
def import_course():
    try:
        data = request.get_json(silent=True) or {}
        code = data.get('code')
        title = data.get('title')
        modules = data.get('modules', [])
        
        if not code or not title:
            return jsonify({'error': 'Course code and title are required'}), 400
            
        course_model = Course()
        existing = course_model.collection.find_one({'code': code})
        
        if existing:
            course_model.update_course(str(existing['_id']), data)
            course_id = str(existing['_id'])
            action = 'updated'
        else:
            course_id = course_model.create_course(data)
            action = 'created'
            
        stats_notifier.notify()
        return jsonify({
            'message': f'Course {action} successfully with {len(modules)} modules.',
            'course_id': course_id
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@courses_bp.route('/api/courses/resources/download/<filename>', methods=['GET'])
def download_course_resource(filename):
    try:
        from flask import send_from_directory
        safe_name = secure_filename(filename)
        upload_folder = os.path.join(current_app.root_path, 'static', 'uploads')
        file_path = os.path.join(upload_folder, safe_name)
        if not os.path.exists(file_path):
            return jsonify({'error': 'Resource file not found'}), 404
        
        as_attachment = request.args.get('download', 'false').lower() == 'true'
        return send_from_directory(
            upload_folder,
            safe_name,
            mimetype='application/pdf',
            as_attachment=as_attachment,
            download_name=safe_name if as_attachment else None
        )
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
