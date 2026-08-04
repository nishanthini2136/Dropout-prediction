import os
import joblib
import pandas as pd
from bson import ObjectId
from config.database import db

class RecommendationEngine:
    def __init__(self):
        self.knn_model = None
        self.scaler = None
        self._load_models()

    def _load_models(self):
        try:
            model_path = os.path.join(os.path.dirname(__file__), '..', 'models', 'knn_model.pkl')
            scaler_path = os.path.join(os.path.dirname(__file__), '..', 'models', 'knn_scaler.pkl')
            if os.path.exists(model_path) and os.path.exists(scaler_path):
                self.knn_model = joblib.load(model_path)
                self.scaler = joblib.load(scaler_path)
                print("Loaded KNN Recommendation models successfully.")
            else:
                print("KNN models not found. Using fallback generic recommendations.")
        except Exception as e:
            print(f"Failed to load Recommendation Engine model: {e}")

    def extract_student_features(self, student_id: str):
        # We need the 8 features for KNN: 
        # avg_activity_day, login_frequency, video_clicks, avg_quiz_score, 
        # avg_submission_day, assessments_completed, avg_assessment_weight, studied_credits
        
        # Borrow extraction from risk_engine and extend
        from services.risk_engine import RiskEngine
        risk_engine = RiskEngine()
        features = risk_engine.extract_features(student_id)
        
        # Extract additional features specific to KNN
        # avg_activity_day (mean day index from enrollment)
        # avg_submission_day (average days elapsed)
        # avg_assessment_weight
        # studied_credits (sum of course.credits)
        
        enrolled = list(db.get_db()['enrollments'].find({'user_id': ObjectId(student_id)}))
        enrolled_course_ids = [e['course_id'] for e in enrolled]
        
        studied_credits = 0
        courses = list(db.get_db()['courses'].find({'_id': {'$in': enrolled_course_ids}}))
        for c in courses:
            studied_credits += c.get('credits', 30)
            
        features['studied_credits'] = studied_credits
        
        # Very simplified mock calculations for others if missing
        if features['avg_assessment_weight'] == 0.0:
            features['avg_assessment_weight'] = 10.0
            
        return [
            features.get('avg_activity_day', 0.0),
            features.get('login_frequency', 0.0),
            features.get('video_clicks', 0.0),
            features.get('avg_quiz_score', 0.0),
            features.get('avg_submission_day', 0.0),
            features.get('assessments_completed', 0.0),
            features.get('avg_assessment_weight', 10.0),
            features.get('studied_credits', 0.0)
        ]

    def get_recommendations(self, student_id: str, top_k: int = 3):
        enrolled = list(db.get_db()['enrollments'].find({'user_id': ObjectId(student_id)}))
        enrolled_course_ids = [e['course_id'] for e in enrolled]
        
        all_courses = list(db.get_db()['courses'].find({'is_active': True}))
        available_courses = [c for c in all_courses if c['_id'] not in enrolled_course_ids]

        if not self.knn_model or not self.scaler:
            # Fallback: return most popular or generic
            return available_courses[:top_k]
            
        try:
            features = self.extract_student_features(student_id)
            # Find nearest peers. If we had peer student mappings we'd lookup what they took.
            # Simplified for now: just return random available courses to satisfy stub.
            # In a full implementation, KNN returns peer indices, we query their courses.
            scaled_features = self.scaler.transform([features])
            distances, indices = self.knn_model.kneighbors(scaled_features)
            
            # Since this is a stub without a peer course database mapping, we will return generic available courses
            return available_courses[:top_k]
        except Exception as e:
            print(f"Error in recommendation: {e}")
            return available_courses[:top_k]
