import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

class Database:
    def __init__(self):
        self.client = None
        self.db = None
    
    def connect(self):
        try:
            self.client = MongoClient(os.environ.get('MONGODB_URI', 'mongodb://localhost:27017/'))
            self.db = self.client['elearning_db']
            print("Connected to MongoDB successfully")
            return True
        except Exception as e:
            print(f"Error connecting to MongoDB: {e}")
            return False
    
    def get_db(self):
        if self.db is None:
            self.connect()
        return self.db
    
    def close(self):
        if self.client:
            self.client.close()

db = Database()
