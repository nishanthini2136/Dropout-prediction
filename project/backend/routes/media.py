from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.media import MediaModel
from utils.notifier import stats_notifier

media_bp = Blueprint('media', __name__, url_prefix='/api/admin/media')

@media_bp.route('', methods=['POST'])
@jwt_required()
def upload_media():
    """Upload a video, PDF, PPT, or resource file.
    Expected form-data fields:
    - file: the uploaded file
    - course_id: ID of the course
    - module_id: ID of the module
    - type: one of 'video', 'pdf', 'ppt', 'resource'
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in the request'}), 400
    file = request.files['file']
    course_id = request.form.get('course_id')
    module_id = request.form.get('module_id')
    media_type = request.form.get('type')
    if not all([course_id, module_id, media_type]):
        return jsonify({'error': 'course_id, module_id, and type are required'}), 400
    if media_type not in ('video', 'pdf', 'ppt', 'resource'):
        return jsonify({'error': 'Invalid media type'}), 400
    try:
        media_doc = MediaModel().save_file(file, course_id, module_id, media_type)
        # Notify admins about media change
        stats_notifier.notify()
        return jsonify(media_doc), 201
    except Exception as e:
        current_app.logger.exception('Media upload failed')
        return jsonify({'error': str(e)}), 500

@media_bp.route('/<media_id>', methods=['DELETE'])
@jwt_required()
def delete_media(media_id):
    result = MediaModel().delete_media(media_id)
    stats_notifier.notify()
    return jsonify({'deleted_count': result.deleted_count if result else 0}), 200
