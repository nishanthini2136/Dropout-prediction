from models.user import User
from models.course import Course
from models.assignment import AssignmentModel
from models.submission import SubmissionModel
from models.quiz_attempt import QuizAttemptModel
from models.engagement import EngagementModel
from utils.auth import AuthUtils
from config.database import db
from datetime import datetime, timedelta
from bson import ObjectId

def seed_data():
    """Create predefined admin, student, and rich sample courses for testability."""
    db.connect()
    print("Connected to DB.")
    
    user_model = User()
    
    # 1. Admin Account
    existing_admin = user_model.find_by_email("admin@elearning.com")
    if not existing_admin:
        admin_id = user_model.create_user({
            'name': 'System Administrator',
            'email': 'admin@elearning.com',
            'password': AuthUtils.hash_password("admin123"),
            'role': 'admin',
            'phone': '',
            'bio': 'System administrator with full access to the platform'
        })
        print(f"Admin account created successfully! ID: {admin_id}")
    else:
        print("Admin account already exists!")
        admin_id = str(existing_admin['_id'])
        
    # 2. Test Student Account
    existing_student = user_model.find_by_email("student@elearning.com")
    if not existing_student:
        student_id = user_model.create_user({
            'name': 'Test Student',
            'email': 'student@elearning.com',
            'password': AuthUtils.hash_password("student123"),
            'role': 'student',
            'risk_badge': 'Low',
            'risk_score': 0.0
        })
        print(f"Test Student created successfully! ID: {student_id}")
    else:
        student_id = str(existing_student['_id'])

    # 3. Sample Courses
    course_model = Course()
    courses = course_model.get_all_courses(active_only=False)
    if len(courses) < 2:
        print("Seeding sample courses...")
        
        # Course 1: Intro to Python
        c1_id = course_model.create_course({
            'title': 'Introduction to Python',
            'description': 'A comprehensive beginner course on Python programming.',
            'instructor': 'Admin Instructor',
            'category': 'Programming',
            'difficulty': 'Beginner',
            'duration': '4 weeks',
            'credits': 30,
            'code': 'CS-101',
            'is_active': True,
            'modules': [
                {
                    'id': 'mod_python_1',
                    'title': 'Python Basics',
                    'videoUrl': 'https://www.w3schools.com/html/mov_bbb.mp4',
                    'duration': '10:00',
                    'quizzes': [
                        {
                            'id': 'quiz_py_1',
                            'title': 'Basics Quiz',
                            'weight': 10,
                            'questions': [
                                {'id': 1, 'question': 'What is Python?', 'options': ['Snake', 'Language'], 'answer': 1, 'type': 'single'}
                            ]
                        }
                    ]
                }
            ]
        })
        
        # Course 2: Advanced Machine Learning
        c2_id = course_model.create_course({
            'title': 'Advanced Machine Learning',
            'description': 'Deep dive into ML algorithms and neural networks.',
            'instructor': 'Admin Instructor',
            'category': 'Data Science',
            'difficulty': 'Advanced',
            'duration': '8 weeks',
            'credits': 60,
            'code': 'DS-301',
            'is_active': True,
            'modules': [
                {
                    'id': 'mod_ml_1',
                    'title': 'Neural Networks Overview',
                    'videoUrl': 'https://www.w3schools.com/html/mov_bbb.mp4',
                    'duration': '20:00',
                    'quizzes': [
                        {
                            'id': 'quiz_ml_1',
                            'title': 'NN Quiz',
                            'weight': 20,
                            'questions': [
                                {'id': 1, 'question': 'What is an epoch?', 'options': ['Time', 'Iteration'], 'answer': 1, 'type': 'single'}
                            ]
                        }
                    ]
                }
            ]
        })
        print(f"Created courses: {c1_id}, {c2_id}")
    else:
        c1_id = str(courses[0]['_id'])
        print("Courses already seeded.")
        
    # 4. Enroll Student
    db.get_db()['enrollments'].update_one(
        {'user_id': ObjectId(student_id), 'course_id': ObjectId(c1_id)},
        {'$set': {'enrolled_at': datetime.utcnow()}},
        upsert=True
    )
        
    # 5. Assignments and Submissions
    assignment_model = AssignmentModel()
    assignments = assignment_model.get_assignments_by_course(c1_id)
    if not assignments:
        a_id = assignment_model.create_assignment(
            course_id=c1_id,
            title="Python Project 1",
            description="Write a calculator script.",
            due_date=datetime.utcnow() + timedelta(days=7),
            weight=15.0,
            max_score=100.0
        )['_id']
        print(f"Created assignment {a_id}")
    else:
        a_id = assignments[0]['_id']
        
    # 6. Mock Data (Quiz Attempt & Engagement)
    QuizAttemptModel().record_attempt(
        quiz_id="quiz_py_1",
        student_id=student_id,
        course_id=c1_id,
        answers={'1': 1},
        score=100.0,
        max_score=100.0,
        weight=10.0
    )
    
    EngagementModel().log_event(student_id, c1_id, "mod_python_1", "play", 60)
    EngagementModel().log_event(student_id, c1_id, "mod_python_1", "complete", 600)
    
    # 7. Pre-compute Risk Prediction
    from services.risk_engine import RiskEngine
    try:
        RiskEngine().predict_risk(student_id)
        print("Pre-computed risk prediction for test student.")
    except Exception as e:
        print(f"Risk Engine predict failed: {e}")

    print("Seed data completed.")

if __name__ == '__main__':
    seed_data()
