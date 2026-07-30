from config.database import db
from bson.objectid import ObjectId
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.module import ModuleModel
from utils.notifier import stats_notifier

modules_bp = Blueprint('modules', __name__, url_prefix='/api/admin/modules')

@modules_bp.route('', methods=['POST'])
@jwt_required()
def create_module():
    data = request.get_json()
    course_id = data.get('course_id')
    title = data.get('title')
    description = data.get('description', '')
    order = data.get('order', 0)
    if not course_id or not title:
        return jsonify({'error': 'course_id and title are required'}), 400
    module = ModuleModel().create_module(course_id, title, description, order)
    # Notify admin dashboard of change
    stats_notifier.notify()
    return jsonify(module), 201

@modules_bp.route('/<module_id>', methods=['PUT'])
@jwt_required()
def update_module(module_id):
    data = request.get_json()
    module = ModuleModel().update_module(module_id, data)
    stats_notifier.notify()
    return jsonify(module), 200

@modules_bp.route('/<module_id>', methods=['DELETE'])
@jwt_required()
def delete_module(module_id):
    result = ModuleModel().delete_module(module_id)
    stats_notifier.notify()
    return jsonify({'deleted_count': result.deleted_count}), 200

@modules_bp.route('/<module_id>/move', methods=['PATCH'])
@jwt_required()
def move_module(module_id):
    direction = request.args.get('direction')  # 'up' or 'down'
    if direction not in ('up', 'down'):
        return jsonify({'error': 'direction must be up or down'}), 400
    modules = ModuleModel().move_module(module_id, direction)
    stats_notifier.notify()
    return jsonify(modules), 200

@modules_bp.route('/course/<course_id>', methods=['GET'])
@jwt_required()
def list_modules(course_id):
    modules = ModuleModel().get_modules_by_course(course_id)
    return jsonify(modules), 200
