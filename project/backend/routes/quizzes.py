from flask import Blueprint, request, jsonify
from utils.auth import admin_required
from models.quiz import QuizModel
from utils.notifier import stats_notifier

quizzes_bp = Blueprint('quizzes', __name__, url_prefix='/api/admin/quizzes')

@quizzes_bp.route('', methods=['POST'])
@admin_required
def create_quiz():
    data = request.get_json()
    required = ['course_id', 'module_id', 'title', 'questions']
    if not all(k in data for k in required):
        return jsonify({'error': 'Missing required fields'}), 400
    quiz = QuizModel().create_quiz(
        course_id=data['course_id'],
        module_id=data['module_id'],
        title=data['title'],
        questions=data['questions'],
        shuffle=data.get('shuffle', False)
    )
    stats_notifier.notify()
    return jsonify(quiz), 201

@quizzes_bp.route('/<quiz_id>', methods=['GET'])
@admin_required
def get_quiz(quiz_id):
    quiz = QuizModel().get_quiz(quiz_id)
    if not quiz:
        return jsonify({'error': 'Quiz not found'}), 404
    return jsonify(quiz), 200

@quizzes_bp.route('/module/<module_id>', methods=['GET'])
@admin_required
def list_quizzes(module_id):
    quizzes = QuizModel().get_quizzes_by_module(module_id)
    return jsonify(quizzes), 200

@quizzes_bp.route('/<quiz_id>', methods=['PUT'])
@admin_required
def update_quiz(quiz_id):
    data = request.get_json()
    quiz = QuizModel().update_quiz(quiz_id, data)
    stats_notifier.notify()
    return jsonify(quiz), 200

@quizzes_bp.route('/<quiz_id>', methods=['DELETE'])
@admin_required
def delete_quiz(quiz_id):
    result = QuizModel().delete_quiz(quiz_id)
    stats_notifier.notify()
    return jsonify({'deleted_count': result.deleted_count}), 200
