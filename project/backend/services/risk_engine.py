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

        # Check module IDs belonging to course if course_id provided
        course_module_ids = []
        if course_id:
            course_doc = db.get_db()['courses'].find_one({'_id': ObjectId(course_id) if ObjectId.is_valid(course_id) else course_id})
            if course_doc and 'modules' in course_doc:
                for m in course_doc['modules']:
                    for k in ['_id', 'id']:
                        if m.get(k) is not None:
                            val = m.get(k)
                            course_module_ids.append(str(val))
                            if isinstance(val, str) and val.isdigit():
                                course_module_ids.append(int(val))
                            elif isinstance(val, int):
                                course_module_ids.append(val)
                            if ObjectId.is_valid(str(val)):
                                course_module_ids.append(ObjectId(str(val)))

        # 1. Login/engagement frequency - Scope per-course when course_id provided
        active_days = set()
        
        # a) Check engagement_logs for student
        eng_match = {'student_id': student_match}
        if course_match:
            eng_match['course_id'] = course_match
        pipeline_login = [
            {'$match': eng_match},
            {'$group': {
                '_id': {'$dateToString': {'format': '%Y-%m-%d', 'date': '$timestamp'}}
            }}
        ]
        for item in db.get_db()['engagement_logs'].aggregate(pipeline_login):
            if item.get('_id'):
                active_days.add(item['_id'])

        # b) Check progress documents for student
        prog_find_query = {'user_id': str(student_id)}
        if course_id:
            if course_module_ids:
                prog_find_query['$or'] = [
                    {'course_id': course_match},
                    {'course_id': {'$exists': False}, 'module_id': {'$in': course_module_ids}},
                    {'course_id': None, 'module_id': {'$in': course_module_ids}}
                ]
            else:
                prog_find_query['course_id'] = course_match
        progress_docs = list(db.get_db()['progress'].find(prog_find_query))
        for p in progress_docs:
            for date_key in ['updated_at', 'completed_at', 'created_at']:
                if p.get(date_key):
                    dt = p[date_key]
                    date_str = dt.strftime('%Y-%m-%d') if hasattr(dt, 'strftime') else str(dt)[:10]
                    active_days.add(date_str)

        # c) Check quiz_attempts (filtered by course_id if course_id provided)
        quiz_find_query = {'student_id': student_match}
        if course_match:
            quiz_find_query['course_id'] = course_match
        quiz_docs = list(db.get_db()['quiz_attempts'].find(quiz_find_query))
        for q in quiz_docs:
            for date_key in ['timestamp', 'created_at']:
                if q.get(date_key):
                    dt = q[date_key]
                    date_str = dt.strftime('%Y-%m-%d') if hasattr(dt, 'strftime') else str(dt)[:10]
                    active_days.add(date_str)

        # d) Check submissions (filtered by course assignments if course_id provided)
        sub_find_query = {'student_id': student_match}
        if course_id:
            c_oid = ObjectId(course_id) if ObjectId.is_valid(course_id) else course_id
            c_assign_ids = [a['_id'] for a in db.get_db()['assignments'].find({'course_id': {'$in': [c_oid, str(course_id)] if ObjectId.is_valid(course_id) else str(course_id)}})]
            if c_assign_ids:
                sub_find_query['assignment_id'] = {'$in': c_assign_ids}
            else:
                sub_find_query['assignment_id'] = {'$in': []}
        sub_docs = list(db.get_db()['submissions'].find(sub_find_query))
        for s in sub_docs:
            for date_key in ['submitted_at', 'created_at']:
                if s.get(date_key):
                    dt = s[date_key]
                    date_str = dt.strftime('%Y-%m-%d') if hasattr(dt, 'strftime') else str(dt)[:10]
                    active_days.add(date_str)

        has_course_activity = len(progress_docs) > 0 or len(quiz_docs) > 0 or len(sub_docs) > 0 or len(active_days) > 0
        login_frequency = len(active_days)

        # 2. Video clicks for this course
        video_query = {
            'student_id': student_match,
            'event_type': {'$in': ['play', 'watch', 'video']}
        }
        if course_match:
            video_query['course_id'] = course_match
            
        engagement_video_clicks = db.get_db()['engagement_logs'].count_documents(video_query)

        progress_query = {'user_id': str(student_id), 'video_watched': True}
        if course_id:
            if course_module_ids:
                progress_query['$or'] = [
                    {'course_id': course_match},
                    {'course_id': {'$exists': False}, 'module_id': {'$in': course_module_ids}},
                    {'course_id': None, 'module_id': {'$in': course_module_ids}}
                ]
            else:
                progress_query['course_id'] = course_match

        progress_video_clicks = db.get_db()['progress'].count_documents(progress_query)
        video_clicks = max(engagement_video_clicks, progress_video_clicks)

        # 3. Quiz attempts & scores for this course
        quiz_query = {'student_id': student_match}
        if course_match:
            quiz_query['course_id'] = course_match
        quiz_attempts = list(db.get_db()['quiz_attempts'].find(quiz_query))
        
        prog_quiz_query = {'user_id': str(student_id), 'quiz_completed': True}
        if course_id:
            if course_module_ids:
                prog_quiz_query['$or'] = [
                    {'course_id': course_match},
                    {'course_id': {'$exists': False}, 'module_id': {'$in': course_module_ids}},
                    {'course_id': None, 'module_id': {'$in': course_module_ids}}
                ]
            else:
                prog_quiz_query['course_id'] = course_match
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
            c_oid = ObjectId(course_id) if ObjectId.is_valid(course_id) else course_id
            assign_ids = [a['_id'] for a in db.get_db()['assignments'].find({'course_id': {'$in': [c_oid, str(course_id)] if ObjectId.is_valid(course_id) else str(course_id)}})]
            if assign_ids:
                sub_query['assignment_id'] = {'$in': assign_ids}
                
        graded_assignments = list(db.get_db()['submissions'].find(sub_query))
        assessments_completed = len(quiz_scores) + len(graded_assignments)

        # 5. Assignment completion rate
        all_sub_query = {'student_id': student_match}
        total_assignments = 0
        if course_id:
            c_oid = ObjectId(course_id) if ObjectId.is_valid(course_id) else course_id
            assigns = list(db.get_db()['assignments'].find({'course_id': {'$in': [c_oid, str(course_id)] if ObjectId.is_valid(course_id) else str(course_id)}}))
            assign_ids = [a['_id'] for a in assigns]
            total_assignments = len(assigns)
            if assign_ids:
                all_sub_query['assignment_id'] = {'$in': assign_ids}
        else:
            user_match = {'$in': [ObjectId(student_id), str(student_id)]} if ObjectId.is_valid(student_id) else str(student_id)
            enrolled = list(db.get_db()['enrollments'].find({'user_id': user_match}))
            enrolled_course_ids = [e['course_id'] for e in enrolled]
            total_assignments = db.get_db()['assignments'].count_documents({'course_id': {'$in': enrolled_course_ids}})

        on_time = 0
        if total_assignments > 0:
            submissions = list(db.get_db()['submissions'].find(all_sub_query))
            for sub in submissions:
                assignment = db.get_db()['assignments'].find_one({'_id': sub['assignment_id']})
                if assignment and assignment.get('due_date') and sub.get('submitted_at'):
                    if sub['submitted_at'] <= assignment['due_date']:
                        on_time += 1
            assignment_completion_rate = on_time / total_assignments
        else:
            assignment_completion_rate = 1.0

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

    def update_user_overall_risk(self, student_id: str):
        """Helper to sync highest calculated risk score & badge for active enrollments to user document."""
        s_match = {'$in': [ObjectId(student_id), str(student_id)]} if ObjectId.is_valid(student_id) else str(student_id)
        
        # Filter predictions by student's active enrolled courses
        enrollments = list(db.get_db()['enrollments'].find({'$or': [{'student_id': s_match}, {'user_id': s_match}]}))
        active_course_ids = [str(e['course_id']) for e in enrollments if e.get('course_id')]

        query = {'student_id': s_match}
        if active_course_ids:
            course_matches = []
            for c_id in active_course_ids:
                if ObjectId.is_valid(c_id):
                    course_matches.append(ObjectId(c_id))
                course_matches.append(str(c_id))
            query['course_id'] = {'$in': course_matches}

        preds = list(db.get_db()['predictions'].find(query))
        
        last_calc = datetime.utcnow()
        if preds:
            top_pred = max(preds, key=lambda x: x.get('risk_probability', 0.0))
            badge = top_pred.get('risk_level', 'Low')
            score = round(top_pred.get('risk_probability', 0.0) * 100, 1)
            last_calc = top_pred.get('updated_at') or top_pred.get('created_at') or datetime.utcnow()
        else:
            badge = 'Low'
            score = 0.0

        u_oid = ObjectId(student_id) if ObjectId.is_valid(student_id) else str(student_id)
        db.get_db()['users'].update_one(
            {'_id': u_oid},
            {'$set': {
                'risk_badge': badge,
                'risk_score': score,
                'last_calculated': last_calc,
                'updated_at': datetime.utcnow()
            }}
        )
        iso_str = last_calc.isoformat() if hasattr(last_calc, 'isoformat') else str(last_calc)
        return badge, score, iso_str

    def predict_risk(self, student_id: str, course_id: str = None):
        user_match = {'$in': [ObjectId(student_id), str(student_id)]} if ObjectId.is_valid(student_id) else str(student_id)

        # If no course_id provided, loop over all enrolled courses for this student
        if not course_id:
            enrollments = list(db.get_db()['enrollments'].find({'student_id': user_match}))
            if not enrollments:
                enrollments = list(db.get_db()['enrollments'].find({'user_id': user_match}))
            
            results = []
            if enrollments:
                for e in enrollments:
                    c_id = str(e['course_id'])
                    res = self.predict_risk(student_id, c_id)
                    results.append(res)
            else:
                # Student has no course enrollments yet — evaluate baseline risk
                res = self._predict_single(student_id, None)
                results.append(res)
                
            self.update_user_overall_risk(student_id)
            return results

        result = self._predict_single(student_id, course_id)
        self.update_user_overall_risk(student_id)
        return result

    def _predict_single(self, student_id: str, course_id: str = None):
        print(f"[RiskEngine] Predicting risk for student_id={student_id}, course_id={course_id}")
        features = self.extract_features(student_id, course_id)

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
                
                # Rule-aligned override: 0 video clicks and 0 assessments indicate severe disengagement / High Risk
                if features['video_clicks'] == 0 and features['assessments_completed'] == 0:
                    risk_probability = max(risk_probability, 0.85)
                    risk_level = "High"
                elif risk_probability > 0.60:
                    risk_level = "High"
                elif risk_probability > 0.30:
                    risk_level = "Medium"
                else:
                    risk_level = "Low"
                model_used = True
                print(f"[RiskEngine] CatBoost Prediction for course {course_id}: Level={risk_level}, Score={risk_probability*100:.1f}%")
            except Exception as e:
                print(f"[RiskEngine] Exception during CatBoost prediction: {e}. Falling back to rule engine.")

        if not model_used:
            # Rule-based Per-Course Risk Engine (balanced):
            if features['video_clicks'] < 2 and features['assessments_completed'] == 0:
                risk_level = "High"
                risk_probability = 0.85
            elif features['video_clicks'] < 3 and features['assessments_completed'] <= 1:
                risk_level = "Medium"
                risk_probability = 0.65
            elif features['assessments_completed'] <= 2:
                risk_level = "Medium"
                risk_probability = 0.45
            elif features['video_clicks'] < 4 or features['assessments_completed'] <= 3:
                risk_level = "Medium"
                risk_probability = 0.30
            else:
                risk_level = "Low"
                risk_probability = 0.15
            print(f"[RiskEngine] Rule-based Engine for course {course_id}: Level={risk_level}, Score={risk_probability*100:.1f}%")

        from models.prediction import PredictionModel
        from models.roadmap import RoadmapModel

        pred_model = PredictionModel()
        
        # Query past prediction history for this student & course
        history_docs = pred_model.get_prediction_history(student_id, course_id)
        past_probs = [h.get('risk_probability') for h in history_docs if h.get('risk_probability') is not None]
        
        all_probs = past_probs + [risk_probability]
        
        forecast_type = "placeholder"
        weekly_forecast = []
        
        if len(all_probs) >= 2:
            import numpy as np
            x = np.arange(len(all_probs))
            y = np.array(all_probs) * 100.0
            
            x_mean = float(np.mean(x))
            y_mean = float(np.mean(y))
            num = float(np.sum((x - x_mean) * (y - y_mean)))
            den = float(np.sum((x - x_mean) ** 2))
            slope = num / den if den != 0 else 0.0
            slope = max(-15.0, min(15.0, slope))
            
            latest_y = y[-1]
            for w in range(1, 5):
                proj = round(max(0.0, min(100.0, latest_y + slope * w)), 1)
                weekly_forecast.append({"week": w, "risk_pct": float(proj)})
            forecast_type = "trend_based"
        else:
            weekly_forecast = [
                {"week": 1, "risk_pct": round(max(0.0, min(100.0, risk_probability * 100 * 0.9)), 1)},
                {"week": 2, "risk_pct": round(max(0.0, min(100.0, risk_probability * 100 * 0.95)), 1)},
                {"week": 3, "risk_pct": round(max(0.0, min(100.0, risk_probability * 100 * 1.05)), 1)},
                {"week": 4, "risk_pct": round(max(0.0, min(100.0, risk_probability * 100)), 1)}
            ]
            forecast_type = "placeholder"

        pred_model.create_or_update_prediction(
            student_id=student_id,
            course_id=course_id,
            risk_level=risk_level,
            risk_probability=risk_probability,
            model_version=self.model_version,
            features=features,
            weekly_forecast=weekly_forecast,
            forecast_type=forecast_type
        )

        try:
            if course_id:
                RoadmapModel().generate_personalized_roadmap(student_id, course_id, week_num=1)
        except Exception as e:
            print(f"[RiskEngine] Error generating roadmap for {course_id}: {e}")

        return {
            'student_id': student_id,
            'course_id': course_id,
            'risk_level': risk_level,
            'risk_probability': risk_probability,
            'risk_score': round(risk_probability * 100, 1),
            'features': features,
            'weekly_forecast': weekly_forecast,
            'forecast_type': forecast_type
        }
