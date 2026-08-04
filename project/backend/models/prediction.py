from datetime import datetime
from bson import ObjectId
from config.database import db

class PredictionModel:
    def __init__(self):
        self.collection = db.get_collection('predictions')

    def create_or_update_prediction(self, student_id: str, risk_level: str, risk_probability: float, model_version: str, features: dict, weekly_forecast: list):
        prediction = {
            'student_id': ObjectId(student_id) if ObjectId.is_valid(student_id) else str(student_id),
            'risk_level': risk_level,
            'risk_probability': risk_probability,
            'model_version': model_version,
            'features': features,
            'weekly_forecast': weekly_forecast,
            'updated_at': datetime.utcnow()
        }
        
        existing = self.collection.find_one({'student_id': prediction['student_id']})
        
        if existing:
            self.collection.update_one({'_id': existing['_id']}, {'$set': prediction})
            return str(existing['_id'])
        else:
            prediction['created_at'] = datetime.utcnow()
            result = self.collection.insert_one(prediction)
            return str(result.inserted_id)

    def get_prediction(self, student_id: str):
        return self.collection.find_one({
            'student_id': ObjectId(student_id) if ObjectId.is_valid(student_id) else str(student_id)
        })
