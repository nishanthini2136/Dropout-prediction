import os
import pytest
import jwt
from datetime import datetime, timedelta
from bson import ObjectId
import mongomock

# Ensure JWT_SECRET_KEY is set consistently
os.environ['JWT_SECRET_KEY'] = 'test-secret-key-for-rbac-tests'

from app import app as flask_app
from config.database import db
from utils.auth import AuthUtils


@pytest.fixture(scope='session')
def secret_key():
    return os.environ['JWT_SECRET_KEY']


@pytest.fixture(autouse=True)
def mock_mongodb():
    """
    Sets up an in-memory mongomock Database instance for each test.
    Overrides db.db and db.client so real queries execute against mongomock.
    """
    mock_client = mongomock.MongoClient()
    test_db = mock_client['test_elearning_db']
    
    # Patch singleton db instance
    original_client = db.client
    original_db = db.db
    
    db.client = mock_client
    db.db = test_db
    
    yield test_db
    
    # Teardown
    db.client = original_client
    db.db = original_db


@pytest.fixture
def app():
    flask_app.config['TESTING'] = True
    flask_app.config['DEBUG'] = False
    return flask_app


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def topology(mock_mongodb):
    """
    Seeds a deterministic, unambiguous role and resource hierarchy:
    
    Users:
      - admin_user
      - instructor_1 (owns course_1)
      - instructor_2 (owns course_2)
      - student_1 (enrolled in course_1)
      - student_2 (enrolled in course_2, NOT in course_1)
      - student_unattached (enrolled in nothing)

    Courses:
      - course_1 (owned by instructor_1)
      - course_2 (owned by instructor_2)

    Enrollments:
      - student_1 -> course_1
      - student_2 -> course_2
    """
    admin_id = ObjectId('60c72b2f9b1d8b2bad000001')
    inst_1_id = ObjectId('60c72b2f9b1d8b2bad000002')
    inst_2_id = ObjectId('60c72b2f9b1d8b2bad000003')
    stud_1_id = ObjectId('60c72b2f9b1d8b2bad000004')
    stud_2_id = ObjectId('60c72b2f9b1d8b2bad000005')
    stud_unattached_id = ObjectId('60c72b2f9b1d8b2bad000006')

    course_1_id = ObjectId('60c72b2f9b1d8b2bad000011')
    course_2_id = ObjectId('60c72b2f9b1d8b2bad000012')

    users = [
        {'_id': admin_id, 'name': 'Admin User', 'email': 'admin@test.com', 'role': 'admin'},
        {'_id': inst_1_id, 'name': 'Instructor One', 'email': 'inst1@test.com', 'role': 'instructor'},
        {'_id': inst_2_id, 'name': 'Instructor Two', 'email': 'inst2@test.com', 'role': 'instructor'},
        {'_id': stud_1_id, 'name': 'Student One', 'email': 'student1@test.com', 'role': 'student', 'risk_score': 15.0, 'risk_badge': 'Low'},
        {'_id': stud_2_id, 'name': 'Student Two', 'email': 'student2@test.com', 'role': 'student', 'risk_score': 85.0, 'risk_badge': 'High'},
        {'_id': stud_unattached_id, 'name': 'Student Unattached', 'email': 'unattached@test.com', 'role': 'student', 'risk_score': 50.0, 'risk_badge': 'Medium'},
    ]
    mock_mongodb['users'].insert_many(users)

    courses = [
        {
            '_id': course_1_id,
            'title': 'Course Alpha by Instructor 1',
            'description': 'Owned by Instructor 1',
            'instructor_id': inst_1_id,
            'status': 'draft',
            'is_active': True,
            'category': 'Programming',
            'modules': []
        },
        {
            '_id': course_2_id,
            'title': 'Course Beta by Instructor 2',
            'description': 'Owned by Instructor 2',
            'instructor_id': inst_2_id,
            'status': 'draft',
            'is_active': True,
            'category': 'Data Science',
            'modules': []
        }
    ]
    mock_mongodb['courses'].insert_many(courses)

    enrollments = [
        {
            '_id': ObjectId('60c72b2f9b1d8b2bad000021'),
            'student_id': stud_1_id,
            'course_id': course_1_id,
            'progress': 45.0,
            'status': 'active'
        },
        {
            '_id': ObjectId('60c72b2f9b1d8b2bad000022'),
            'student_id': stud_2_id,
            'course_id': course_2_id,
            'progress': 10.0,
            'status': 'active'
        }
    ]
    mock_mongodb['enrollments'].insert_many(enrollments)

    return {
        'admin_id': str(admin_id),
        'instructor_1_id': str(inst_1_id),
        'instructor_2_id': str(inst_2_id),
        'student_1_id': str(stud_1_id),
        'student_2_id': str(stud_2_id),
        'student_unattached_id': str(stud_unattached_id),
        'course_1_id': str(course_1_id),
        'course_2_id': str(course_2_id),
    }


def make_token(user_id, role, secret_key, exp_delta_hours=1):
    payload = {
        'user_id': str(user_id),
        'role': role,
        'exp': datetime.utcnow() + timedelta(hours=exp_delta_hours)
    }
    return jwt.encode(payload, secret_key, algorithm='HS256')


@pytest.fixture
def auth_headers(topology, secret_key):
    """
    Pre-generated Authorization headers for all actor roles.
    """
    return {
        'admin': {'Authorization': f"Bearer {make_token(topology['admin_id'], 'admin', secret_key)}"},
        'instructor_1': {'Authorization': f"Bearer {make_token(topology['instructor_1_id'], 'instructor', secret_key)}"},
        'instructor_2': {'Authorization': f"Bearer {make_token(topology['instructor_2_id'], 'instructor', secret_key)}"},
        'student_1': {'Authorization': f"Bearer {make_token(topology['student_1_id'], 'student', secret_key)}"},
        'student_2': {'Authorization': f"Bearer {make_token(topology['student_2_id'], 'student', secret_key)}"},
        'student_unattached': {'Authorization': f"Bearer {make_token(topology['student_unattached_id'], 'student', secret_key)}"},
        'expired': {'Authorization': f"Bearer {make_token(topology['student_1_id'], 'student', secret_key, exp_delta_hours=-2)}"},
        'malformed': {'Authorization': 'Bearer this.is.an.invalid.token'},
        'no_scheme': {'Authorization': 'some_random_token_without_bearer'},
    }
