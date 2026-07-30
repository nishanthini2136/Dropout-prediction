from flask import Blueprint, request, jsonify

assignments_bp = Blueprint('assignments', __name__, url_prefix='/api/assignments')

@assignments_bp.route('/', methods=['GET'])
def get_assignments():
    """Return a list of assignments (placeholder)."""
    return jsonify([])
