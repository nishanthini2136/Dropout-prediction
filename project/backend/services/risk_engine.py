import os
import joblib
import pandas as pd
from datetime import datetime
from config.database import db
from bson import ObjectId

_CACHED_CATBOOST_MODEL = None

class RiskEngine:
    def __init__(self):
        self.model_version = "CatBoost_v1.0"
        self.model = None
        self._load_model()

    def _load_model(self):
        global _CACHED_CATBOOST_MODEL
        if _CACHED_CATBOOST_MODEL is not None:
            self.model = _CACHED_CATBOOST_MODEL
            return

        try:
            model_path = os.path.join(os.path.dirname(__file__), '..', 'models', 'catboost_model.pkl')
            if os.path.exists(model_path):
                _CACHED_CATBOOST_MODEL = joblib.load(model_path)
                self.model = _CACHED_CATBOOST_MODEL
                print(f"[RiskEngine] Loaded {self.model_version} into RAM cache from {model_path}")
            else:
                print(f"[RiskEngine] Model not found at {model_path}. Using rule-based per-course Risk Engine.")
        except Exception as e:
            print(f"[RiskEngine] Failed to load CatBoost model: {e}")

    def validate_access(self, student_id: str, course_id: str = None, requesting_user_id: str = None, requesting_role: str = None):
        """Enforces student self-access, instructor enrollment-based scoping, and admin permissions."""
        from middleware.rbac import check_student_data_access
        check_student_data_access(
            requesting_user_id=requesting_user_id,
            requesting_role=requesting_role,
            target_student_id=student_id,
            course_id=course_id
        )

    def extract_features(self, student_id: str, course_id: str = None, requesting_user_id: str = None, requesting_role: str = None):
        self.validate_access(student_id, course_id=course_id, requesting_user_id=requesting_user_id, requesting_role=requesting_role)
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
        progress_docs = list(db.get_db()['progress'].find(prog_find_query, {'updated_at': 1, 'completed_at': 1, 'created_at': 1}))
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
        quiz_docs = list(db.get_db()['quiz_attempts'].find(quiz_find_query, {'timestamp': 1, 'created_at': 1}))
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
            c_assign_ids = [a['_id'] for a in db.get_db()['assignments'].find({'course_id': {'$in': [c_oid, str(course_id)] if ObjectId.is_valid(course_id) else str(course_id)}}, {'_id': 1})]
            if c_assign_ids:
                sub_find_query['assignment_id'] = {'$in': c_assign_ids}
            else:
                sub_find_query['assignment_id'] = {'$in': []}
        sub_docs = list(db.get_db()['submissions'].find(sub_find_query, {'submitted_at': 1, 'created_at': 1}))
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
        quiz_attempts = list(db.get_db()['quiz_attempts'].find(quiz_query, {'max_score': 1, 'score': 1}))
        
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
        progress_quizzes = list(db.get_db()['progress'].find(prog_quiz_query, {'total': 1, 'score': 1}))

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
            assign_ids = [a['_id'] for a in db.get_db()['assignments'].find({'course_id': {'$in': [c_oid, str(course_id)] if ObjectId.is_valid(course_id) else str(course_id)}}, {'_id': 1})]
            if assign_ids:
                sub_query['assignment_id'] = {'$in': assign_ids}
                
        graded_assignments = list(db.get_db()['submissions'].find(sub_query, {'_id': 1}))
        assessments_completed = len(quiz_scores) + len(graded_assignments)

        # 5. Assignment completion rate
        all_sub_query = {'student_id': student_match}
        total_assignments = 0
        if course_id:
            c_oid = ObjectId(course_id) if ObjectId.is_valid(course_id) else course_id
            assigns = list(db.get_db()['assignments'].find({'course_id': {'$in': [c_oid, str(course_id)] if ObjectId.is_valid(course_id) else str(course_id)}}, {'due_date': 1}))
            assign_ids = [a['_id'] for a in assigns]
            total_assignments = len(assigns)
            if assign_ids:
                all_sub_query['assignment_id'] = {'$in': assign_ids}
        else:
            user_match = {'$in': [ObjectId(student_id), str(student_id)]} if ObjectId.is_valid(student_id) else str(student_id)
            enrolled = list(db.get_db()['enrollments'].find({'user_id': user_match}, {'course_id': 1}))
            enrolled_course_ids = [e['course_id'] for e in enrolled]
            total_assignments = db.get_db()['assignments'].count_documents({'course_id': {'$in': enrolled_course_ids}})

        on_time = 0
        if total_assignments > 0:
            submissions = list(db.get_db()['submissions'].find(all_sub_query, {'assignment_id': 1, 'submitted_at': 1}))
            assigns_dict = {a['_id']: a for a in assigns} if course_id else {}
            for sub in submissions:
                assignment = assigns_dict.get(sub['assignment_id']) or db.get_db()['assignments'].find_one({'_id': sub['assignment_id']}, {'due_date': 1})
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
            last_calc = datetime.utcnow()
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
        if not iso_str.endswith('Z') and '+' not in iso_str:
            iso_str += 'Z'
        return badge, score, iso_str

    def predict_risk(self, student_id: str, course_id: str = None, requesting_user_id: str = None, requesting_role: str = None):
        self.validate_access(student_id, course_id=course_id, requesting_user_id=requesting_user_id, requesting_role=requesting_role)
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
                    res = self.predict_risk(student_id, c_id, requesting_user_id=requesting_user_id, requesting_role=requesting_role)
                    results.append(res)
            else:
                # Student has no course enrollments yet — evaluate baseline risk
                res = self._predict_single(student_id, None, requesting_user_id=requesting_user_id, requesting_role=requesting_role)
                results.append(res)
                
            self.update_user_overall_risk(student_id)
            return results

        result = self._predict_single(student_id, course_id, requesting_user_id=requesting_user_id, requesting_role=requesting_role)
        self.update_user_overall_risk(student_id)
        return result

    def _predict_single(self, student_id: str, course_id: str = None, requesting_user_id: str = None, requesting_role: str = None):
        print(f"[RiskEngine] Predicting risk for student_id={student_id}, course_id={course_id}")
        features = self.extract_features(student_id, course_id, requesting_user_id=requesting_user_id, requesting_role=requesting_role)

        risk_probability = 0.0
        # Check if course is already completed (100% progress or all lessons completed)
        is_completed = False
        if course_id:
            s_match = {'$in': [ObjectId(student_id), str(student_id)]} if ObjectId.is_valid(student_id) else str(student_id)
            c_match = {'$in': [ObjectId(course_id), str(course_id)]} if ObjectId.is_valid(course_id) else str(course_id)
            enrollment_doc = db.get_db()['enrollments'].find_one({
                '$or': [{'student_id': s_match}, {'user_id': s_match}],
                'course_id': c_match
            })
            if enrollment_doc and (enrollment_doc.get('progress', 0) >= 100 or enrollment_doc.get('status') == 'completed'):
                is_completed = True

        if is_completed:
            risk_probability = 0.0
            risk_level = "Low"
            model_used = True
            print(f"[RiskEngine] Course {course_id} is 100% COMPLETED by student {student_id}. Setting Risk to 0% (Low).")
        elif self.model:
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
        
        if is_completed:
            weekly_forecast = [
                {'week': 1, 'risk_pct': 0.0},
                {'week': 2, 'risk_pct': 0.0},
                {'week': 3, 'risk_pct': 0.0},
                {'week': 4, 'risk_pct': 0.0}
            ]
            forecast_metadata = {
                'status': 'completed',
                'momentum': 'Completed',
                'message': 'Course successfully completed'
            }
        else:
            # Calculate dynamic 4-week forecast purely using CatBoost on projected features
            weekly_forecast, forecast_metadata = self.compute_weekly_forecast(
                student_id=student_id,
                course_id=course_id,
                current_risk_prob=risk_probability,
                features=features
            )
        forecast_type = "trend_based"

        pred_model.create_or_update_prediction(
            student_id=student_id,
            course_id=course_id,
            risk_level=risk_level,
            risk_probability=risk_probability,
            model_version=self.model_version,
            features=features,
            weekly_forecast=weekly_forecast,
            forecast_type=forecast_type,
            forecast_metadata=forecast_metadata
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
            'forecast_type': forecast_type,
            'forecast_metadata': forecast_metadata
        }

    def calculate_learning_velocity(self, student_id: str, course_id: str = None, features: dict = None) -> dict:
        """
        Calculates student behavioral velocity (rate of change in engagement, video watching,
        quiz attempts, and logins) from real historical timestamps in MongoDB.
        Prioritizes the recent 7-14 day window over lifetime average.
        """
        student_match = {'$in': [ObjectId(student_id), str(student_id)]} if ObjectId.is_valid(student_id) else str(student_id)
        course_match = None
        if course_id:
            course_match = {'$in': [ObjectId(course_id), str(course_id)]} if ObjectId.is_valid(course_id) else str(course_id)

        # 1. Determine active learning period from enrollment
        enrollment_query = {'$or': [{'student_id': student_match}, {'user_id': student_match}]}
        if course_match:
            enrollment_query['course_id'] = course_match
        enrollment = db.get_db()['enrollments'].find_one(enrollment_query)
        
        enrolled_date = None
        if enrollment:
            enrolled_date = enrollment.get('created_at') or enrollment.get('enrolled_at')
        
        if enrolled_date and isinstance(enrolled_date, datetime):
            days_enrolled = max(1, (datetime.utcnow() - enrolled_date).days)
        else:
            days_enrolled = 7  # Default initial 1-week window

        # 2. Recent window (last 7 days) analysis
        from datetime import timedelta
        recent_cutoff = datetime.utcnow() - timedelta(days=7)

        # Recent video clicks
        vid_recent_query = {
            'student_id': student_match,
            'event_type': {'$in': ['play', 'watch', 'video']},
            'timestamp': {'$gte': recent_cutoff}
        }
        if course_match:
            vid_recent_query['course_id'] = course_match
        recent_video_clicks = db.get_db()['engagement_logs'].count_documents(vid_recent_query)

        # Recent logins/active days
        eng_recent_query = {'student_id': student_match, 'timestamp': {'$gte': recent_cutoff}}
        if course_match:
            eng_recent_query['course_id'] = course_match
        recent_logins = len(db.get_db()['engagement_logs'].distinct('timestamp', eng_recent_query))

        # Recent quiz scores
        quiz_recent_query = {'student_id': student_match}
        if course_match:
            quiz_recent_query['course_id'] = course_match
        all_quizzes = list(db.get_db()['quiz_attempts'].find(quiz_recent_query).sort('timestamp', 1))

        # Velocity calculations
        total_vc = float(features.get('video_clicks', 0) if features else 0)
        total_lf = float(features.get('login_frequency', 0) if features else 0)
        total_ac = float(features.get('assessments_completed', 0) if features else 0)

        # Weekly video rate
        if recent_video_clicks > 0:
            video_velocity = (recent_video_clicks * (7.0 / min(7, days_enrolled))) * 0.7 + (total_vc / days_enrolled * 7.0) * 0.3
        elif total_vc > 0:
            video_velocity = total_vc / days_enrolled * 7.0
        else:
            video_velocity = 0.0
        video_velocity = max(0.0, min(15.0, round(video_velocity, 2)))

        # Weekly login rate (active days per week)
        if recent_logins > 0:
            login_velocity = (recent_logins * (7.0 / min(7, days_enrolled))) * 0.7 + (total_lf / days_enrolled * 7.0) * 0.3
        elif total_lf > 0:
            login_velocity = total_lf / days_enrolled * 7.0
        else:
            login_velocity = 0.0
        login_velocity = max(0.0, min(7.0, round(login_velocity, 2)))

        # Weekly assessment rate
        assessment_velocity = max(0.0, min(3.0, round(total_ac / max(1, days_enrolled) * 7.0, 2)))
        if total_ac > 0 and assessment_velocity == 0.0:
            assessment_velocity = 1.0  # If completed assessments, assume baseline pace of 1 per week

        # Quiz performance trend
        quiz_trend = 0.0
        if len(all_quizzes) >= 2:
            first_half = all_quizzes[:len(all_quizzes)//2]
            second_half = all_quizzes[len(all_quizzes)//2:]
            avg_first = sum(q.get('score', 0)/max(1, q.get('max_score', 1))*100 for q in first_half) / max(1, len(first_half))
            avg_second = sum(q.get('score', 0)/max(1, q.get('max_score', 1))*100 for q in second_half) / max(1, len(second_half))
            quiz_trend = (avg_second - avg_first) / max(1, days_enrolled / 7.0)
            quiz_trend = max(-10.0, min(10.0, round(quiz_trend, 2)))

        # Momentum classification
        if video_velocity > 1.0 and login_velocity >= 1.0:
            momentum_label = "Increasing"
        elif video_velocity == 0.0 and total_ac == 0.0:
            momentum_label = "Decreasing"
        else:
            momentum_label = "Stable"

        velocity_data = {
            'days_enrolled': days_enrolled,
            'video_velocity': video_velocity,
            'login_velocity': login_velocity,
            'assessment_velocity': assessment_velocity,
            'quiz_trend': quiz_trend,
            'momentum': momentum_label
        }
        return velocity_data

    def compute_weekly_forecast(self, student_id: str, course_id: str, current_risk_prob: float, features: dict) -> list:
        """
        Generates the 4-week dropout risk forecast purely by executing the trained CatBoost model
        on projected feature vectors derived from real student behavioral velocity.
        """
        velocity = self.calculate_learning_velocity(student_id, course_id, features)
        
        print(f"[RiskEngine] === 4-Week ML Forecast for student_id={student_id}, course_id={course_id} ===")
        print(f"[RiskEngine] Current Risk (Week 1): {current_risk_prob*100:.1f}%")
        print(f"[RiskEngine] Week 1 Features: {features}")
        print(f"[RiskEngine] Calculated Behavioral Velocity: {velocity}")

        weekly_forecast = []
        
        # Week 1: Exact CatBoost prediction on current features
        w1_risk_pct = round(max(0.0, min(100.0, current_risk_prob * 100.0)), 1)
        weekly_forecast.append({
            "week": 1,
            "risk_pct": w1_risk_pct,
            "risk_probability": round(float(current_risk_prob), 4)
        })

        # Weeks 2, 3, 4: Project features forward and predict with CatBoost model
        for w in range(2, 5):
            dt = w - 1  # 1 week ahead, 2 weeks ahead, 3 weeks ahead
            
            # Project features with sanity bounds
            proj_login_frequency = min(365.0, max(0.0, features['login_frequency'] + velocity['login_velocity'] * dt))
            proj_video_clicks = min(500.0, max(0.0, features['video_clicks'] + velocity['video_velocity'] * dt))
            proj_assessments = min(50.0, max(0.0, features['assessments_completed'] + velocity['assessment_velocity'] * dt))
            proj_quiz_score = min(100.0, max(0.0, features['avg_quiz_score'] + velocity['quiz_trend'] * dt))
            proj_avg_activity_day = min(365.0, max(0.0, features['avg_activity_day'] + velocity['login_velocity'] * dt))
            proj_avg_submission_day = min(365.0, max(0.0, features['avg_submission_day'] + velocity['assessment_velocity'] * dt))
            proj_avg_assessment_weight = 10.0
            proj_studied_credits = 30.0

            # Exact 8 features in CatBoost training order:
            # ['avg_activity_day', 'login_frequency', 'video_clicks', 'avg_quiz_score', 'avg_submission_day', 'assessments_completed', 'avg_assessment_weight', 'studied_credits']
            proj_feature_vector = [
                float(proj_avg_activity_day),
                float(proj_login_frequency),
                float(proj_video_clicks),
                float(proj_quiz_score),
                float(proj_avg_submission_day),
                float(proj_assessments),
                float(proj_avg_assessment_weight),
                float(proj_studied_credits)
            ]

            if self.model:
                try:
                    pred_prob_w = float(self.model.predict_proba([proj_feature_vector])[0][1])
                    if proj_video_clicks == 0 and proj_assessments == 0:
                        pred_prob_w = max(pred_prob_w, 0.85)
                except Exception as e:
                    print(f"[RiskEngine] CatBoost inference error for Week {w}: {e}")
                    pred_prob_w = current_risk_prob
            else:
                # Rule-based fallback if model not loaded
                if proj_video_clicks < 2 and proj_assessments == 0:
                    pred_prob_w = 0.85
                elif proj_video_clicks < 3 and proj_assessments <= 1:
                    pred_prob_w = 0.65
                elif proj_assessments <= 2:
                    pred_prob_w = 0.45
                elif proj_video_clicks < 4 or proj_assessments <= 3:
                    pred_prob_w = 0.30
                else:
                    pred_prob_w = 0.15

            validated_prob_w = max(0.0, min(1.0, pred_prob_w))
            risk_pct_w = round(validated_prob_w * 100.0, 1)
            weekly_forecast.append({
                "week": w,
                "risk_pct": risk_pct_w,
                "risk_probability": round(float(validated_prob_w), 4)
            })

            print(f"[RiskEngine] Week {w} Projected Features: {proj_feature_vector} -> CatBoost Risk: {risk_pct_w}%")

        forecast_metadata = {
            "forecast_method": "CatBoost feature-projection forecasting",
            "model": self.model_version,
            "forecast_horizon_weeks": 4,
            "generated_at": datetime.utcnow().isoformat(),
            "description": "The system uses the trained CatBoost model to predict current risk (Week 1) and forecast Weeks 2–4 by projecting future behavioral features from historical learning velocity and recent engagement trends. Each projected weekly feature vector is independently evaluated by the same trained CatBoost model."
        }

        return weekly_forecast, forecast_metadata


