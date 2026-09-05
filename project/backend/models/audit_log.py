from datetime import datetime
from bson import ObjectId
from config.database import db

class AuditLog:
    def __init__(self):
        self.collection = db.get_db()['audit_logs']

    def log_admin_access(self, admin_id: str, action: str, target_user_id: str = None, details: dict = None):
        """
        Records an audit log entry for admin cross-user data access or administrative actions.
        
        Parameters:
            admin_id: User ID of the administrator performing the action
            action: Action identifier (e.g., 'view_student_list', 'recalculate_student_risk', 'approve_course', 'reject_course')
            target_user_id: Optional ID of the student or instructor being accessed/modified
            details: Optional dictionary with extra context (course_id, reason, filters, etc.)
        """
        try:
            a_id = ObjectId(admin_id) if ObjectId.is_valid(str(admin_id)) else str(admin_id)
            t_id = None
            if target_user_id:
                t_id = ObjectId(target_user_id) if ObjectId.is_valid(str(target_user_id)) else str(target_user_id)

            log_doc = {
                'admin_id': a_id,
                'action': action,
                'target_user_id': t_id,
                'details': details or {},
                'timestamp': datetime.utcnow()
            }
            result = self.collection.insert_one(log_doc)
            return str(result.inserted_id)
        except Exception as e:
            # Audit logging failure should not crash the primary operational transaction, but log error to stdout
            print(f"[AuditLog] Failed to record audit log: {e}")
            return None

    def get_logs(self, limit: int = 100, skip: int = 0, action: str = None, admin_id: str = None):
        """
        Retrieves recent audit log entries for compliance and security auditing.
        """
        query = {}
        if action:
            query['action'] = action
        if admin_id:
            a_id = ObjectId(admin_id) if ObjectId.is_valid(str(admin_id)) else str(admin_id)
            query['admin_id'] = a_id

        return list(self.collection.find(query).sort('timestamp', -1).skip(skip).limit(limit))
