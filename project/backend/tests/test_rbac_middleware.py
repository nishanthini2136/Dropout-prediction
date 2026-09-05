import pytest
from flask import Flask, jsonify, request
from bson import ObjectId
from middleware.rbac import requires_role, requires_ownership, check_student_data_access
from models.course import Course


def create_dummy_app():
    app = Flask(__name__)
    app.config['TESTING'] = True

    @app.route('/test/instructor-only', methods=['GET'])
    @requires_role('instructor')
    def instructor_only():
        return jsonify({'message': 'Welcome instructor', 'user_id': request.current_user_id}), 200

    @app.route('/test/multi-role', methods=['GET'])
    @requires_role('instructor', 'admin')
    def multi_role():
        return jsonify({'message': 'Welcome faculty or admin', 'role': request.current_user_role}), 200

    # Class-based ownership decorator
    @app.route('/test/course/<id>/class-based', methods=['PUT'])
    @requires_role('instructor', 'admin')
    @requires_ownership(Course, id_param='id', owner_field='instructor_id')
    def update_course_class(id):
        return jsonify({'message': 'Updated successfully (class)', 'course_id': id}), 200

    # Instance-based ownership decorator (regression check)
    @app.route('/test/course/<id>/instance-based', methods=['PUT'])
    @requires_role('instructor', 'admin')
    @requires_ownership(Course(), id_param='id', owner_field='instructor_id')
    def update_course_instance(id):
        return jsonify({'message': 'Updated successfully (instance)', 'course_id': id}), 200

    return app


@pytest.fixture
def dummy_client(mock_mongodb):
    app = create_dummy_app()
    return app.test_client()


# ==========================================
# 1. AUTHENTICATION & ROLE DECORATOR TESTS
# ==========================================

class TestRequiresRoleDecorator:

    def test_missing_auth_header(self, dummy_client):
        res = dummy_client.get('/test/instructor-only')
        assert res.status_code == 401
        assert 'Authentication token is required' in res.get_json()['error']

    def test_malformed_auth_header_scheme(self, dummy_client, auth_headers):
        res = dummy_client.get('/test/instructor-only', headers=auth_headers['no_scheme'])
        assert res.status_code == 401
        assert 'Invalid authorization header format' in res.get_json()['error']

    def test_malformed_jwt_token(self, dummy_client, auth_headers):
        res = dummy_client.get('/test/instructor-only', headers=auth_headers['malformed'])
        assert res.status_code == 401
        assert 'invalid or has expired' in res.get_json()['error']

    def test_expired_jwt_token(self, dummy_client, auth_headers):
        res = dummy_client.get('/test/instructor-only', headers=auth_headers['expired'])
        assert res.status_code == 401
        assert 'invalid or has expired' in res.get_json()['error']

    def test_student_forbidden_from_instructor_route(self, dummy_client, auth_headers):
        res = dummy_client.get('/test/instructor-only', headers=auth_headers['student_1'])
        assert res.status_code == 403
        assert 'Forbidden: Insufficient permissions' in res.get_json()['error']

    def test_instructor_permitted_on_instructor_route(self, dummy_client, auth_headers, topology):
        res = dummy_client.get('/test/instructor-only', headers=auth_headers['instructor_1'])
        assert res.status_code == 200
        assert res.get_json()['user_id'] == topology['instructor_1_id']

    def test_multi_role_allows_instructor_and_admin(self, dummy_client, auth_headers):
        res_inst = dummy_client.get('/test/multi-role', headers=auth_headers['instructor_1'])
        assert res_inst.status_code == 200
        assert res_inst.get_json()['role'] == 'instructor'

        res_admin = dummy_client.get('/test/multi-role', headers=auth_headers['admin'])
        assert res_admin.status_code == 200
        assert res_admin.get_json()['role'] == 'admin'

    def test_multi_role_blocks_student(self, dummy_client, auth_headers):
        res_stud = dummy_client.get('/test/multi-role', headers=auth_headers['student_1'])
        assert res_stud.status_code == 403


# ==========================================
# 2. RESOURCE OWNERSHIP & REGRESSION TESTS
# ==========================================

