from flask import Blueprint, jsonify, request
from utils.auth import token_required
from models.forum_post import ForumPostModel
from models.user import User

forum_bp = Blueprint('forum', __name__, url_prefix='/api/forum')

@forum_bp.route('/course/<course_id>', methods=['GET'])
@token_required
def get_course_threads(course_id):
    try:
        threads = ForumPostModel().get_threads_by_course(course_id)
        for t in threads:
            t['_id'] = str(t['_id'])
            for r in t.get('replies', []):
                r['reply_id'] = str(r['reply_id'])
        return jsonify(threads), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@forum_bp.route('/course/<course_id>/thread', methods=['POST'])
@token_required
def create_thread(course_id):
    try:
        user_id = request.current_user_id
        data = request.get_json()
        title = data.get('title')
        content = data.get('content')
        
        user = User().find_by_id(user_id)
        author_name = user.get('name', 'Student') if user else 'Student'

        thread = ForumPostModel().create_thread(course_id, user_id, author_name, title, content)
        thread['_id'] = str(thread['_id'])
        
        # Log engagement
        from models.engagement import EngagementModel
        EngagementModel().log_event(user_id, course_id, None, 'forum_post')
        
        return jsonify(thread), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@forum_bp.route('/thread/<thread_id>/reply', methods=['POST'])
@token_required
def reply_to_thread(thread_id):
    try:
        user_id = request.current_user_id
        data = request.get_json()
        content = data.get('content')
        
        user = User().find_by_id(user_id)
        author_name = user.get('name', 'Student') if user else 'Student'

        success = ForumPostModel().add_reply(thread_id, user_id, author_name, content)
        if success:
            # Log engagement
            from models.engagement import EngagementModel
            EngagementModel().log_event(user_id, None, None, 'forum_reply')
            return jsonify({'message': 'Reply added'}), 200
        return jsonify({'error': 'Thread not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500
