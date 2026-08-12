from datetime import datetime
from bson import ObjectId
from config.database import db

class PredictionModel:
    def __init__(self):
        self.collection = db.get_collection('predictions')
        self.history_collection = db.get_collection('prediction_history')

    def create_or_update_prediction(self, student_id: str, course_id: str, risk_level: str, risk_probability: float, model_version: str, features: dict, weekly_forecast: list, forecast_type: str = "placeholder"):
        s_id = ObjectId(student_id) if ObjectId.is_valid(student_id) else str(student_id)
        c_id = ObjectId(course_id) if course_id and ObjectId.is_valid(course_id) else str(course_id) if course_id else None
        
        prediction = {
            'student_id': s_id,
            'course_id': c_id,
            'risk_level': risk_level,
            'risk_probability': risk_probability,
            'model_version': model_version,
            'features': features,
            'weekly_forecast': weekly_forecast,
            'forecast_type': forecast_type,
            'updated_at': datetime.utcnow()
        }
        
        query = {'student_id': s_id, 'course_id': c_id} if c_id else {'student_id': s_id}
            
        existing = self.collection.find_one(query)
        
        if existing:
            self.collection.update_one({'_id': existing['_id']}, {'$set': prediction})
            pred_id = str(existing['_id'])
        else:
            prediction['created_at'] = datetime.utcnow()
            result = self.collection.insert_one(prediction)
            pred_id = str(result.inserted_id)

        # Log into prediction_history for real trend analysis over time
        history_entry = {
            'student_id': s_id,
            'course_id': c_id,
            'risk_level': risk_level,
            'risk_probability': risk_probability,
            'created_at': datetime.utcnow()
        }
        self.history_collection.insert_one(history_entry)

        return pred_id

    def get_prediction(self, student_id: str, course_id: str = None):
        student_match = {'$in': [ObjectId(student_id), str(student_id)]} if ObjectId.is_valid(student_id) else str(student_id)
        if course_id:
            course_match = {'$in': [ObjectId(course_id), str(course_id)]} if ObjectId.is_valid(course_id) else str(course_id)
            return self.collection.find_one({
                'student_id': student_match,
                'course_id': course_match
            })
        else:
            return list(self.collection.find({'student_id': student_match}))

    def get_prediction_history(self, student_id: str, course_id: str = None, limit: int = 20):
        student_match = {'$in': [ObjectId(student_id), str(student_id)]} if ObjectId.is_valid(student_id) else str(student_id)
        query = {'student_id': student_match}
        if course_id:
            course_match = {'$in': [ObjectId(course_id), str(course_id)]} if ObjectId.is_valid(course_id) else str(course_id)
            query['course_id'] = course_match
        return list(self.history_collection.find(query).sort('created_at', 1).limit(limit))

