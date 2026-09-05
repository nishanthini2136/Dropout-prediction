from functools import wraps
from flask import request, jsonify
from bson import ObjectId
from utils.auth import AuthUtils

def requires_role(*roles):
    """
    Role-Based Access Control (RBAC) decorator.
    Enforces that the authenticated user possesses one of the allowed roles.
    
    Usage:
        @requires_role('instructor', 'admin')
        def create_course():
            ...
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            token = None
            
            # 1. Extract Bearer token from Authorization header
            if 'Authorization' in request.headers:
                auth_header = request.headers['Authorization']
                parts = auth_header.split(' ')
                if len(parts) == 2 and parts[0].lower() == 'bearer':
                    token = parts[1]
                else:
                    return jsonify({'error': 'Invalid authorization header format. Expected Bearer <token>'}), 401
            
            if not token:
                return jsonify({'error': 'Authentication token is required'}), 401
            
            # 2. Decode and validate JWT payload
            payload = AuthUtils.decode_token(token)
            if not payload:
                return jsonify({'error': 'Authentication token is invalid or has expired'}), 401
            
            user_id = payload.get('user_id')
            user_role = payload.get('role')
            
            # 3. Attach user context to request for downstream handlers
            request.current_user_id = str(user_id)
            request.current_user_role = user_role
            request.current_user = {
                'id': str(user_id),
                'role': user_role
            }
            
            # 4. Enforce role permissions
            if roles and user_role not in roles:
                allowed = ', '.join(roles)
                return jsonify({
                    'error': f'Forbidden: Insufficient permissions. Required role(s): [{allowed}], your role: {user_role}'
                }), 403
            
            return f(*args, **kwargs)
        return decorated
    return decorator


def requires_ownership(model_or_class, id_param='id', owner_field='instructor_id'):
    """
    Resource ownership decorator.
    Verifies that the resource identified by `id_param` is owned by current_user.id,
    unless the current user's role is 'admin' (admin bypass).
    
    Parameters:
        model_or_class: A model instance, model class, or object with find_by_id / collection
        id_param: URL parameter name containing the resource ID (default 'id')
        owner_field: Field name on the document storing owner ID (default 'instructor_id')
        
    Usage:
        @requires_role('instructor', 'admin')
        @requires_ownership(Course, id_param='id', owner_field='instructor_id')
        def update_course(id):
            # Access fetched resource via request.resource
            ...
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            # 1. Ensure user is authenticated (populated by requires_role or token_required)
            current_user_id = getattr(request, 'current_user_id', None)
            current_user_role = getattr(request, 'current_user_role', None)
            
            if not current_user_id:
                # Fallback check if token is present in header
                auth_header = request.headers.get('Authorization', '')
                if auth_header.startswith('Bearer '):
                    payload = AuthUtils.decode_token(auth_header.split(' ')[1])
                    if payload:
                        current_user_id = str(payload.get('user_id'))
                        current_user_role = payload.get('role')
                        request.current_user_id = current_user_id
                        request.current_user_role = current_user_role
                        request.current_user = {'id': current_user_id, 'role': current_user_role}

            if not current_user_id:
                return jsonify({'error': 'Authentication required'}), 401

            # 2. Extract resource ID from view args, kwargs, query parameters, or JSON body
            resource_id = kwargs.get(id_param) or (request.view_args.get(id_param) if request.view_args else None)
            if not resource_id:
                resource_id = request.args.get(id_param)
            if not resource_id and request.is_json:
                resource_id = request.get_json(silent=True, default={}).get(id_param)
                
            if not resource_id:
                return jsonify({'error': f'Missing resource identifier parameter: {id_param}'}), 400

            # 3. Retrieve the target resource from model / database
            model_instance = model_or_class() if isinstance(model_or_class, type) else model_or_class
            try:
                resource = model_instance.find_by_id(resource_id)
            except Exception as e:
                return jsonify({'error': f'Failed to query resource: {str(e)}'}), 500

            if not resource:
                return jsonify({'error': 'Resource not found'}), 404

            # 4. Admin bypass check
            if current_user_role == 'admin':
                request.resource = resource
                return f(*args, **kwargs)

            # 5. Check resource ownership
            resource_owner = resource.get(owner_field)
            if resource_owner is None:
                # If resource has no owner specified, restrict to admin only
                return jsonify({'error': 'Forbidden: Resource has no assigned owner and cannot be modified'}), 403

            if str(resource_owner) != str(current_user_id):
                return jsonify({
                    'error': 'Forbidden: You do not have permission to access or modify this resource'
                }), 403

            # Attach resource to request for zero-redundancy database access
            request.resource = resource
            return f(*args, **kwargs)
        return decorated
    return decorator


