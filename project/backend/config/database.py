import os
import certifi
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv(override=True)

class Database:
    def __init__(self):
        self.client = None
        self.db = None
        self._indexes_ensured = False
    
    def connect(self):
        try:
            uri = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017/elearning_db')
            kwargs = {}
            if 'mongodb+srv://' in uri or 'tls=true' in uri.lower() or 'ssl=true' in uri.lower():
                kwargs['tlsCAFile'] = certifi.where()
            try:
                self.client = MongoClient(uri, **kwargs)
            except Exception:
                self.client = MongoClient(uri)

            try:
                self.db = self.client.get_default_database()
            except Exception:
                self.db = self.client['elearning_db']
            if self.db is None:
                self.db = self.client['elearning_db']
            print(f"Connected to MongoDB database '{self.db.name}' successfully")
            if not self._indexes_ensured:
                self.ensure_indexes()
            return True
        except Exception as e:
            print(f"Error connecting to MongoDB: {e}")
            return False

    def ensure_indexes(self):
        if self._indexes_ensured or self.db is None:
            return
        try:
            # 1. users
            self.db['users'].create_index([('email', 1)], unique=True, sparse=True)
            self.db['users'].create_index([('role', 1)])

            # 2. courses
            self.db['courses'].create_index([('is_active', 1)])
            self.db['courses'].create_index([('category', 1)])
            self.db['courses'].create_index([('difficulty', 1)])

            # 3. enrollments
            self.db['enrollments'].create_index([('user_id', 1)])
            self.db['enrollments'].create_index([('student_id', 1)])
            self.db['enrollments'].create_index([('course_id', 1)])
            self.db['enrollments'].create_index([('student_id', 1), ('course_id', 1)])
            self.db['enrollments'].create_index([('user_id', 1), ('course_id', 1)])

            # 4. progress
            self.db['progress'].create_index([('user_id', 1)])
            self.db['progress'].create_index([('course_id', 1)])
            self.db['progress'].create_index([('module_id', 1)])
            self.db['progress'].create_index([('user_id', 1), ('course_id', 1)])
            self.db['progress'].create_index([('user_id', 1), ('module_id', 1)])
            self.db['progress'].create_index([('user_id', 1), ('course_id', 1), ('module_id', 1)])

            # 5. quiz_attempts
            self.db['quiz_attempts'].create_index([('student_id', 1)])
            self.db['quiz_attempts'].create_index([('course_id', 1)])
            self.db['quiz_attempts'].create_index([('student_id', 1), ('course_id', 1)])

            # 6. submissions
            self.db['submissions'].create_index([('student_id', 1)])
            self.db['submissions'].create_index([('assignment_id', 1)])
            self.db['submissions'].create_index([('student_id', 1), ('assignment_id', 1)])

            # 7. assignments
            self.db['assignments'].create_index([('course_id', 1)])

            # 8. engagement_logs
            self.db['engagement_logs'].create_index([('student_id', 1)])
            self.db['engagement_logs'].create_index([('student_id', 1), ('course_id', 1)])
            self.db['engagement_logs'].create_index([('student_id', 1), ('event_type', 1)])

            # 9. predictions & prediction_history
            self.db['predictions'].create_index([('student_id', 1), ('course_id', 1)])
            self.db['prediction_history'].create_index([('student_id', 1), ('course_id', 1), ('created_at', 1)])

            # 10. roadmaps
            self.db['roadmaps'].create_index([('student_id', 1), ('course_id', 1), ('week_number', 1)])

            # 11. forum_posts & media
            self.db['forum_posts'].create_index([('course_id', 1)])
            self.db['media'].create_index([('course_id', 1), ('module_id', 1)])

            self._indexes_ensured = True
            print("[Database] MongoDB indexes ensured successfully.")
        except Exception as e:
            print(f"[Database] Error ensuring indexes: {e}")
    
    def get_db(self):
        if self.db is None:
            self.connect()
        return self.db

    def get_collection(self, name: str):
        """Shorthand to get a named collection from the connected database."""
        return self.get_db()[name]
    
    def close(self):
        if self.client:
            self.client.close()

db = Database()
