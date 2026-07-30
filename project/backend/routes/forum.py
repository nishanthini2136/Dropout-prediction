from flask import Blueprint, jsonify

forum_bp = Blueprint('forum', __name__, url_prefix='/api/forum')

@forum_bp.route('/', methods=['GET'])
def get_forum_posts():
    """Return a list of forum posts (placeholder)."""
    return jsonify([])
