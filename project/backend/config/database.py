import os
import certifi
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv(override=True)

class Database:
    def __init__(self):
        self.client = None
        self.db = None
    
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
            self.ensure_indexes()
            return True
        except Exception as e:
            print(f"Error connecting to MongoDB: {e}")
            return False

    def ensure_indexes(self):
        try:
            if self.db is not None:
                self.db['enrollments'].create_index([('user_id', 1)])
                self.db['enrollments'].create_index([('student_id', 1)])
                self.db['enrollments'].create_index([('course_id', 1)])
                self.db['enrollments'].create_index([('user_id', 1), ('course_id', 1)])
                self.db['progress'].create_index([('user_id', 1)])
                self.db['progress'].create_index([('user_id', 1), ('course_id', 1)])
                self.db['quiz_attempts'].create_index([('student_id', 1)])
                self.db['quiz_attempts'].create_index([('student_id', 1), ('course_id', 1)])
                self.db['submissions'].create_index([('student_id', 1)])
                self.db['engagement_logs'].create_index([('student_id', 1)])
                self.db['engagement_logs'].create_index([('student_id', 1), ('course_id', 1)])
                self.db['predictions'].create_index([('student_id', 1), ('course_id', 1)])
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
