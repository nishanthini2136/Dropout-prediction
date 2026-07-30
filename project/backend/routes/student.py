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

    quizzes = []
    module_title = None

    # 1. Look up in separate 'quizzes' collection
    oid = _to_object_id(module_id)
    if oid is not None:
        try:
            quizzes = QuizModel().get_quizzes_by_module(module_id)
        except Exception:
            pass

    if not quizzes:
        try:
            module_id_int = int(module_id)
            quizzes = list(db.get_db()['quizzes'].find({'module_id': module_id_int}))
        except (ValueError, TypeError):
            pass

    if not quizzes:
        try:
            quizzes = list(db.get_db()['quizzes'].find({'module_id': str(module_id)}))
        except Exception:
            pass

    # 2. If not found in 'quizzes' collection, look up in 'courses' collection for embedded modules
    if not quizzes:
        try:
            courses = list(db.get_db()['courses'].find())
            for course in courses:
                mods = course.get('modules', [])
                for mod in mods:
                    mod_id = str(mod.get('_id') or mod.get('id') or '')
                    if mod_id == str(module_id) or (str(module_id).isdigit() and str(mod.get('id')) == str(module_id)):
                        module_title = mod.get('title')
                        embedded_quizzes = mod.get('quizzes', [])
                        if embedded_quizzes:
                            for eq in embedded_quizzes:
                                q_dict = dict(eq)
                                if '_id' not in q_dict and 'id' in q_dict:
                                    q_dict['_id'] = str(q_dict['id'])
                                elif '_id' not in q_dict:
                                    q_dict['_id'] = f"quiz_{module_id}"
                                quizzes.append(q_dict)
                        break
                if quizzes:
                    break
        except Exception as e:
            print("Error searching embedded courses for quiz:", e)

    # 3. Fallback: If still no quiz found, generate a dynamic module knowledge check quiz
    if not quizzes:
        title_display = module_title or f"Module {module_id}"
        default_quiz = {
            '_id': f"quiz_auto_{module_id}",
            'module_id': str(module_id),
            'title': f"📝 {title_display} - Knowledge Assessment Quiz",
            'description': 'Test your comprehension of the concepts presented in this module video.',
            'questions': [
                {
                    'id': 1,
                    'question': f'What is the central focus of {title_display}?',
                    'type': 'single',
                    'options': [
                        'Understanding the core principles and key techniques taught in this lesson',
                        'Memorizing random definitions without practical context',
                        'Bypassing practical exercises and problem solving',
                        'Ignoring the foundational concepts of the topic'
                    ],
                    'answer': 0
                },
                {
                    'id': 2,
                    'question': 'What is recommended after watching this video lesson?',
                    'type': 'single',
                    'options': [
                        'Complete the assessment quiz and practice the sample exercises',
                        'Skip directly to the end of the course without reviewing',
                        'Close all learning materials immediately',
                        'Discard notes taken during the video'
                    ],
                    'answer': 0
                },
                {
                    'id': 3,
                    'question': 'How can you best apply the concepts learned in this module?',
                    'type': 'single',
                    'options': [
                        'By practicing real-world problems and validating knowledge with quizzes',
                        'By ignoring the course assignments',
                        'By relying solely on memory without practice',
                        'None of the above'
                    ],
                    'answer': 0
                }
            ]
        }
        quizzes = [default_quiz]

    return jsonify([_serialize(q) for q in quizzes]), 200

# ---------------------------------------------------------------------------
# Submit quiz results for a module
@student_bp.route('/module/<module_id>/quiz/submit', methods=['POST'])
@token_required
def submit_module_quiz(module_id):
    """Save quiz submission result for a module."""
    user_id = request.current_user_id
    data = request.get_json() or {}
    score = data.get('score', 0)
    total = data.get('total', 0)
    answers = data.get('answers', {})

    try:
        ProgressModel().set_quiz_completed(user_id, module_id, score, total, answers)
    except Exception as e:
        return jsonify({'error': f'Could not save quiz result: {str(e)}'}), 500

    return jsonify({
        'message': 'Quiz submission saved successfully',
        'score': score,
        'total': total,
        'module_id': str(module_id)
    }), 200

# ---------------------------------------------------------------------------
# Get overall progress (watched videos & completed quizzes) for current student
@student_bp.route('/progress', methods=['GET'])
@token_required
def get_student_progress():
    """Return progress mapping for all modules for current student."""
    user_id = request.current_user_id
    try:
        progress = ProgressModel().get_all_user_progress(user_id)
        return jsonify(progress), 200
    except Exception as e:
        return jsonify({'error': f'Could not fetch progress: {str(e)}'}), 500





