import os
import time
import joblib
import pandas as pd
import numpy as np
from bson import ObjectId
from config.database import db

_CACHED_KNN_MODEL = None
_CACHED_KNN_SCALER = None

# In-memory recommendation cache: {student_id: (cached_time, [recommendation_dicts])}
_REC_CACHE = {}
_REC_CACHE_TTL = 120  # 2 minutes

# In-memory feature vector cache: {student_id: (cached_time, [8 feature floats])}
_FEATURE_CACHE = {}
_FEATURE_CACHE_TTL = 300  # 5 minutes


class RecommendationEngine:
    def __init__(self):
        self.knn_model = None
        self.scaler = None
        self.feature_names = [
            "avg_activity_day",
            "login_frequency",
            "video_clicks",
            "avg_quiz_score",
            "avg_submission_day",
            "assessments_completed",
            "avg_assessment_weight",
            "studied_credits"
        ]
        self._load_models()

    def _load_models(self):
        global _CACHED_KNN_MODEL, _CACHED_KNN_SCALER
        if _CACHED_KNN_MODEL is not None and _CACHED_KNN_SCALER is not None:
            self.knn_model = _CACHED_KNN_MODEL
            self.scaler = _CACHED_KNN_SCALER
            return

        try:
            model_path = os.path.join(os.path.dirname(__file__), '..', 'models', 'knn_model.pkl')
            scaler_path = os.path.join(os.path.dirname(__file__), '..', 'models', 'knn_scaler.pkl')
            if os.path.exists(model_path) and os.path.exists(scaler_path):
                _CACHED_KNN_MODEL = joblib.load(model_path)
                _CACHED_KNN_SCALER = joblib.load(scaler_path)
                self.knn_model = _CACHED_KNN_MODEL
                self.scaler = _CACHED_KNN_SCALER
                print("[RecommendationEngine] Loaded KNN models into RAM cache successfully.")
            else:
                print("[RecommendationEngine] KNN models not found. Using fallback generic recommendations.")
        except Exception as e:
            print(f"[RecommendationEngine] Failed to load KNN models: {e}")

    @classmethod
    def preload(cls):
        """Preload ML models into RAM at application startup."""
        cls()._load_models()

    @staticmethod
    def invalidate_cache(student_id: str = None):
        """Invalidate recommendation cache for a student or globally when learning activity or enrollments change."""
        global _REC_CACHE, _FEATURE_CACHE
        if student_id:
            s_str = str(student_id)
            _REC_CACHE.pop(s_str, None)
            _FEATURE_CACHE.pop(s_str, None)
        else:
            _REC_CACHE.clear()
            _FEATURE_CACHE.clear()

    def extract_student_features(self, student_id: str, stored_predictions_map: dict = None, courses_map: dict = None):
        """Extract the 8 academic features for a student, checking memory cache and predictions first."""
        s_str = str(student_id)
        now = time.time()

        # 1. Check in-memory feature cache
        if s_str in _FEATURE_CACHE:
            cached_time, cached_vec = _FEATURE_CACHE[s_str]
            if now - cached_time < _FEATURE_CACHE_TTL:
                return cached_vec

        # 2. Check stored predictions map if provided or fetch from DB
        features_dict = None
        if stored_predictions_map and s_str in stored_predictions_map:
            features_dict = stored_predictions_map[s_str].get('features')

        if not features_dict:
            s_match = {'$in': [ObjectId(s_str), s_str]} if ObjectId.is_valid(s_str) else s_str
            pred = db.get_db()['predictions'].find_one(
                {'student_id': s_match},
                {'features': 1}
            )
            if pred and 'features' in pred and isinstance(pred['features'], dict):
                features_dict = pred['features']

        # 3. Fallback: compute via RiskEngine if no stored features exist
        if not features_dict:
            from services.risk_engine import RiskEngine
            features_dict = RiskEngine().extract_features(s_str)

            # Calculate studied credits
            s_match = {'$in': [ObjectId(s_str), s_str]} if ObjectId.is_valid(s_str) else s_str
            enrolled = list(db.get_db()['enrollments'].find(
                {'$or': [{'student_id': s_match}, {'user_id': s_match}]},
                {'course_id': 1}
            ))
            enrolled_cids = [str(e['course_id']) for e in enrolled if e.get('course_id')]

            studied_credits = 0
            if enrolled_cids:
                if courses_map:
                    for cid in enrolled_cids:
                        if cid in courses_map:
                            studied_credits += courses_map[cid].get('credits', 30)
                else:
                    c_matches = [ObjectId(cid) for cid in enrolled_cids if ObjectId.is_valid(cid)] + enrolled_cids
                    courses = list(db.get_db()['courses'].find({'_id': {'$in': c_matches}}, {'credits': 1}))
                    for c in courses:
                        studied_credits += c.get('credits', 30)

            features_dict['studied_credits'] = float(studied_credits) if studied_credits > 0 else 30.0

        if features_dict.get('avg_assessment_weight', 0.0) == 0.0:
            features_dict['avg_assessment_weight'] = 10.0

        vec = [
            float(features_dict.get('avg_activity_day', 0.0)),
            float(features_dict.get('login_frequency', 0.0)),
            float(features_dict.get('video_clicks', 0.0)),
            float(features_dict.get('avg_quiz_score', 0.0)),
            float(features_dict.get('avg_submission_day', 0.0)),
            float(features_dict.get('assessments_completed', 0.0)),
            float(features_dict.get('avg_assessment_weight', 10.0)),
            float(features_dict.get('studied_credits', 30.0))
        ]

        # Save to memory cache
        _FEATURE_CACHE[s_str] = (now, vec)
        return vec

    def get_recommendations(self, student_id: str, top_k: int = 3):
        """
        KNN-based Peer Learning Recommendation:
        1. Extract current student's 8 academic features and scale with StandardScaler.
        2. Identify peers in MongoDB and calculate Euclidean distance similarity.
        3. Retrieve courses enrolled by similar peer clusters.
        4. Exclude courses already enrolled by the current student.
        5. Filter only active courses with real-time seat availability.
        """
        s_str = str(student_id)
        now = time.time()

        # 1. Check in-memory recommendation cache
        if s_str in _REC_CACHE:
            cached_time, cached_recs = _REC_CACHE[s_str]
            if now - cached_time < _REC_CACHE_TTL:
                return cached_recs

        # Batch query 1: Fetch all active courses
        all_courses = list(db.get_db()['courses'].find({'is_active': True}))
        if not all_courses:
            return []

        courses_map = {str(c['_id']): c for c in all_courses}

        # Batch query 2: Fetch all enrollments (for seat counts, student enrollments, and peer enrollments)
        all_enrollments = list(db.get_db()['enrollments'].find(
            {},
            {'student_id': 1, 'user_id': 1, 'course_id': 1}
        ))

        enrolled_counts = {}
        current_student_enrolled_cids = set()
        peer_courses_map = {}

        for e in all_enrollments:
            cid = str(e.get('course_id') or '')
            if not cid:
                continue
            enrolled_counts[cid] = enrolled_counts.get(cid, 0) + 1

            sid = str(e.get('student_id') or e.get('user_id') or '')
            if sid == s_str:
                current_student_enrolled_cids.add(cid)
            elif sid:
                peer_courses_map.setdefault(sid, []).append(cid)

        # Exclude courses already enrolled by current student
        available_courses = [c for c in all_courses if str(c['_id']) not in current_student_enrolled_cids]
        if not available_courses:
            return []

        # Calculate real-time seat availability for candidate courses
        for c in available_courses:
            cid_str = str(c['_id'])
            enrolled_cnt = enrolled_counts.get(cid_str, 0)
            cap = int(c.get('capacity', 30))
            seats = max(0, cap - enrolled_cnt)
            c['enrolled_count'] = enrolled_cnt
            c['capacity'] = cap
            c['seats_left'] = seats
            c['is_full'] = seats <= 0

        if not self.knn_model or not self.scaler:
            results = available_courses[:top_k]
            _REC_CACHE[s_str] = (now, results)
            return results

        try:
            # Batch query 3: Fetch precomputed predictions for features
            all_predictions = list(db.get_db()['predictions'].find({}, {'student_id': 1, 'features': 1}))
            predictions_map = {}
            for p in all_predictions:
                sid = str(p.get('student_id'))
                if sid and p.get('features'):
                    predictions_map[sid] = p['features']

            def _get_vec(sid):
                if sid in predictions_map:
                    f = predictions_map[sid]
                    return [
                        float(f.get('avg_activity_day', 0.0)),
                        float(f.get('login_frequency', 0.0)),
                        float(f.get('video_clicks', 0.0)),
                        float(f.get('avg_quiz_score', 0.0)),
                        float(f.get('avg_submission_day', 0.0)),
                        float(f.get('assessments_completed', 0.0)),
                        float(f.get('avg_assessment_weight', 10.0)),
                        float(f.get('studied_credits', 30.0))
                    ]
                return self.extract_student_features(sid, courses_map=courses_map)

            curr_features = _get_vec(s_str)

            valid_peers = []
            peer_matrix = []
            for peer_id, peer_cids in peer_courses_map.items():
                if peer_id == s_str:
                    continue
                valid_peers.append((peer_id, peer_cids))
                peer_matrix.append(_get_vec(peer_id))

            course_scores = {str(c['_id']): 0.0 for c in available_courses}

            if len(valid_peers) > 0:
                # Batch scale all feature vectors at once
                all_vectors = np.vstack([curr_features, peer_matrix])
                df_all = pd.DataFrame(all_vectors, columns=self.feature_names)
                all_scaled = self.scaler.transform(df_all)

                scaled_curr = all_scaled[0]
                scaled_peers = all_scaled[1:]

                # Vectorized Euclidean distances calculation
                distances = np.linalg.norm(scaled_peers - scaled_curr, axis=1)
                top_indices = np.argsort(distances)[:5]

                for idx in top_indices:
                    dist = float(distances[idx])
                    weight = 1.0 / (1.0 + dist)
                    _, peer_cids = valid_peers[idx]
                    for cid in peer_cids:
                        if cid in course_scores:
                            course_scores[cid] += weight

            # Sort candidate courses by KNN peer recommendation score (descending)
            available_courses.sort(
                key=lambda c: (
                    course_scores.get(str(c['_id']), 0.0),
                    not c['is_full'],  # Available seats preferred
                    c.get('rating', 4.5)
                ),
                reverse=True
            )

            results = available_courses[:top_k]
            _REC_CACHE[s_str] = (now, results)
            return results
        except Exception as e:
            print(f"[RecommendationEngine] Error in KNN peer recommendation: {e}")
            results = available_courses[:top_k]
            _REC_CACHE[s_str] = (now, results)
            return results