class TestRequiresOwnershipDecorator:

    def test_owner_can_access_own_course_class_based(self, dummy_client, auth_headers, topology):
        course_id = topology['course_1_id']
        res = dummy_client.put(f'/test/course/{course_id}/class-based', headers=auth_headers['instructor_1'])
        assert res.status_code == 200
        assert res.get_json()['course_id'] == course_id

    def test_owner_can_access_own_course_instance_based_regression(self, dummy_client, auth_headers, topology):
        """
        Regression Test: Verifies @requires_ownership(Course()) passed as an instance
        resolves find_by_id correctly without TypeError or AttributeError.
        """
        course_id = topology['course_1_id']
        res = dummy_client.put(f'/test/course/{course_id}/instance-based', headers=auth_headers['instructor_1'])
        assert res.status_code == 200
        assert res.get_json()['course_id'] == course_id

    def test_non_owner_instructor_is_forbidden(self, dummy_client, auth_headers, topology):
        """Instructor 2 attempts to update Course 1 owned by Instructor 1 -> 403 Forbidden"""
        course_1_id = topology['course_1_id']
        res = dummy_client.put(f'/test/course/{course_1_id}/class-based', headers=auth_headers['instructor_2'])
        assert res.status_code == 403
        assert 'Forbidden: You do not have permission' in res.get_json()['error']

    def test_admin_bypass_on_instructor_course(self, dummy_client, auth_headers, topology):
        """Admin can modify Course 1 regardless of instructor ownership"""
        course_1_id = topology['course_1_id']
        res = dummy_client.put(f'/test/course/{course_1_id}/class-based', headers=auth_headers['admin'])
        assert res.status_code == 200

    def test_non_existent_resource_returns_404(self, dummy_client, auth_headers):
        fake_id = str(ObjectId())
        res = dummy_client.put(f'/test/course/{fake_id}/class-based', headers=auth_headers['instructor_1'])
        assert res.status_code == 404
        assert 'Resource not found' in res.get_json()['error']


# ==========================================
# 3. STUDENT DATA PRIVACY BOUNDARY TESTS
# ==========================================

class TestStudentDataAccessBoundary:

    def test_student_accesses_self_permitted(self, topology):
        allowed = check_student_data_access(
            requesting_user_id=topology['student_1_id'],
            requesting_role='student',
            target_student_id=topology['student_1_id']
        )
        assert allowed is True

    def test_student_accesses_other_student_forbidden(self, topology):
        with pytest.raises(PermissionError) as exc_info:
            check_student_data_access(
                requesting_user_id=topology['student_1_id'],
                requesting_role='student',
                target_student_id=topology['student_2_id']
            )
        assert 'cannot access data for student' in str(exc_info.value)

    def test_instructor_accesses_enrolled_student_permitted(self, topology):
        """Instructor 1 accessing Student 1 (enrolled in Course 1 owned by Inst 1) -> Allowed"""
        allowed = check_student_data_access(
            requesting_user_id=topology['instructor_1_id'],
            requesting_role='instructor',
            target_student_id=topology['student_1_id'],
            course_id=topology['course_1_id']
        )
        assert allowed is True

    def test_instructor_accesses_unenrolled_student_forbidden(self, topology):
        """Instructor 2 accessing Student 1 (NOT enrolled in any course of Inst 2) -> Blocked"""
        with pytest.raises(PermissionError) as exc_info:
            check_student_data_access(
                requesting_user_id=topology['instructor_2_id'],
                requesting_role='instructor',
                target_student_id=topology['student_1_id']
            )
        assert 'not enrolled in any course taught by instructor' in str(exc_info.value)

    def test_admin_accesses_any_student_permitted(self, topology):
        """Admin has global oversight over all student records"""
        allowed = check_student_data_access(
            requesting_user_id=topology['admin_id'],
            requesting_role='admin',
            target_student_id=topology['student_2_id']
        )
        assert allowed is True

    def test_internal_system_task_permitted(self, topology):
        """Background retraining scripts with internal_system_call=True are allowed with audit log"""
        allowed = check_student_data_access(
            target_student_id=topology['student_1_id'],
            internal_system_call=True
        )
        assert allowed is True
