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

        # Calculate seats remaining using lightweight capacity projection
        courses = list(course_model.collection.find({'is_active': True}, {'capacity': 1}))
        total_capacity = sum(course.get('capacity', 30) for course in courses)
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
        from config.database import db
        from bson import ObjectId
        user_model = User()
        students = user_model.get_all_students()
        
        # Batch load enrollments and course titles for all students
        student_oids = []
        for s in students:
            sid = str(s['_id'])
            if ObjectId.is_valid(sid):
                student_oids.append(ObjectId(sid))
            student_oids.append(sid)
            
        enrollments = list(db.get_db()['enrollments'].find({
            '$or': [{'student_id': {'$in': student_oids}}, {'user_id': {'$in': student_oids}}]
        }))
        
        course_ids = []
        for e in enrollments:
            cid = e.get('course_id')
            if cid:
                if ObjectId.is_valid(str(cid)):
                    course_ids.append(ObjectId(str(cid)))
                course_ids.append(str(cid))
                
        courses = list(db.get_db()['courses'].find({'_id': {'$in': course_ids}}, {'title': 1, 'code': 1}))
        course_map = {str(c['_id']): c for c in courses}
        
        student_courses_map = {}
        for e in enrollments:
            uid = str(e.get('student_id') or e.get('user_id') or '')
            cid = str(e.get('course_id') or '')
            c_info = course_map.get(cid)
            if c_info:
                if uid not in student_courses_map:
                    student_courses_map[uid] = []
                c_title = c_info.get('title', 'Untitled Course')
                if not any(item['course_id'] == cid for item in student_courses_map[uid]):
                    student_courses_map[uid].append({
                        'course_id': cid,
                        'title': c_title,
                        'code': c_info.get('code', ''),
                        'progress': round(e.get('progress', 0), 1),
                        'is_completed': e.get('progress', 0) >= 100 or e.get('status') == 'completed'
                    })

        for student in students:
            s_id = str(student['_id'])
            student['_id'] = s_id
            if 'password' in student:
                del student['password']

            # Enrolled courses
            c_list = student_courses_map.get(s_id, [])
            student['courses'] = c_list
            student['course_names'] = [c['title'] for c in c_list]

            # Risk metrics
            student['risk_badge'] = student.get('risk_badge', 'Low')
            student['risk_score'] = round(float(student.get('risk_score', 0.0)), 1)
            last_calc = student.get('last_calculated')
            if hasattr(last_calc, 'isoformat'):
                last_calc = last_calc.isoformat()
                if not last_calc.endswith('Z'):
                    last_calc += 'Z'
            elif isinstance(last_calc, str) and last_calc and not last_calc.endswith('Z') and '+' not in last_calc and '-' not in last_calc[10:]:
                last_calc += 'Z'

            updated_at = student.get('updated_at')
            if hasattr(updated_at, 'isoformat'):
                updated_at = updated_at.isoformat()
                if not updated_at.endswith('Z'):
                    updated_at += 'Z'
            elif isinstance(updated_at, str) and updated_at and not updated_at.endswith('Z') and '+' not in updated_at and '-' not in updated_at[10:]:
                updated_at += 'Z'

            student['last_calculated'] = last_calc or updated_at or ''

        return jsonify({
            'students': students,
            'total': len(students)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/api/admin/risk/recalculate', methods=['POST'])
@admin_required
def recalculate_risk():
    try:
        from flask import request
        from config.database import db
        from bson import ObjectId
        from datetime import datetime
        from services.risk_engine import RiskEngine
        
        data = request.get_json(silent=True) or {}
        target_student_id = data.get('student_id')
        risk_engine = RiskEngine()
        user_model = User()
        
        if target_student_id:
            s_id = str(target_student_id)
            # Recalculate risk for this specific student
            risk_engine.predict_risk(s_id)
            
            # Fetch fresh updated user document
            u_oid = ObjectId(s_id) if ObjectId.is_valid(s_id) else s_id
            updated_user = db.get_db()['users'].find_one({'_id': u_oid})
            
            # Fetch student's enrolled courses
            enrollments = list(db.get_db()['enrollments'].find({
                '$or': [{'student_id': {'$in': [u_oid, s_id]}}, {'user_id': {'$in': [u_oid, s_id]}}]
            }))
            course_ids = [ObjectId(e['course_id']) if ObjectId.is_valid(str(e.get('course_id'))) else str(e.get('course_id')) for e in enrollments if e.get('course_id')]
            courses = list(db.get_db()['courses'].find({'_id': {'$in': course_ids}}, {'title': 1, 'code': 1}))
            course_map = {str(c['_id']): c for c in courses}
            
            c_list = []
            for e in enrollments:
                cid = str(e.get('course_id') or '')
                c_info = course_map.get(cid)
                if c_info and not any(item['course_id'] == cid for item in c_list):
                    c_list.append({
                        'course_id': cid,
                        'title': c_info.get('title', 'Untitled Course'),
                        'code': c_info.get('code', ''),
                        'progress': round(e.get('progress', 0), 1),
                        'is_completed': e.get('progress', 0) >= 100 or e.get('status') == 'completed'
                    })

            last_calc = updated_user.get('last_calculated') or datetime.utcnow()
            if hasattr(last_calc, 'isoformat'):
                last_calc_iso = last_calc.isoformat()
                if not last_calc_iso.endswith('Z'):
                    last_calc_iso += 'Z'
            else:
                last_calc_iso = str(last_calc)
                if not last_calc_iso.endswith('Z') and '+' not in last_calc_iso:
                    last_calc_iso += 'Z'
            
            student_obj = {
                '_id': s_id,
                'name': updated_user.get('name', 'Student'),
                'email': updated_user.get('email', ''),
                'risk_badge': updated_user.get('risk_badge', 'Low'),
                'risk_score': round(float(updated_user.get('risk_score', 0.0)), 1),
                'last_calculated': last_calc_iso,
                'courses': c_list,
                'course_names': [c['title'] for c in c_list]
            }
            
            return jsonify({
                'message': f"Risk recalculated successfully for {updated_user.get('name')}",
                'student': student_obj,
                'risk_badge': student_obj['risk_badge'],
                'risk_score': student_obj['risk_score'],
                'last_calculated': last_calc_iso
            }), 200
        else:
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
        # 1. Return aggregations for analytics console from active student risk badges
        pipeline = [
            {'$match': {'role': 'student'}},
            {'$group': {'_id': '$risk_badge', 'count': {'$sum': 1}}}
        ]
        risk_distribution_raw = list(db.get_db()['users'].aggregate(pipeline))
        risk_distribution = {'High': 0, 'Medium': 0, 'Low': 0}
        for item in risk_distribution_raw:
            badge = item.get('_id')
            if badge in risk_distribution:
                risk_distribution[badge] = item.get('count', 0)
            elif badge:
                risk_distribution['Medium'] += item.get('count', 0)
        
        # 2. Top engaged courses with enrollment counts
        enrollment_counts = list(db.get_db()['enrollments'].aggregate([
            {'$group': {'_id': '$course_id', 'count': {'$sum': 1}}}
        ]))
        counts_map = {str(item['_id']): item['count'] for item in enrollment_counts if item.get('_id')}
        
        courses = list(db.get_db()['courses'].find({'is_active': True}, {'title': 1, 'code': 1}))
        top_courses = []
        for c in courses:
            cid = str(c['_id'])
            top_courses.append({
                '_id': cid,
                'title': c.get('title', 'Untitled Course'),
                'code': c.get('code', ''),
                'enrolled_count': counts_map.get(cid, 0)
            })
        top_courses.sort(key=lambda x: x['enrolled_count'], reverse=True)

        analytics_data = {
            'risk_distribution': risk_distribution,
            'top_courses': top_courses,
            'total_students': sum(risk_distribution.values()),
            'total_courses': len(courses)
        }

        return jsonify({
            'analytics': analytics_data,
            'risk_distribution': risk_distribution,
            'top_courses': top_courses
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

