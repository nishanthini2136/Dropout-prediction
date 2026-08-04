import os
import joblib
import pandas as pd
from datetime import datetime
from config.database import db
from bson import ObjectId

class RiskEngine:
    def __init__(self):
        self.model_version = "CatBoost_v1.0"
        self.model = None
        self._load_model()

    def _load_model(self):
        try:
            model_path = os.path.join(os.path.dirname(__file__), '..', 'models', 'catboost_model.pkl')
            if os.path.exists(model_path):
                self.model = joblib.load(model_path)
                print(f"Loaded {self.model_version} from {model_path}")
            else:
                print(f"Model not found at {model_path}. Using fallback rule-based predictions.")
        except Exception as e:
            print(f"Failed to load Risk Engine model: {e}")

    def extract_features(self, student_id: str):
        # 1. login_frequency (distinct days with engagement log)
        pipeline_login = [
            {'$match': {'student_id': ObjectId(student_id)}},
            {'$group': {
                '_id': {'$dateToString': {'format': '%Y-%m-%d', 'date': '$timestamp'}},
                'count': {'$sum': 1}
            }}
        ]
        login_days = list(db.get_db()['engagement_logs'].aggregate(pipeline_login))
        login_frequency = len(login_days)

        # 2. video_clicks (total play/watch events)
        video_clicks = db.get_db()['engagement_logs'].count_documents({
            'student_id': ObjectId(student_id),
            'event_type': {'$in': ['play', 'watch']}
        })

        # 3. avg_quiz_score & assessments_completed (from quiz_attempts)
        quiz_attempts = list(db.get_db()['quiz_attempts'].find({'student_id': ObjectId(student_id)}))
        total_quiz_score = sum((q.get('score', 0) / q.get('max_score', 1)) * 100 for q in quiz_attempts if q.get('max_score', 0) > 0)
        avg_quiz_score = total_quiz_score / len(quiz_attempts) if len(quiz_attempts) > 0 else 0.0
        
        # 4. assessments_completed (quizzes + graded assignments)
        graded_assignments = list(db.get_db()['submissions'].find({
            'student_id': ObjectId(student_id),
            'status': 'Graded'
        }))
        assessments_completed = len(quiz_attempts) + len(graded_assignments)

        # 5. assignment_completion_rate (on-time / total assigned)
        # Note: simplistic implementation, can be expanded
        submissions = list(db.get_db()['submissions'].find({'student_id': ObjectId(student_id)}))
        # Total assignments assigned (for courses enrolled)
        enrolled = list(db.get_db()['enrollments'].find({'user_id': ObjectId(student_id)}))
        enrolled_course_ids = [e['course_id'] for e in enrolled]
        total_assignments = db.get_db()['assignments'].count_documents({'course_id': {'$in': enrolled_course_ids}})
        
        on_time = 0
        for sub in submissions:
            assignment = db.get_db()['assignments'].find_one({'_id': sub['assignment_id']})
            if assignment and assignment.get('due_date') and sub.get('submitted_at'):
                if sub['submitted_at'] <= assignment['due_date']:
                    on_time += 1
        
        assignment_completion_rate = on_time / total_assignments if total_assignments > 0 else 0.0

        # Features mapping
        features = {
            'avg_activity_day': 0.0, # Placeholder/fallback if needed
            'login_frequency': login_frequency,
            'video_clicks': video_clicks,
            'avg_quiz_score': avg_quiz_score,
            'avg_submission_day': 0.0,
            'assessments_completed': assessments_completed,
            'avg_assessment_weight': 0.0,
            'studied_credits': 0.0,
            'assignment_completion_rate': assignment_completion_rate
        }
        return features

    def predict_risk(self, student_id: str):
        features = self.extract_features(student_id)
        
        risk_probability = 0.0
        risk_level = "Low"
        
        if self.model:
            try:
                # Prepare input vector for model
                # CatBoost expects the order exactly as trained.
                # Assuming features list based on notebook:
                input_features = [
                    features['avg_activity_day'],
                    features['login_frequency'],
                    features['video_clicks'],
                    features['avg_quiz_score'],
                    features['avg_submission_day'],
                    features['assessments_completed'],
                    features['avg_assessment_weight'],
                    features['studied_credits']
                ]
                
                risk_probability = self.model.predict_proba([input_features])[0][1]
                if risk_probability > 0.7:
                    risk_level = "High"
                elif risk_probability > 0.3:
                    risk_level = "Medium"
                else:
                    risk_level = "Low"
            except Exception as e:
                print(f"Prediction failed: {e}. Fallback to rule-based.")
        
        # Fallback rules
        if not self.model:
            if features['login_frequency'] == 0:
                risk_level = "High"
                risk_probability = 0.85
            elif features['assessments_completed'] == 0 and features['video_clicks'] < 10:
                risk_level = "Medium"
                risk_probability = 0.50
            else:
                risk_level = "Low"
                risk_probability = 0.15

        from models.prediction import PredictionModel
        from models.user import User
        
        # Default weekly forecast (4 weeks placeholder)
        weekly_forecast = [
            {"week": 1, "risk_pct": risk_probability * 100 * 0.9},
            {"week": 2, "risk_pct": risk_probability * 100 * 0.95},
            {"week": 3, "risk_pct": risk_probability * 100 * 1.05},
            {"week": 4, "risk_pct": risk_probability * 100}
        ]
        
        pred_model = PredictionModel()
        pred_model.create_or_update_prediction(
            student_id=student_id,
            risk_level=risk_level,
            risk_probability=risk_probability,
            model_version=self.model_version,
            features=features,
            weekly_forecast=weekly_forecast
        )
        
        # Update User collection
        user_model = User()
        user_model.update_user(student_id, {
            'risk_badge': risk_level,
            'risk_score': risk_probability * 100
        })
        
        return {'risk_level': risk_level, 'risk_probability': risk_probability, 'features': features}
