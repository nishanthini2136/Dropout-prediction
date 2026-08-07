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
        from models.engagement import EngagementModel
        EngagementModel().log_event(user_id, None, module_id, 'watch', duration=300)
        from services.risk_engine import RiskEngine
        RiskEngine().predict_risk(user_id)
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

    try:
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
                        'answer': 0,
                        'correctAnswer': 0
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
                        'answer': 0,
                        'correctAnswer': 0
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
                        'answer': 0,
                        'correctAnswer': 0
                    }
                ]
            }
            return jsonify(default_quiz), 200

        return jsonify([_serialize(q) for q in quizzes]), 200
    except Exception as e:
        return jsonify({'error': f'Failed to retrieve quiz: {str(e)}'}), 500

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
    course_id = data.get('course_id') or request.args.get('course_id')

    try:
        ProgressModel().set_quiz_completed(user_id, module_id, score, total, answers, course_id=course_id)
        from models.quiz_attempt import QuizAttemptModel
        QuizAttemptModel().record_attempt(
            quiz_id=f"quiz_{module_id}",
            student_id=user_id,
            answers=answers,
            score=float(score),
            max_score=float(total) if total > 0 else 100.0,
            weight=10.0,
            course_id=course_id
        )
        from models.engagement import EngagementModel
        EngagementModel().log_event(user_id, course_id, module_id, 'complete_quiz')
        from services.risk_engine import RiskEngine
        RiskEngine().predict_risk(user_id, course_id=course_id)
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
    course_id = request.args.get('course_id')
    try:
        progress = ProgressModel().get_all_user_progress(user_id, course_id=course_id)
        return jsonify(progress), 200
    except Exception as e:
        return jsonify({'error': f'Could not fetch progress: {str(e)}'}), 500


# ---------------------------------------------------------------------------
# Engagement log API
@student_bp.route('/engagement/log', methods=['POST'])
@token_required
def log_engagement():
    user_id = request.current_user_id
    data = request.get_json() or {}
    course_id = data.get('course_id')
    module_id = data.get('module_id')
    event_type = data.get('event_type')
    duration = data.get('duration', 0)
    
    try:
        from models.engagement import EngagementModel
        EngagementModel().log_event(user_id, course_id, module_id, event_type, duration)
        from services.risk_engine import RiskEngine
        RiskEngine().predict_risk(user_id)
        return jsonify({'message': 'Logged'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ---------------------------------------------------------------------------
@student_bp.route('/roadmap/<int:week_num>', methods=['GET', 'POST'])
@token_required
def handle_roadmap(week_num):
    user_id = request.current_user_id
    course_id = request.args.get('course_id')
    from models.roadmap import RoadmapModel
    roadmap_model = RoadmapModel()
    
    if request.method == 'GET':
        roadmap = roadmap_model.get_roadmap(user_id, week_num, course_id)
        if not roadmap:
            roadmap = roadmap_model.generate_personalized_roadmap(user_id, course_id, week_num)
        if roadmap:
            roadmap['_id'] = str(roadmap['_id'])
            if roadmap.get('course_id'):
                roadmap['course_id'] = str(roadmap['course_id'])
            return jsonify({'roadmap': roadmap}), 200
        return jsonify({'roadmap': None}), 200
        
    elif request.method == 'POST':
        data = request.get_json() or {}
        tasks = data.get('tasks', [])
        c_id = data.get('course_id', course_id)
        roadmap_id = roadmap_model.create_or_update_roadmap(user_id, week_num, tasks, c_id)
        return jsonify({'message': 'Roadmap saved', 'id': str(roadmap_id)}), 200

@student_bp.route('/roadmap/<int:week_num>/task/<int:task_index>', methods=['PUT'])
@token_required
def update_roadmap_task(week_num, task_index):
    user_id = request.current_user_id
    course_id = request.args.get('course_id')
    data = request.get_json() or {}
    new_status = data.get('status')
    
    from models.roadmap import RoadmapModel
    success = RoadmapModel().update_task_status(user_id, week_num, task_index, new_status, course_id)
    if success:
        return jsonify({'message': 'Task updated'}), 200
    return jsonify({'error': 'Task or roadmap not found'}), 404

# ---------------------------------------------------------------------------
# KNN Recommendations API
@student_bp.route('/recommendations', methods=['GET'])
@token_required
def get_recommendations():
    user_id = request.current_user_id
    try:
        from services.recommendation_engine import RecommendationEngine
        rec_engine = RecommendationEngine()
        recommendations = rec_engine.get_recommendations(user_id, top_k=3)
        for rec in recommendations:
            rec['_id'] = str(rec['_id'])
        return jsonify({'recommendations': recommendations}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ---------------------------------------------------------------------------
# Dashboard Stats & Prediction Forecast Map
@student_bp.route('/dashboard/stats', methods=['GET'])
@token_required
def get_dashboard_stats():
    user_id = request.current_user_id
    try:
        from models.prediction import PredictionModel
        from services.risk_engine import RiskEngine
        from models.enrollment import Enrollment
        
        enrollments = Enrollment().get_student_enrollments(user_id)
        predictions_map = {}
        
        for e in enrollments:
            c_id = str(e['course_id'])
            pred = PredictionModel().get_prediction(user_id, c_id)
            if not pred or 'weekly_forecast' not in pred:
                pred = RiskEngine().predict_risk(user_id, c_id)
            if pred:
                pred['_id'] = str(pred['_id'])
                if pred.get('course_id'):
                    pred['course_id'] = str(pred['course_id'])
                predictions_map[c_id] = pred

        if not predictions_map:
            preds = PredictionModel().get_prediction(user_id)
            if isinstance(preds, list) and len(preds) > 0:
                for p in preds:
                    p['_id'] = str(p['_id'])
                    if p.get('course_id'):
                        predictions_map[str(p['course_id'])] = p
                    else:
                        predictions_map['default'] = p
            elif isinstance(preds, dict):
                preds['_id'] = str(preds['_id'])
                predictions_map['default'] = preds

        return jsonify({
            'predictions': predictions_map
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

