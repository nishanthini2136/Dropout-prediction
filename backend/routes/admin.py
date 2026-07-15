from flask import Blueprint, jsonify
from models.user import User
from models.course import Course
from models.enrollment import Enrollment
from utils.auth import admin_required

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/api/admin/dashboard', methods=['GET'])
@admin_required
def get_dashboard_stats():
    try:
        user_model = User()
        course_model = Course()
        enrollment_model = Enrollment()
        
        stats = {
            'total_courses': course_model.get_course_count(),
            'total_students': user_model.get_student_count(),
            'total_enrollments': enrollment_model.get_enrollment_count()
        }
        
        return jsonify({'stats': stats}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
