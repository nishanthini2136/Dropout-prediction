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
                print(f"[RiskEngine] Loaded {self.model_version} from {model_path}")
            else:
                print(f"[RiskEngine] Model not found at {model_path}. Using rule-based per-course Risk Engine.")
        except Exception as e:
            print(f"[RiskEngine] Failed to load CatBoost model: {e}")

    def extract_features(self, student_id: str, course_id: str = None):
        student_match = {'$in': [ObjectId(student_id), str(student_id)]} if ObjectId.is_valid(student_id) else str(student_id)
        
        # Course match filter
        course_match = None
        if course_id:
            course_match = {'$in': [ObjectId(course_id), str(course_id)]} if ObjectId.is_valid(course_id) else str(course_id)

        # 1. Login/engagement frequency
        eng_match = {'student_id': student_match}
        if course_match:
            eng_match['$or'] = [{'course_id': course_match}, {'course_id': None}]
            
        pipeline_login = [
            {'$match': eng_match},
            {'$group': {
                '_id': {'$dateToString': {'format': '%Y-%m-%d', 'date': '$timestamp'}},
                'count': {'$sum': 1}
            }}
        ]
        login_days = list(db.get_db()['engagement_logs'].aggregate(pipeline_login))
        login_frequency = len(login_days)

        # 2. Video clicks for this course
        video_query = {
            'student_id': student_match,
            'event_type': {'$in': ['play', 'watch', 'video']}
        }
        if course_match:
            video_query['$or'] = [{'course_id': course_match}, {'course_id': None}]
            
        engagement_video_clicks = db.get_db()['engagement_logs'].count_documents(video_query)
        
        # Check module IDs belonging to course if course_id provided
        course_module_ids = []
        if course_id:
            course_doc = db.get_db()['courses'].find_one({'_id': ObjectId(course_id) if ObjectId.is_valid(course_id) else course_id})
            if course_doc and 'modules' in course_doc:
                for m in course_doc['modules']:
                    if m.get('_id'): course_module_ids.append(str(m['_id']))
                    if m.get('id'): course_module_ids.append(str(m['id']))

        progress_query = {'user_id': str(student_id), 'video_watched': True}
        if course_module_ids:
            progress_query['module_id'] = {'$in': course_module_ids}

        progress_video_clicks = db.get_db()['progress'].count_documents(progress_query)
        video_clicks = max(engagement_video_clicks, progress_video_clicks)

        # 3. Quiz attempts & scores for this course
        quiz_query = {'student_id': student_match}
        if course_match:
            quiz_query['course_id'] = course_match
        quiz_attempts = list(db.get_db()['quiz_attempts'].find(quiz_query))
        
        prog_quiz_query = {'user_id': str(student_id), 'quiz_completed': True}
        if course_module_ids:
            prog_quiz_query['module_id'] = {'$in': course_module_ids}
        progress_quizzes = list(db.get_db()['progress'].find(prog_quiz_query))

        quiz_scores = []
        for q in quiz_attempts:
            if q.get('max_score', 0) > 0:
                quiz_scores.append((q.get('score', 0) / q.get('max_score', 1)) * 100)
        for p in progress_quizzes:
            if p.get('total', 0) > 0:
                quiz_scores.append((p.get('score', 0) / p.get('total', 1)) * 100)

        avg_quiz_score = sum(quiz_scores) / len(quiz_scores) if len(quiz_scores) > 0 else 0.0

        # 4. Assignments completed for this course
        sub_query = {'student_id': student_match, 'status': 'Graded'}
        if course_id:
            # Find assignments belonging to course_id
            assign_ids = [a['_id'] for a in db.get_db()['assignments'].find({'course_id': ObjectId(course_id) if ObjectId.is_valid(course_id) else course_id})]
            if assign_ids:
                sub_query['assignment_id'] = {'$in': assign_ids}
                
        graded_assignments = list(db.get_db()['submissions'].find(sub_query))
        assessments_completed = len(quiz_scores) + len(graded_assignments)

        # 5. Assignment completion rate
        all_sub_query = {'student_id': student_match}
        total_assignments = 0
        if course_id:
            c_oid = ObjectId(course_id) if ObjectId.is_valid(course_id) else course_id
            assigns = list(db.get_db()['assignments'].find({'course_id': c_oid}))
            assign_ids = [a['_id'] for a in assigns]
            total_assignments = len(assigns)
            if assign_ids:
                all_sub_query['assignment_id'] = {'$in': assign_ids}
        else:
            user_match = {'$in': [ObjectId(student_id), str(student_id)]} if ObjectId.is_valid(student_id) else str(student_id)
            enrolled = list(db.get_db()['enrollments'].find({'user_id': user_match}))
            enrolled_course_ids = [e['course_id'] for e in enrolled]
            total_assignments = db.get_db()['assignments'].count_documents({'course_id': {'$in': enrolled_course_ids}})

        submissions = list(db.get_db()['submissions'].find(all_sub_query))
        on_time = 0
        for sub in submissions:
            assignment = db.get_db()['assignments'].find_one({'_id': sub['assignment_id']})
            if assignment and assignment.get('due_date') and sub.get('submitted_at'):
                if sub['submitted_at'] <= assignment['due_date']:
                    on_time += 1

        assignment_completion_rate = on_time / total_assignments if total_assignments > 0 else 0.0

        features = {
            'avg_activity_day': float(login_frequency),
            'login_frequency': login_frequency,
            'video_clicks': video_clicks,
            'avg_quiz_score': avg_quiz_score,
            'avg_submission_day': float(assessments_completed),
            'assessments_completed': assessments_completed,
            'avg_assessment_weight': 10.0,
            'studied_credits': 30.0 if course_id else float(30.0),
            'assignment_completion_rate': assignment_completion_rate
        }
        return features

    def predict_risk(self, student_id: str, course_id: str = None):
        user_match = {'$in': [ObjectId(student_id), str(student_id)]} if ObjectId.is_valid(student_id) else str(student_id)

        # If no course_id provided, loop over all enrolled courses for this student
        if not course_id:
            enrollments = list(db.get_db()['enrollments'].find({'user_id': user_match}))
            results = []
            for e in enrollments:
                c_id = str(e['course_id'])
                res = self.predict_risk(student_id, c_id)
                results.append(res)
            return results

        print(f"[RiskEngine] Predicting risk for student_id={student_id}, course_id={course_id}")
        features = self.extract_features(student_id, course_id)
        print(f"[RiskEngine] Features for course {course_id}: {features}")

        risk_probability = 0.0
        risk_level = "Low"
        model_used = False

        if self.model:
            try:
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
                
                risk_probability = float(self.model.predict_proba([input_features])[0][1])
                if risk_probability > 0.7:
                    risk_level = "High"
                elif risk_probability > 0.3:
                    risk_level = "Medium"
                else:
                    risk_level = "Low"
                model_used = True
                print(f"[RiskEngine] CatBoost Prediction for {course_id}: Level={risk_level}, Score={risk_probability*100:.1f}%")
            except Exception as e:
                print(f"[RiskEngine] Exception during CatBoost prediction: {e}. Falling back to rule engine.")

        if not model_used:
            # Rule-based Per-Course Risk Engine:
            # High Risk (85%): No video clicks and no assessments completed in this course
            if features['video_clicks'] < 2 and features['assessments_completed'] == 0:
                risk_level = "High"
                risk_probability = 0.85
            # Medium Risk (45%): Low quiz score or no assessments completed yet
            elif features['assessments_completed'] == 0 or features['avg_quiz_score'] < 60:
                risk_level = "Medium"
                risk_probability = 0.45
            # Low Risk (15%): Assessments completed and good quiz score
            else:
                risk_level = "Low"
                risk_probability = 0.15
            print(f"[RiskEngine] Rule-based Engine for {course_id}: Level={risk_level}, Score={risk_probability*100:.1f}%")

        from models.prediction import PredictionModel
        from models.roadmap import RoadmapModel

        # Weekly forecast projection
        weekly_forecast = [
            {"week": 1, "risk_pct": round(max(0.0, min(100.0, risk_probability * 100 * 0.9)), 1)},
            {"week": 2, "risk_pct": round(max(0.0, min(100.0, risk_probability * 100 * 0.95)), 1)},
            {"week": 3, "risk_pct": round(max(0.0, min(100.0, risk_probability * 100 * 1.05)), 1)},
            {"week": 4, "risk_pct": round(max(0.0, min(100.0, risk_probability * 100)), 1)}
        ]

        pred_model = PredictionModel()
        pred_model.create_or_update_prediction(
            student_id=student_id,
            course_id=course_id,
            risk_level=risk_level,
            risk_probability=risk_probability,
            model_version=self.model_version,
            features=features,
            weekly_forecast=weekly_forecast
        )

        # Chain Roadmap generation for this course
        try:
            RoadmapModel().generate_personalized_roadmap(student_id, course_id, week_num=1)
            print(f"[RiskEngine] Generated personalized roadmap for course {course_id}")
        except Exception as e:
            print(f"[RiskEngine] Error generating roadmap for {course_id}: {e}")

        return {
            'student_id': student_id,
            'course_id': course_id,
            'risk_level': risk_level,
            'risk_probability': risk_probability,
            'risk_score': round(risk_probability * 100, 1),
            'features': features,
            'weekly_forecast': weekly_forecast
        }
