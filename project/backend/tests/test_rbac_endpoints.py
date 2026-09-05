import pytest
from bson import ObjectId


# ==========================================
# 1. REGISTRATION ROLE HARDENING TESTS
# ==========================================

class TestRegistrationRoleHardening:

    def test_student_self_registration_allowed(self, client, mock_mongodb):
        payload = {
            'name': 'New Student',
            'email': 'newstudent@example.com',
            'password': 'Password@123',
            'role': 'student'
        }
        res = client.post('/api/auth/register', json=payload)
        assert res.status_code == 201
        data = res.get_json()
        assert 'user_id' in data
        
        # Verify user was created in database with role 'student'
        created_user = mock_mongodb['users'].find_one({'email': 'newstudent@example.com'})
        assert created_user is not None
        assert created_user['role'] == 'student'
        assert created_user['name'] == 'New Student'

    def test_instructor_self_registration_rejected(self, client):
        """
        Security Hardening: Public self-registration must reject role='instructor'
        to prevent unauthorized privilege escalation.
        """
        payload = {
            'name': 'Malicious Instructor',
            'email': 'fakeinstructor@example.com',
            'password': 'Password@123',
            'role': 'instructor'
        }
        res = client.post('/api/auth/register', json=payload)
        assert res.status_code == 400
        assert 'restricted to students' in res.get_json()['error']

    def test_admin_self_registration_rejected(self, client):
        """
        Security Hardening: Public self-registration must reject role='admin'.
        """
        payload = {
            'name': 'Malicious Admin',
            'email': 'fakeadmin@example.com',
            'password': 'Password@123',
            'role': 'admin'
        }
        res = client.post('/api/auth/register', json=payload)
        assert res.status_code == 400
        assert 'restricted to students' in res.get_json()['error']


# ==========================================
# 2. ADMIN CONTROL CENTER BOUNDARY TESTS
# ==========================================

class TestAdminControlCenterBoundaries:

    def test_audit_logs_unauthenticated_returns_401(self, client):
        res = client.get('/api/admin/audit-logs')
        assert res.status_code == 401

    def test_audit_logs_student_forbidden_403(self, client, auth_headers):
        res = client.get('/api/admin/audit-logs', headers=auth_headers['student_1'])
        assert res.status_code == 403

    def test_audit_logs_instructor_forbidden_403(self, client, auth_headers):
        res = client.get('/api/admin/audit-logs', headers=auth_headers['instructor_1'])
        assert res.status_code == 403

    def test_audit_logs_admin_allowed_200(self, client, auth_headers):
        res = client.get('/api/admin/audit-logs', headers=auth_headers['admin'])
        assert res.status_code == 200
        data = res.get_json()
        assert 'logs' in data

    def test_instructor_directory_accessible_only_by_admin(self, client, auth_headers):
        # Student -> 403
        res_stud = client.get('/api/admin/instructors', headers=auth_headers['student_1'])
        assert res_stud.status_code == 403

        # Instructor -> 403
        res_inst = client.get('/api/admin/instructors', headers=auth_headers['instructor_1'])
        assert res_inst.status_code == 403

        # Admin -> 200
        res_admin = client.get('/api/admin/instructors', headers=auth_headers['admin'])
        assert res_admin.status_code == 200
        assert 'instructors' in res_admin.get_json()

    def test_provision_instructor_accessible_only_by_admin(self, client, auth_headers):
        payload = {
            'name': 'Dr. Alan Turing',
            'email': 'alan.turing@university.edu',
            'password': 'TempPassword@123',
            'phone': '1234567890',
            'bio': 'Computer Science Pioneer'
        }

        # Instructor attempting provisioning -> 403
        res_inst = client.post('/api/admin/instructors', json=payload, headers=auth_headers['instructor_1'])
        assert res_inst.status_code == 403

        # Admin provisioning -> 201
        res_admin = client.post('/api/admin/instructors', json=payload, headers=auth_headers['admin'])
        assert res_admin.status_code == 201
        assert res_admin.get_json()['instructor']['email'] == 'alan.turing@university.edu'

    def test_course_approval_action_restricted_to_admin(self, client, auth_headers, topology, mock_mongodb):
        course_id = topology['course_1_id']
        
        # Set course status to 'pending_review' as required by the lifecycle state machine
        mock_mongodb['courses'].update_one(
            {'_id': ObjectId(course_id)},
            {'$set': {'status': 'pending_review'}}
        )
        
        # Instructor attempting to approve course -> 403 Forbidden
        res_inst = client.post(f'/api/admin/courses/{course_id}/approve', headers=auth_headers['instructor_1'])
        assert res_inst.status_code == 403

        # Admin approving course -> 200 OK and status transitions to 'published'
        res_admin = client.post(f'/api/admin/courses/{course_id}/approve', headers=auth_headers['admin'])
        assert res_admin.status_code == 200
        assert res_admin.get_json()['course']['status'] == 'published'


