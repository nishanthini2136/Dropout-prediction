from datetime import datetime
from bson import ObjectId
from config.database import db

class Course:
    VALID_STATUSES = ['draft', 'pending_review', 'published', 'rejected', 'archived']

    def __init__(self):
        self.collection = db.get_db()['courses']
    
    def create_course(self, course_data):
        course_data['created_at'] = datetime.utcnow()
        course_data['updated_at'] = datetime.utcnow()

        # Handle is_active flag
        if 'is_active' in course_data:
            if isinstance(course_data['is_active'], str):
                course_data['is_active'] = course_data['is_active'].lower() == 'true'
        else:
            course_data['is_active'] = True

        # Handle instructor_id (ObjectId reference to users)
        if 'instructor_id' in course_data and course_data['instructor_id']:
            inst_id = course_data['instructor_id']
            course_data['instructor_id'] = ObjectId(inst_id) if ObjectId.is_valid(inst_id) else inst_id
        else:
            course_data['instructor_id'] = None

        # Handle course publication status
        status = course_data.get('status')
        if status:
            if status not in self.VALID_STATUSES:
                raise ValueError(f"Invalid status: '{status}'. Must be one of {self.VALID_STATUSES}")
            course_data['status'] = status
        else:
            # If an instructor creates it, default to 'draft'; if admin creates directly, default to 'published'
            course_data['status'] = 'draft' if course_data.get('instructor_id') else 'published'

        # Admin review feedback fields
        course_data['reviewed_by'] = None
        course_data['rejection_reason'] = None
            
        if 'credits' not in course_data:
            course_data['credits'] = 30 # default credits

        result = self.collection.insert_one(course_data)
        return str(result.inserted_id)
    
    def find_by_id(self, course_id):
        if not course_id:
            return None
        q_id = ObjectId(course_id) if ObjectId.is_valid(course_id) else course_id
        return self.collection.find_one({'_id': q_id})
    
    def get_all_courses(self, active_only=True, published_only=True):
        """
        Retrieves courses with backward compatibility for existing records.
        For student/public catalogs, fetches active and published courses.
        """
        query = {}
        if active_only:
            query['is_active'] = True

        if published_only:
            # Match courses that are either explicitly 'published' or legacy records without status field
            query['$or'] = [
                {'status': 'published'},
                {'status': {'$exists': False}}
            ]

        return list(self.collection.find(query))
    
    def get_courses_by_instructor(self, instructor_id):
        """
        Retrieves all courses belonging to a specific instructor across all statuses.
        """
        inst_match = ObjectId(instructor_id) if ObjectId.is_valid(instructor_id) else instructor_id
        query = {
            '$or': [
                {'instructor_id': inst_match},
                {'instructor_id': str(instructor_id)}
            ]
        }
        return list(self.collection.find(query).sort('updated_at', -1))
    
    def get_pending_review_courses(self):
        """
        Retrieves all courses submitted by instructors awaiting admin approval.
        """
        return list(self.collection.find({'status': 'pending_review'}).sort('updated_at', -1))
    
    def update_course(self, course_id, update_data):
        update_data['updated_at'] = datetime.utcnow()
        if 'status' in update_data and update_data['status'] not in self.VALID_STATUSES:
            raise ValueError(f"Invalid status: '{update_data['status']}'. Must be one of {self.VALID_STATUSES}")
        
        if 'instructor_id' in update_data and update_data['instructor_id']:
            inst_id = update_data['instructor_id']
            update_data['instructor_id'] = ObjectId(inst_id) if ObjectId.is_valid(inst_id) else inst_id

        q_id = ObjectId(course_id) if ObjectId.is_valid(course_id) else course_id
        result = self.collection.update_one(
            {'_id': q_id},
            {'$set': update_data}
        )
        return result.modified_count > 0
    
    def update_status(self, course_id, status, reviewed_by=None, rejection_reason=None):
        """
        Transition course status (e.g., draft -> pending_review, pending_review -> published/rejected).
        """
        if status not in self.VALID_STATUSES:
            raise ValueError(f"Invalid status: '{status}'. Must be one of {self.VALID_STATUSES}")
        
        update_fields = {
            'status': status,
            'updated_at': datetime.utcnow()
        }
        
        if reviewed_by:
            rev_id = ObjectId(reviewed_by) if ObjectId.is_valid(reviewed_by) else reviewed_by
            update_fields['reviewed_by'] = rev_id
            
        if rejection_reason is not None:
            update_fields['rejection_reason'] = rejection_reason
        elif status == 'published':
            # Clear previous rejection reason on approval
            update_fields['rejection_reason'] = None

        q_id = ObjectId(course_id) if ObjectId.is_valid(course_id) else course_id
        result = self.collection.update_one(
            {'_id': q_id},
            {'$set': update_fields}
        )
        return result.modified_count > 0

    def delete_course(self, course_id):
        q_id = ObjectId(course_id) if ObjectId.is_valid(course_id) else course_id
        result = self.collection.delete_one({'_id': q_id})
        return result.deleted_count > 0
    
    def get_course_count(self, status=None):
        query = {'is_active': True}
        if status:
            query['status'] = status
        return self.collection.count_documents(query)
    
    def search_courses(self, search_term=None, category=None, difficulty=None, published_only=True):
        query = {'is_active': True}
        
        if published_only:
            query['$or'] = [
                {'status': 'published'},
                {'status': {'$exists': False}}
            ]
        
        if search_term:
            search_clause = [
                {'title': {'$regex': search_term, '$options': 'i'}},
                {'description': {'$regex': search_term, '$options': 'i'}}
            ]
            if '$or' in query:
                query = {'$and': [{'$or': query['$or']}, {'$or': search_clause}]}
            else:
                query['$or'] = search_clause
        
        if category:
            query['category'] = category
        
        if difficulty:
            query['difficulty'] = difficulty
        
        return list(self.collection.find(query))