def check_student_data_access(requesting_user_id: str = None, requesting_role: str = None, target_student_id: str = None, course_id: str = None, internal_system_call: bool = False) -> bool:
    """
    Strictly enforces authorization boundaries for student academic, progress, and risk data:
    1. Explicit Internal System Task (`internal_system_call=True`) -> Allowed with audit trace.
    2. Admin -> Allowed unconditionally across all students.
    3. Student -> Allowed ONLY if requesting_user_id == target_student_id.
    4. Instructor -> Allowed ONLY if target_student_id is enrolled in a course owned by requesting_user_id (scoped to course_id if provided).
    5. Fails closed (PermissionError) if user context is missing inside an active HTTP request.
    """
    from flask import has_request_context

    # 1. Explicit internal system task opt-in (e.g. LSTM batch retraining script)
    if internal_system_call:
        print(f"[RBAC] Explicit internal system execution permitted for target_student={target_student_id}")
        return True

    # 2. Auto-resolve context from active Flask request if not explicitly passed by caller
    if has_request_context():
        if not requesting_user_id:
            requesting_user_id = getattr(request, 'current_user_id', None)
        if not requesting_role:
            requesting_role = getattr(request, 'current_user_role', None)
        
        # In a web request context, missing user credentials fails CLOSED
        if not requesting_user_id or not requesting_role:
            raise PermissionError("Forbidden: Unauthenticated or missing user context for student data access")
    else:
        # Offline script / CLI task execution (outside Flask request context)
        if not requesting_user_id and not requesting_role:
            print(f"[RBAC] Out-of-request offline task execution for target_student={target_student_id}")
            return True

    if requesting_role == 'admin':
        return True

    s_str = str(target_student_id)
    u_str = str(requesting_user_id)

    # 3. Student caller: strictly restricted to self
    if requesting_role == 'student':
        if u_str != s_str:
            raise PermissionError(f"Forbidden: Student {u_str} cannot access data for student {s_str}")
        return True

    # 4. Instructor caller: strictly restricted to students enrolled in own courses
    if requesting_role == 'instructor':
        from config.database import db
        database = db.get_db()
        inst_oid = ObjectId(u_str) if ObjectId.is_valid(u_str) else u_str
        stud_match = {'$in': [ObjectId(s_str), s_str]} if ObjectId.is_valid(s_str) else s_str

        # If scoped to a specific course_id
        if course_id:
            c_oid = ObjectId(course_id) if ObjectId.is_valid(str(course_id)) else str(course_id)
            course = database['courses'].find_one({
                '_id': c_oid,
                '$or': [{'instructor_id': inst_oid}, {'instructor_id': u_str}]
            })
            if not course:
                raise PermissionError(f"Forbidden: Instructor {u_str} does not own course {course_id}")

            enrollment = database['enrollments'].find_one({
                'course_id': {'$in': [c_oid, str(course_id)]},
                '$or': [{'student_id': stud_match}, {'user_id': stud_match}]
            })
            if not enrollment:
                raise PermissionError(f"Forbidden: Student {s_str} is not enrolled in instructor's course {course_id}")
            return True

        # If querying overall student data, check if student is enrolled in ANY course owned by this instructor
        inst_courses = list(database['courses'].find(
            {'$or': [{'instructor_id': inst_oid}, {'instructor_id': u_str}]},
            {'_id': 1}
        ))
        if not inst_courses:
            raise PermissionError(f"Forbidden: Instructor {u_str} has no courses")

        inst_c_ids = [c['_id'] for c in inst_courses]
        enrollment = database['enrollments'].find_one({
            'course_id': {'$in': inst_c_ids + [str(cid) for cid in inst_c_ids]},
            '$or': [{'student_id': stud_match}, {'user_id': stud_match}]
        })
        if not enrollment:
            raise PermissionError(f"Forbidden: Student {s_str} is not enrolled in any course taught by instructor {u_str}")
        return True

    raise PermissionError(f"Forbidden: Role '{requesting_role}' is not authorized to access student data")

