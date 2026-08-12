from flask import Blueprint, jsonify
from models.user import User
from models.course import Course
from models.enrollment import Enrollment
from utils.auth import admin_required
from utils.notifier import stats_notifier

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/api/admin/dashboard', methods=['GET'])
@admin_required
def get_dashboard_stats():
    try:
        print("Fetching dashboard stats...")
        user_model = User()
        course_model = Course()
        enrollment_model = Enrollment()

        # Get total courses
        total_courses = course_model.get_course_count()
        print(f"Total courses: {total_courses}")

        # Get total students
        total_students = user_model.get_student_count()
        print(f"Total students: {total_students}")

        # Get total enrollments
        total_enrollments = enrollment_model.get_enrollment_count()
        print(f"Total enrollments: {total_enrollments}")

        # Calculate seats remaining
        # Assuming each course has a capacity field, calculate total capacity minus enrollments
        courses = course_model.get_all_courses(active_only=True)
        total_capacity = sum(course.get('capacity', 30) for course in courses)  # Default capacity of 30 if not specified
        seats_remaining = max(0, total_capacity - total_enrollments)
        print(f"Total capacity: {total_capacity}, Seats remaining: {seats_remaining}")

        stats = {
            'total_courses': total_courses,
            'total_students': total_students,
            'total_enrollments': total_enrollments,
            'seats_remaining': seats_remaining
        }

        print(f"Final stats: {stats}")
        return jsonify(stats), 200

    except Exception as e:
        print(f"Error fetching dashboard stats: {str(e)}")
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/api/admin/dashboard/events', methods=['GET'])
def dashboard_events():
    from flask import request, Response
    from utils.auth import AuthUtils
    import queue
    
    token = request.args.get('token')
    if not token:
        return jsonify({'error': 'Token is missing'}), 401
        
    payload = AuthUtils.decode_token(token)
    if not payload or payload.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized access'}), 401
        
    def event_stream():
        # Yield initial message to confirm connection
        yield "data: initial\n\n"
        
        q = stats_notifier.listen()
        try:
            while True:
                try:
                    # wait for notification up to 30 seconds
                    q.get(timeout=30)
                    yield "data: update\n\n"
                except queue.Empty:
                    # keep alive comment
                    yield ": keep-alive\n\n"
        except GeneratorExit:
            stats_notifier.remove_listener(q)
        finally:
            stats_notifier.remove_listener(q)
            
    response = Response(event_stream(), mimetype='text/event-stream')
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['X-Accel-Buffering'] = 'no'
    return response

@admin_bp.route('/api/admin/students', methods=['GET'])
@admin_required
def get_students():
    try:
        user_model = User()
        from services.risk_engine import RiskEngine
        risk_engine = RiskEngine()
        students = user_model.get_all_students()
        
        for student in students:
            s_id = str(student['_id'])
            student['_id'] = s_id
            if 'password' in student:
                del student['password']

            # Compute or fetch up-to-date risk badge, score, and last_calculated for student
            badge, score, last_calc = risk_engine.update_user_overall_risk(s_id)
            if (not student.get('risk_badge') or student.get('risk_badge') == 'Low') and score == 0.0:
                try:
                    risk_engine.predict_risk(s_id)
                    badge, score, last_calc = risk_engine.update_user_overall_risk(s_id)
                except Exception as ex:
                    print(f"Error computing live risk for student {s_id}: {ex}")

            student['risk_badge'] = badge
            student['risk_score'] = score
            student['last_calculated'] = last_calc

        return jsonify(students), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/api/admin/risk/recalculate', methods=['POST'])
@admin_required
def recalculate_risk():
    try:
        from services.risk_engine import RiskEngine
        risk_engine = RiskEngine()
        user_model = User()
        students = user_model.get_all_students()
        
        count = 0
        for student in students:
            try:
                risk_engine.predict_risk(str(student['_id']))
                count += 1
            except Exception as e:
                print(f"Failed to calculate risk for {student['_id']}: {e}")
                
        return jsonify({'message': f'Recalculated risk for {count} students'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/api/admin/analytics', methods=['GET'])
@admin_required
def get_analytics():
    try:
        from config.database import db
        # Return aggregations for analytics console from active student risk badges
        pipeline = [
            {'$match': {'role': 'student'}},
            {'$group': {'_id': '$risk_badge', 'count': {'$sum': 1}}}
        ]
        risk_distribution_raw = list(db.get_db()['users'].aggregate(pipeline))
        risk_distribution = {item['_id']: item['count'] for item in risk_distribution_raw if item['_id']}
        
        return jsonify({
            'risk_distribution': risk_distribution
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