# ==========================================
# 3. INSTRUCTOR STUDIO & ISOLATION TESTS
# ==========================================

class TestInstructorStudioAndIsolation:

    def test_student_cannot_create_courses(self, client, auth_headers):
        payload = {'title': 'Unauthorized Student Course'}
        res = client.post('/api/instructor/courses', json=payload, headers=auth_headers['student_1'])
        assert res.status_code == 403

    def test_instructor_creates_course_draft_auto_assigns_owner(self, client, auth_headers, topology):
        payload = {
            'title': 'New Python Course',
            'description': 'Beginner Python',
            'category': 'Programming',
            'difficulty': 'Beginner',
            'credits': 30
        }
        res = client.post('/api/instructor/courses', json=payload, headers=auth_headers['instructor_1'])
        assert res.status_code == 201
        course = res.get_json()['course']
        assert course['title'] == 'New Python Course'
        assert course['status'] == 'draft'
        assert course['instructor_id'] == topology['instructor_1_id']

    def test_instructor_isolation_course_detail_and_update(self, client, auth_headers, topology):
        course_1_id = topology['course_1_id']

        # 1. Owner Instructor 1 gets Course 1 -> 200
        res_owner = client.get(f'/api/instructor/courses/{course_1_id}', headers=auth_headers['instructor_1'])
        assert res_owner.status_code == 200

        # 2. Non-owner Instructor 2 attempts get Course 1 -> 403
        res_intruder_get = client.get(f'/api/instructor/courses/{course_1_id}', headers=auth_headers['instructor_2'])
        assert res_intruder_get.status_code == 403

        # 3. Non-owner Instructor 2 attempts update Course 1 -> 403
        res_intruder_put = client.put(
            f'/api/instructor/courses/{course_1_id}',
            json={'title': 'Tampered Course Title'},
            headers=auth_headers['instructor_2']
        )
        assert res_intruder_put.status_code == 403

        # 4. Admin bypasses and reads/updates Course 1 -> 200
        res_admin_put = client.put(
            f'/api/instructor/courses/{course_1_id}',
            json={'title': 'Admin Updated Title'},
            headers=auth_headers['admin']
        )
        assert res_admin_put.status_code == 200

    def test_instructor_courses_list_scoped_to_authenticated_instructor(self, client, auth_headers, topology):
        # Instructor 1 sees only course_1
        res_inst1 = client.get('/api/instructor/courses', headers=auth_headers['instructor_1'])
        assert res_inst1.status_code == 200
        inst1_courses = res_inst1.get_json()['courses']
        assert all(c['instructor_id'] == topology['instructor_1_id'] for c in inst1_courses)

        # Instructor 2 sees only course_2
        res_inst2 = client.get('/api/instructor/courses', headers=auth_headers['instructor_2'])
        assert res_inst2.status_code == 200
        inst2_courses = res_inst2.get_json()['courses']
        assert all(c['instructor_id'] == topology['instructor_2_id'] for c in inst2_courses)


# ==========================================
# 4. TOKEN LIFECYCLE ON PROTECTED ENDPOINTS
# ==========================================

class TestTokenLifecycleOnProtectedEndpoints:

    def test_expired_token_returns_401(self, client, auth_headers):
        res = client.get('/api/instructor/courses', headers=auth_headers['expired'])
        assert res.status_code == 401
        assert 'invalid or has expired' in res.get_json()['error']

    def test_malformed_token_returns_401(self, client, auth_headers):
        res = client.get('/api/instructor/courses', headers=auth_headers['malformed'])
        assert res.status_code == 401
        assert 'invalid or has expired' in res.get_json()['error']
