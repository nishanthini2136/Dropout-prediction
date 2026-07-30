from flask import Blueprint, jsonify, request
from bson.objectid import ObjectId
from bson.errors import InvalidId

# Import models
from models.progress import ProgressModel
from models.quiz import QuizModel
from config.database import db
from utils.auth import token_required

student_bp = Blueprint('student', __name__, url_prefix='/api/student')

# Existing placeholder dashboard (kept for compatibility)
@student_bp.route('/dashboard', methods=['GET'])
def get_dashboard():
    """Placeholder for student dashboard data."""
    return jsonify({
        'message': 'Student dashboard placeholder',
        'data': {}
    })

# ---------------------------------------------------------------------------
# Helper: serialise a MongoDB document to a JSON-safe dict
def _serialize(doc):
    result = {}
    for k, v in doc.items():
        if type(v).__name__ == 'ObjectId':
            result[k] = str(v)
        elif isinstance(v, list):
            result[k] = [_serialize(i) if isinstance(i, dict) else i for i in v]
        elif isinstance(v, dict):
            result[k] = _serialize(v)
        else:
            result[k] = v
    return result

# ---------------------------------------------------------------------------
# Helper: convert a module_id string to ObjectId safely
def _to_object_id(id_str):
    try:
        return ObjectId(id_str)
    except (InvalidId, TypeError):
        return None

# ---------------------------------------------------------------------------
# Record that a student has watched a module video
@student_bp.route('/module/<module_id>/watch', methods=['POST'])
@token_required
def watch_module_video(module_id):
    """Mark the video for the given module as watched by the current student."""
    user_id = request.current_user_id
    try:
        ProgressModel().set_video_watched(user_id, module_id)
    except Exception as e:
        return jsonify({'error': f'Could not record progress: {str(e)}'}), 500
    return jsonify({'message': 'Video marked as watched'}), 200

# ---------------------------------------------------------------------------
# Retrieve the quiz for a module, only if the video has been completed
@student_bp.route('/module/<module_id>/quiz', methods=['GET'])
@token_required
def get_module_quiz(module_id):
    """Return the quiz associated with the module if the video is completed.

    Returns HTTP 403 if the video has not been watched.
    """
    user_id = request.current_user_id

    # Check progress — wrap in try/except in case module_id is not a valid ObjectId
    try:
        video_watched = ProgressModel().is_video_watched(user_id, module_id)
    except Exception:
        video_watched = False

    if not video_watched:
        return jsonify({'error': 'Quiz is locked until the video is completed'}), 403

    # Fetch quizzes — handle both ObjectId and integer module IDs
    quizzes = []
    
    # First try ObjectId lookup (for separate modules collection)
    oid = _to_object_id(module_id)
    if oid is not None:
        try:
            quizzes = QuizModel().get_quizzes_by_module(module_id)
        except Exception:
            pass
    
    # If still empty, try integer lookup (for embedded modules in course documents)
    if not quizzes:
        try:
            # Try to find quizzes by converting module_id to integer
            module_id_int = int(module_id)
            quizzes = list(db.get_db()['quizzes'].find({'module_id': module_id_int}))
        except (ValueError, TypeError):
            pass
    
    # If still empty, try raw string match
    if not quizzes:
        try:
            quizzes = list(db.get_db()['quizzes'].find({'module_id': module_id}))
        except Exception:
            pass

    if not quizzes:
        return jsonify({'error': 'No quiz found for this module'}), 404

    return jsonify([_serialize(q) for q in quizzes]), 200




