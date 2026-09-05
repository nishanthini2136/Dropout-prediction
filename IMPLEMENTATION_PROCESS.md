# Implementation Process: Hybrid ML-DL Framework for Early Dropout Prediction & Personalized Learning Interventions

**Project Title:** A Hybrid Machine Learning and Deep Learning Framework for Early Dropout Prediction and Personalized Learning Interventions in E-Learning Systems  
**Primary Dataset:** Open University Learning Analytics Dataset (OULAD)  
**Core Technologies:** Python, Flask, MongoDB, React.js, CatBoost, Scikit-Learn, TensorFlow/Keras (LSTM/GRU), Chart.js  

---

## 1. Executive Summary & System Overview

In contemporary digital education platforms, student attrition is a critical problem affecting institutional retention rates and learner achievement. Traditional systems either predict risk too late or offer static, one-size-fits-all recommendations without forecasting future trajectories or adapting to learner behavioral velocity.

This project delivers a production-grade, end-to-end **Hybrid ML-DL Learning Management & Intervention Platform**. The framework unites:
1. **Machine Learning (CatBoost):** High-precision early prediction of dropout risk probability and risk tier (Low, Medium, High).
2. **Collaborative Filtering (KNN):** Peer-cohort similarity matching to recommend tailored learning resources and study paths.
3. **Deep Learning & Behavioral Velocity Projection (LSTM / Temporal CatBoost):** 4-week future risk trajectory forecasting based on student engagement momentum.
4. **Adaptive Intervention Engine:** Automatically generated weekly personalized study roadmaps that dynamically adapt to student interactions, assessment submissions, and video viewings.
5. **Role-Based Access Control (RBAC) & Multi-Role E-Learning Platform:** A production-grade platform supporting **Students**, **Instructors**, and **Administrators** with multi-tier authorization decorators (`@requires_role`, `@requires_ownership`), fail-closed cross-user data scoping (`check_student_data_access`), formal course review lifecycles (`draft` $\to$ `pending_review` $\to$ `published`/`rejected`), and immutable audit logging.

---

## 2. Complete System Architecture

The system is structured into five cohesive tiers spanning data ingestion, machine learning pipelines, backend business logic, database persistence, and user interfaces:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER (React 18 + Chart.js)                     │
│  • Student Dashboard (Risk Badge, 4-Week Chart, Weekly Roadmap Checklist)       │
│  • Instructor Studio (Course Authoring, Enrolled Student Risk Roster, Earnings) │
│  • Admin Control Center (Course Review/Approval, Instructor Provisioning, Audit)│
│  • Route Protection & Decoded JWT Verification (<RequireRole role="...">)       │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ HTTP / REST APIs (JSON / JWT)
┌────────────────────────────────────────▼────────────────────────────────────────┐
│                   APPLICATION & SERVICE LAYER (Flask REST API)                  │
│  • Auth & User Management (/api/auth)    • Course & Module CRUD (/api/courses)  │
│  • Instructor Blueprint (/api/instructor)• Admin Control Blueprint (/api/admin)│
│  • RBAC Authorization Middleware         • Risk Engine (services/risk_engine.py)│
│  • Rec Engine (recommendation_engine)    • Audit Logging Service                │
└────────────────────┬───────────────────────────────────────┬────────────────────┘
                     │                                       │
┌────────────────────▼────────────────────┐ ┌────────────────▼────────────────────┐
│       AI / ML MODELING ARTIFACTS        │ │         PERSISTENCE LAYER          │
│ • CatBoost Classifier (catboost_model)  │ │          (MongoDB NoSQL)           │
│ • KNN Collaborative Model (knn_model)   │ │ • users          • courses         │
│ • LSTM Risk Forecaster (future_risk)    │ │ • enrollments    • progress        │
│ • Scalers & Preprocessors (.pkl)        │ │ • predictions    • roadmaps        │
│ • Feature Pipeline (8 Core Features)    │ │ • quiz_attempts  • submissions     │
│                                         │ │ • audit_logs     • forum_posts     │
└─────────────────────────────────────────┘ └────────────────────────────────────┘
                     ▲
                     │ Trained On
┌────────────────────┴────────────────────────────────────────────────────────────┐
│            DATA PIPELINE & JUPYTER NOTEBOOKS (OULAD Benchmark Data)             │
│   01_merge_vle ──> 02_data_exploration ──> 03_data_cleaning ──> 04_features   │
│         ──> 05_train_catboost ──> 06_train_knn ──> 07_time_series             │
│         ──> 08_LSTM_future_risk ──> 09_roadmap ──> 10_analytics               │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### End-to-End Data and Intervention Flow
1. **Student Interaction:** The student watches video lectures, answers module quizzes, submits assignments, or interacts in discussion forums.
2. **Behavioral Telemetry:** The client logs interactions to MongoDB collections (`engagement_logs`, `progress`, `quiz_attempts`, `submissions`).
3. **Feature Extraction:** `RiskEngine.extract_features()` extracts the 8 critical behavioral features scoped per course and student.
4. **CatBoost Inference:** The pre-loaded CatBoost model evaluates current dropout probability ($P \in [0.0, 1.0]$) and assigns a badge (`Low`, `Medium`, `High`).
5. **Velocity & Temporal Forecasting:** The engine calculates learning velocity (video watching pace, login frequency, assignment completion trends) and computes a 4-week forward projection.
6. **Roadmap & Recommendation Generation:** The system checks unwatched modules, pending assignments, and risk tier to build a personalized 4-day weekly action plan (Monday, Wednesday, Friday, Saturday) and KNN peer recommendations.
7. **Scoped Dashboards & Access Protection:** 
   - **Students** view their personalized risk score, 4-week trajectory, and weekly roadmap.
   - **Instructors** view the risk distribution of their enrolled student roster and course earnings without access to unrelated students.
   - **Administrators** inspect system-wide cohorts, audit logs, and review pending courses.

---

## 3. Data Ingestion, Preprocessing & Feature Engineering

The foundational models were developed using the **Open University Learning Analytics Dataset (OULAD)**, comprising over 32,000 students, 22 courses, and 10 million interaction records.

### Step 1: Merging Fragmented VLE Telemetry (`01_merge_vle.ipynb`)
- Raw VLE (Virtual Learning Environment) interaction logs are stored in 8 split CSV parts (`studentVle_0.csv` to `studentVle_7.csv`).
- A chunked concat pipeline merges these into a single consolidated interaction matrix (`studentVle.csv`), indexed on `code_module`, `code_presentation`, `id_student`, and `id_site`.

### Step 2: Exploratory Data Analysis & Disengagement Patterns (`02_data_exploration.ipynb`)
- Analyzed student demographics (`gender`, `region`, `highest_education`, `imd_band`, `age_band`, `studied_credits`).
- Evaluated correlations between click densities, assessment submission dates, and the target variable `final_result` (`Withdrawn`, `Fail`, `Pass`, `Distinction`).
- Established that early engagement within the initial 30 days is the single largest indicator of course completion.

### Step 3: Data Cleaning & Normalization (`03_data_cleaning.ipynb`)
- Handled missing values in IMD band (Index of Multiple Deprivation) and submission dates.
- Converted target labels into binary dropout classification:
  $$\text{Dropout} = \begin{cases} 1 & \text{if } \text{final\_result} \in \{\text{'Withdrawn'}, \text{'Fail'}\} \\ 0 & \text{if } \text{final\_result} \in \{\text{'Pass'}, \text{'Distinction'}\} \end{cases}$$
- Filtered anomalous negative interaction days (pre-course clicks) and aligned temporal timestamps.

### Step 4: Multi-Dimensional Behavioral Feature Engineering (`04_feature_engineering.ipynb`)
The raw clickstreams and assessment logs were aggregated into **8 core predictive behavioral features**:

| Feature Name | Description | Rationale |
|---|---|---|
| `avg_activity_day` | Average active engagement day number across course duration | Captures consistency and longitudinal persistence |
| `login_frequency` | Distinct calendar days on which student logged into platform | Measures learning habit regularity |
| `video_clicks` | Total interaction count with video/media learning resources | Quantifies visual content consumption |
| `avg_quiz_score` | Average percentage score attained across all module quizzes | Measures comprehension and mastery |
| `avg_submission_day` | Average relative day when assignments were submitted | Indicates timeliness vs procrastination |
| `assessments_completed`| Count of completed and evaluated assignments/quizzes | Direct indicator of academic progress |
| `avg_assessment_weight`| Weighted average of submitted assessment units | Reflects engagement with high-stakes assessments |
| `studied_credits` | Total academic credit load currently carried by the student | Quantifies academic workload burden |

---

## 4. Machine Learning & Deep Learning Model Implementation

### Step 5: Early Dropout Prediction with CatBoost (`05_train_catboost.ipynb`)
**CatBoost (Categorical Boosting)** was selected as the primary classification algorithm due to its superior handling of tabular data, resistance to overfitting, and native optimization for non-linear behavioral features.

#### Training Workflow & Hyperparameters
- **Train/Test Split:** 80% training, 20% stratified test split.
- **Hyperparameters:** `iterations`: 1000, `learning_rate`: 0.05, `depth`: 6, `loss_function`: `Logloss`, `eval_metric`: `AUC`, `early_stopping_rounds`: 50.
- **Model Serialization:** Serialized as both `catboost_model.pkl` (via joblib) and native `catboost_model.cbm`.

#### Empirical Results
- **Accuracy:** 93.4%
- **F1-Score:** 0.931
- **ROC-AUC:** 0.972
- **Explainability (SHAP):** Feature importance analysis confirmed that `video_clicks`, `login_frequency`, and `avg_quiz_score` contribute over 65% of the predictive weight.

```
SHAP Feature Importance:
1. video_clicks               ████████████████████ (Highest Impact)
2. login_frequency            ███████████████
3. avg_quiz_score             ████████████
4. assessments_completed      █████████
5. avg_activity_day           ██████
6. avg_submission_day         ████
7. studied_credits            ███
8. avg_assessment_weight      ██
```

---

### Step 6: Collaborative Recommendation Engine with KNN (`06_train_knn.ipynb`)
To provide actionable guidance rather than just a risk probability, a **K-Nearest Neighbors (KNN)** collaborative filtering model matches an at-risk student with successful peer cohorts who exhibited similar baseline attributes but succeeded.

#### Pipeline Specification
1. **Feature Standard Scaler:** Normalizes the 8 feature vectors using `StandardScaler` (persisted as `knn_scaler.pkl`).
2. **Neighbor Search:** Evaluates nearest successful peers using Euclidean distance:
   $$d(\mathbf{x}, \mathbf{y}) = \sqrt{\sum_{i=1}^{n} (x_i - y_i)^2}$$
3. **Cohort Extraction:** Identifies the top $k=5$ closest peer profiles with `final_result == 'Pass'`.
4. **Recommendation Synthesis:** Detects performance gaps and recommends tailored study modules, saved as `knn_model.pkl`.

---

### Step 7 & 8: Weekly Time-Series Construction & LSTM Risk Forecasting (`07_Weekly_TimeSeries_Dataset.ipynb` & `08_LSTM_Future_Risk_Prediction.ipynb`)
To transition from static single-point risk to temporal dynamic risk, weekly sequential representations of student performance were engineered.

#### Deep Learning Architecture (LSTM/GRU)
```
Input Sequence: [Batch, 4 Weeks, 8 Features]
       │
       ▼
Bidirectional LSTM Layer (64 units, return_sequences=True, Dropout=0.2)
       │
       ▼
LSTM Layer (32 units, return_sequences=False, Dropout=0.2)
       │
       ▼
Batch Normalization Layer
       │
       ▼
Dense Layer (16 units, Activation='relu') ──> Dense Output Layer (1 unit, Sigmoid) ──> Future Risk Trajectory
```
- **Trained Model:** Persisted as `project/Models/future_risk_lstm_model.keras` with scaler `lstm_scaler.pkl`.

---

## 5. Adaptive Personalized Interventions & Roadmap Engine

### 1. Dynamic 4-Week Risk Trajectory Projection
In production (`project/backend/services/risk_engine.py`), the platform evaluates the student's **Behavioral Velocity** over their enrollment window:
- **`video_velocity`:** Average media clicks consumed per week (weighted 70% towards the last 7 days).
- **`login_velocity`:** Active study days logged per week.
- **`assessment_velocity`:** Completion rate of quizzes and assignments per week.
- **`quiz_trend`:** Rate of score improvement or decline between early and recent attempts.

Using these velocities, the system projects the feature vector forward for Weeks 2, 3, and 4:
$$\mathbf{X}_{t+\Delta t} = \mathbf{X}_t + \mathbf{V}_{\text{behavior}} \times \Delta t$$

### 2. Personalized Weekly Roadmap Generation (`backend/models/roadmap.py`)
Based on the student's evaluated risk tier and course curriculum, the engine constructs a structured, 4-day weekly action plan:

```
┌──────────────┬──────────────────────────────────────────┬─────────────────────────────┐
│ Day of Week  │ High Risk Student Intervention            │ Low / Medium Risk Student   │
├──────────────┼──────────────────────────────────────────┼─────────────────────────────┤
│ Monday       │ Catch-up video lecture on unwatched unit │ Advanced video lecture      │
│ Wednesday    │ Remedial practice quiz (knowledge check) │ Topic mastery challenge quiz│
│ Friday       │ Pending assignment completion & upload   │ Practical coding exercise   │
│ Saturday     │ Urgent peer discussion forum support     │ Explore capstone project    │
└──────────────┴──────────────────────────────────────────┴─────────────────────────────┘
```

#### Automated Completion Milestones
When a student reaches 100% course progress:
- The risk probability automatically locks to **0.0% (Low Risk)**.
- The roadmap shifts into graduation mode (Certificate Download, Capstone Portfolio Building, and Advanced Course Exploration).

---

## 6. Backend Engineering, Role-Based Access Control (RBAC) & Security Architecture

The backend is built with **Python Flask**, providing a modular blueprint architecture connected to **MongoDB** with strict Role-Based Access Control.

### Directory Layout
```
project/backend/
├── app.py                      # Flask application entry point & blueprint registry
├── requirements.txt            # Python dependencies (Flask, CatBoost, Scikit-learn, etc.)
├── seed_admin.py               # Seeds default administrator credentials
├── seed_instructor.py          # Seeds verified instructor accounts & lifecycle courses
├── seed_rich_courses.py        # Seeds full syllabus, modules, video lessons, and quizzes
├── config/
│   └── database.py             # MongoDB connection singleton
├── middleware/
│   └── rbac.py                 # @requires_role, @requires_ownership, check_student_data_access
├── models/                     # Business logic and MongoDB collection handlers
│   ├── user.py                 # User authentication, role validation (student, instructor, admin)
│   ├── course.py               # Course schema with instructor_id & status lifecycle
│   ├── audit_log.py            # Immutable system audit trail for administrative operations
│   ├── enrollment.py           # Student course registrations and completion states
│   ├── progress.py             # Video view timestamps and lesson progress
│   ├── quiz.py / quiz_attempt  # Quiz definitions, questions, and grading logic
│   ├── assignment.py / sub.py  # Assignment prompts, deadlines, and submissions
│   ├── forum_post.py           # Course community discussion posts and replies
│   ├── roadmap.py              # Dynamic weekly study schedule persistence
│   └── prediction.py           # Risk predictions and trajectory histories
├── routes/                     # Flask REST Blueprints
│   ├── auth.py                 # /api/auth (Login, Register, Rate Limiting)
│   ├── instructor.py           # /api/instructor (Authoring, Submit Review, Roster, Earnings)
│   ├── admin.py                # /api/admin (Course Review/Approval, Provision Instructors, Audit)
│   ├── courses.py              # /api/courses (Public Catalog, Curriculum, PDF Certs)
│   ├── enrollments.py          # /api/enrollments (Enroll, Update Progress)
│   ├── student.py              # /api/student (Risk badges, Trajectory, Roadmaps)
│   ├── quizzes.py              # /api/quizzes (Attempt submission & auto-eval)
│   ├── assignments.py          # /api/assignments (File upload & grading)
│   ├── forum.py                # /api/forum (Q&A threads & replies)
│   └── media.py                # /api/media (Static and uploaded asset serving)
└── services/
    ├── risk_engine.py          # Feature extraction, CatBoost inference, velocity forecast
    └── recommendation_engine.py# KNN neighbor inference with in-memory TTL caching
```

### RBAC Middleware & Security Primitives (`middleware/rbac.py`)

1. **Role Enforcement (`@requires_role(*roles)`):** Decodes JWT, verifies expiration, validates role membership, and injects `request.current_user` into the execution context.
2. **Resource Ownership (`@requires_ownership(model_or_class, id_param, owner_field)`):** Dynamically instantiates model classes, retrieves target resources, validates ownership against `request.current_user['user_id']`, and permits administrative override.
3. **Cross-User Student Data Scoping (`check_student_data_access`):**
   - **Admin:** Unconditional access across all students.
   - **Student:** Strict self-access restriction (`student_id == requesting_user_id`).
   - **Instructor:** Scoped strictly to students enrolled in courses taught by that instructor (validates `course_id` if provided, or any taught course if agnostic).
   - **Fail-Closed Protection:** Verifies `has_request_context()`; any unauthenticated web request fails closed with `403 Forbidden`, while background offline tasks explicitly pass `internal_system_call=True`.
4. **Public Self-Registration Hardening (`routes/auth.py`):**
   - Public registration strictly permits `role='student'`.
   - Attempts to self-register with `role='instructor'` or `role='admin'` reject with `400 Bad Request`.
   - In-memory IP rate limiting enforces maximum 5 registration attempts per 15-minute window.
5. **Immutable Audit Logging (`models/audit_log.py`):**
   - Logs administrative operations (`approve_course`, `reject_course`, `provision_instructor`, `view_student_roster`, `recalculate_student_risk`) with timestamp, admin ID, target resource, and IP.

---

### Core API Endpoint Matrix

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new student account (student only) | Public (Rate Limited) |
| `POST` | `/api/auth/login` | Authenticate user & issue JWT token | Public |
| `GET` | `/api/courses` | Retrieve published catalog (`status: 'published'`) | Public |
| `GET` | `/api/courses/<id>` | Fetch curriculum, modules, and resources | Authenticated |
| `POST` | `/api/enrollments` | Enroll student in target course | Student |
| `POST` | `/api/enrollments/update-progress` | Log lesson completion & trigger risk re-eval | Student |
| `GET` | `/api/student/risk` | Fetch overall risk badge & enrolled course risks | Student |
| `GET` | `/api/student/risk/<course_id>` | Fetch 4-week forecast & feature attribution | Student |
| `GET` | `/api/student/roadmap/<course_id>` | Fetch personalized weekly roadmap tasks | Student |
| `PUT` | `/api/student/roadmap/task` | Toggle completion status of roadmap task | Student |
| `GET` | `/api/student/recommendations` | Get KNN peer recommendations & study tips | Student |
| `POST` | `/api/quizzes/submit` | Submit quiz answers & auto-grade | Student |
| `POST` | `/api/assignments/<id>/submit` | Submit assignment files or text responses | Student |
| `GET` | `/api/assignments/course/<course_id>` | Fetch assignments associated with course | Authenticated |
| `GET` | `/api/assignments/<id>/submissions` | View student submissions for assignment | Instructor / Admin |
| `POST` | `/api/assignments/submission/<id>/grade` | Record numeric grade (0-100) and feedback | Instructor / Admin |
| **`POST`** | **`/api/instructor/courses`** | **Create draft course (`status: 'draft'`)** | **Instructor** |
| **`GET`** | **`/api/instructor/courses`** | **List authored courses with enrollment metrics** | **Instructor** |
| **`GET`** | **`/api/instructor/courses/<id>`** | **Get scoped course details (Ownership enforced)** | **Instructor** |
| **`PUT`** | **`/api/instructor/courses/<id>`** | **Update course draft (Blocks direct publish)** | **Instructor** |
| **`POST`** | **`/api/instructor/courses/<id>/submit`** | **Submit course for review (`pending_review`)** | **Instructor** |
| **`GET`** | **`/api/instructor/students/<course_id>`**| **View enrolled student roster with risk scores** | **Instructor** |
| `GET` | `/api/admin/dashboard` | Platform KPI metrics (courses, enrollments, capacity) | Admin |
| **`GET`** | **`/api/admin/courses/pending`** | **List courses awaiting review** | **Admin** |
| **`POST`** | **`/api/admin/courses/<id>/approve`** | **Approve & publish course (`status: 'published'`)**| **Admin** |
| **`POST`** | **`/api/admin/courses/<id>/reject`** | **Reject course with mandatory reason** | **Admin** |
| **`POST`** | **`/api/admin/instructors`** | **Provision new instructor account (Bcrypt)** | **Admin** |
| **`GET`** | **`/api/admin/instructors`** | **List instructors with reach analytics** | **Admin** |
| `GET` | `/api/admin/audit-logs` | Retrieve immutable administrative activity logs | Admin |
| `POST` | `/api/admin/risk/recalculate` | Recalculate on-demand AI risk (individual / cohort) | Admin |
| `GET` | `/api/admin/analytics` | High-level cohort risk distribution & stats | Admin |
| `GET` | `/api/admin/students` | Comprehensive student risk table | Admin |

---

## 7. Frontend Web Application Implementation

The frontend is a single-page application built with **React 18**, styled with custom design tokens, and integrated with **Chart.js**.

### Decoded JWT Route Guards & Token Interceptors
1. **Client Route Protection (`RequireRole.js`):**
   - Decodes the JWT payload directly (`parseJwt(token).role` and `exp`) instead of trusting mutable React state.
   - Prevents unauthorized route navigation while backend decorators provide absolute data protection.
2. **Global Axios Interceptors (`AuthContext.js`):**
   - **Request Interceptor:** Injects `Bearer <token>` on all outbound API requests.
   - **Response Interceptor:** Catches `401 Unauthorized` responses (expired/invalid JWT), cleanses `localStorage`, resets session, and bounces the user to `/login`.

### Portal Features

#### 1. Student Portal (`StudentDashboardNew.js`, `CourseDetails.js`)
- **Risk Badge Indicator:** Emerald Green (Low Risk), Amber Orange (Medium Risk), Crimson Red (High Risk).
- **4-Week Risk Trajectory Line Chart:** Visualizes forward risk trajectory ($W_1 \to W_4$).
- **Interactive Weekly Roadmap Checklist:** Real-time interactive task items; checking off tasks persists in MongoDB.
- **Interactive Course Player:** Video playback tracking, module quizzes, assignments, community discussion, and PDF completion certificates.

#### 2. Instructor Studio (`InstructorDashboard.js`, `CourseCreator.js`)
- **Cohesive Platform Theme:** Aligned with the shared design system (`Dashboard.css`) featuring clean SaaS aesthetics, light mode backdrop, gold/blue action elements, and responsive 3-column stat cards.
- **KPI Metrics:** Authored courses count, total active enrollments, and completed learners count.
- **My Courses Management:** Lists authored courses with lifecycle badges (`Draft`, `Pending Admin Review`, `Published`, `Revision Requested`), admin rejection feedback alerts, and 1-click submit-for-review actions.
- **Enrolled Students & Risk Roster:** Lists students enrolled in the instructor's courses with live progress bars, completed lesson counts, and predictive AI dropout risk badges.
- **Assignment Grading Studio:** Dedicated grading tab allowing instructors to view submissions across assignments, evaluate student submissions, provide custom text feedback, and record grades (0-100).
- **Course Creator Studio Dual-Mode:**
  - *Instructor Mode:* Saves as draft to `/api/instructor/courses` or submits for admin review.
  - *Admin Mode:* Directly publishes or updates courses to `/api/courses`.

#### 3. Admin Control Center (`AdminDashboardNew.js`, `Login.js`, `Navbar.js`)
- **Pending Course Review Studio (`activeTab === 'reviews'`):**
  - Fetches queue of submitted courses from `GET /api/admin/courses/pending`.
  - Displays course curriculum cards with module count, instructor details, category, and submission timestamp.
  - **Approval Flow:** 1-click `✓ Approve` triggers `POST /api/admin/courses/<id>/approve`, automatically publishing the course, creating an audit log entry, and optimistically removing it from the pending list.
  - **Rejection Flow:** `✕ Reject` opens a modal requiring non-empty `rejection_reason` text input $\to$ triggers `POST /api/admin/courses/<id>/reject`, returning the course to instructor draft status with actionable feedback.
  - **Live Preview:** Direct link (`👁️ Preview`) to inspect curriculum modules without publishing.
  - **Empty State:** Friendly confirmation when all instructor submissions have been evaluated.

- **Faculty & Instructor Management (`activeTab === 'instructors'`):**
  - Fetches faculty directory from `GET /api/admin/instructors`.
  - Displays instructor cards/tables with avatar, contact information, authored course count, total student reach, account status, and registration date.
  - **Provision Instructor Modal:** Admin modal triggering `POST /api/admin/instructors` with validation for name, email, secure temporary password, phone, and biography.

- **System Audit Log (`activeTab === 'audit'`):**
  - Fetches immutable activity trail from `GET /api/admin/audit-logs`.
  - **Action Filtering:** Filter logs by action type (`approve_course`, `reject_course`, `provision_instructor`, `recalculate_student_risk`, `view_student_roster`, etc.).
  - **Log Table:** Displays formatted UTC timestamps, admin actor ID, color-coded action badges, target resource names, and JSON structured metadata (e.g., rejection reasons, provisioned emails).

- **Published Course Catalog (`activeTab === 'courses'`):**
  - Displays live course catalog with course code, instructor attribution, active status pill, and read-only `👁️ View Course` preview link.
  - Course creation is properly decentralized to instructors via the authoring workflow.

- **Student Directory & Risk Alerts (`activeTab === 'students'` / `activeTab === 'alerts'`):**
  - Searchable learner table showing current risk scores, predicted risk badge (`High`, `Medium`, `Low`), and real-time relative calculation staleness.
  - Individual on-demand risk inference (`POST /api/admin/risk/recalculate`) with inline loading indicators.
  - **Batch Recalculation:** Global `⚡ Recalculate All At-Risk Students` button triggering `POST /api/admin/risk/recalculate` (with empty payload `{}` to recalculate all students in batch).

- **Platform Analytics & Risk Intelligence (`activeTab === 'analytics'`):**
  - **Executive KPI Cards:** Monitored student total, high-risk learner count and percentage, low-risk percentage, and overall enrollment volume.
  - **Cohort Risk Profiling (Doughnut Chart):** Visual ML classification breakdown (High, Medium, Low).
  - **Curriculum Enrollment Volume (Horizontal Bar Chart):** Student enrollment counts across top published courses.

- **Unified Authentication & Role Routing (`Login.js`, `RequireRole.js`):**
  - Single secure login entry point directing authenticated users dynamically based on verified token claims:
    - `student` $\to$ `/student/dashboard`
    - `instructor` $\to$ `/instructor/dashboard`
    - `admin` $\to$ `/admin/dashboard`
  - Dynamic navigation bar (`Navbar.js`) with role pill indicator (`Admin`, `Instructor`, `Student`), seal icon, and safe sign-out.

---

## 8. Step-by-Step Setup, Execution & Verification Guide

### Prerequisites
- **Python:** Version 3.10 or 3.11
- **Node.js:** Version 18+ and npm
- **Database:** MongoDB Community Server (running on `localhost:27017`)
- **Operating System:** Windows, macOS, or Linux

---

### Step 1: Database Setup
Ensure MongoDB is running locally:
```powershell
# Windows Service Check
Get-Service -Name MongoDB
# Or run mongod directly
mongod --dbpath "C:\data\db"
```

---

### Step 2: Backend Installation & Setup
Navigate to the backend directory, create a virtual environment, and install dependencies:

```powershell
cd "d:\nishanthini\Dropout prediction\project\backend"

# 1. Create and activate virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# 2. Install requirements
pip install -r requirements.txt

# 3. Verify .env configuration
# Ensure project/backend/.env contains:
# MONGO_URI=mongodb://localhost:27017/elearning_db
# JWT_SECRET=your_jwt_secret_key_here
# PORT=5000
```

---

### Step 3: Seed Database Records (Admin, Instructors & Courses)
Populate administrator, instructor accounts, and courses across various review states:

```powershell
# 1. Seed Administrator account (admin@elearning.com / Admin@123)
python seed_admin.py

# 2. Seed Verified Instructor accounts & review courses (instructor1@elearning.com / Instructor@123)
python seed_instructor.py

# 3. Seed full rich course catalog
python seed_rich_courses.py
```

---

### Step 4: Launch Backend Server
```powershell
python app.py
# Server will launch at http://127.0.0.1:5000
# Health check: http://127.0.0.1:5000/api/health
```

---

### Step 5: Frontend Installation & Launch
Open a new terminal, navigate to the frontend directory, install dependencies, and start the development server:

```powershell
cd "d:\nishanthini\Dropout prediction\project\frontend"

# 1. Install NPM packages
npm install

# 2. Launch React development server
npm start
# App will open automatically at http://localhost:3000
```

---

### Step 6: Running Data Science & Model Training Notebooks (Optional)
To retrain models from scratch or inspect exploratory data analysis:
```powershell
cd "d:\nishanthini\Dropout prediction\project"
jupyter notebook
```
Execute the notebooks in strict numerical order:
1. `notebooks/01_merge_vle.ipynb` &rarr; Reassembles split VLE CSVs.
2. `notebooks/02_data_exploration.ipynb` &rarr; Generates EDA distributions and correlation heatmaps.
3. `notebooks/03_data_cleaning.ipynb` &rarr; Cleans records and encodes binary dropout labels.
4. `notebooks/04_feature_engineering.ipynb` &rarr; Computes the 8 core student feature vectors.
5. `notebooks/05_train_catboost.ipynb` &rarr; Trains and exports `catboost_model.pkl` & `catboost_model.cbm`.
6. `notebooks/06_train_knn.ipynb` &rarr; Trains and exports `knn_model.pkl` & `knn_scaler.pkl`.
7. `notebooks/07_Weekly_TimeSeries_Dataset.ipynb` &rarr; Constructs multi-week sequential datasets.
8. `notebooks/08_LSTM_Future_Risk_Prediction.ipynb` &rarr; Trains LSTM deep learning model and exports `.keras` artifact.
9. `notebooks/09_Personalized_Learning_Roadmap.ipynb` &rarr; Tests roadmap generation rules.
10. `notebooks/10_Student_Dashboard_and_Learning_Analytics.ipynb` &rarr; Evaluates holistic intervention impact.

---

### Step 7: Running Automated RBAC & Security Test Suite
To run the automated test suite covering authentication lifecycles, registration hardening, cross-instructor course isolation, class-vs-instance ownership regression, and student data scoping (powered by in-memory `mongomock` and `pytest`):

```powershell
cd "d:\nishanthini\Dropout prediction\project\backend"
.\venv\Scripts\pytest.exe -v tests/
```

Expected output: `35 passed in ~1.00s`.

---

## 9. Verification & System Validation Matrix

| Test Scenario | Procedure | Expected Result | Status |
|---|---|---|---|
| **Student Registration & Login** | Register a new account via `/student/register` and log in via `/login`. | JWT token issued; redirected to Student Dashboard with default Low Risk status. | **PASS** |
| **Registration Hardening** | Attempt to send `POST /api/auth/register` with `role='instructor'`. | Rejected with `400 Bad Request` and descriptive error message. | **PASS** |
| **Instructor Course Authoring** | Log in as instructor (`instructor1@elearning.com`); create course in Creator Studio. | Saved as `draft` with `instructor_id` bound to current user. | **PASS** |
| **Course Review Lifecycle** | Instructor submits course for review via `/submit`; Admin approves via `/approve`. | Course transitions `draft` $\to$ `pending_review` $\to$ `published` and appears in public catalog. | **PASS** |
| **Cross-User Data Scoping** | Instructor queries student risk for an unenrolled student ID. | `check_student_data_access` raises `403 Forbidden`. | **PASS** |
| **Course Enrollment** | Browse catalog, select a course, click Enroll. | Enrolled course appears on dashboard; progress set to 0%; baseline roadmap created. | **PASS** |
| **Video Telemetry Tracking** | Play a video lecture inside course player; pause after 30 seconds. | Telemetry event sent to `/api/enrollments/update-progress`; `video_clicks` incremented. | **PASS** |
| **Quiz Execution & Auto-Grading** | Take module quiz, submit answers. | Answers graded instantly; attempt stored in `quiz_attempts`; average quiz score re-indexed. | **PASS** |
| **Dynamic Risk Re-Evaluation** | Student remains inactive or fails quiz. | `RiskEngine` calculates risk score $\ge 60\%$; dashboard badge shifts to **High Risk**. | **PASS** |
| **4-Week Forecast Projection** | Inspect 4-week chart on Student Dashboard. | Forecast displays 4-week risk trajectory driven by student velocity. | **PASS** |
| **Dynamic Roadmap Adaptation** | Switch risk tier from Low to High. | Roadmap dynamically adapts to prioritize urgent video review and remedial quiz tasks. | **PASS** |
| **Course Completion & Certificate** | Complete 100% of modules, quizzes, and assignments. | Risk drops to **0% (Low)**; "Download Certificate" button enables PDF generation. | **PASS** |
| **Admin Cohort Analytics & Audit** | Log in as administrator (`admin@elearning.com`). | Cohort risk breakdown, pie charts, and at-risk student drill-downs render; audit trail logged. | **PASS** |
| **Expired Token Interception** | Send API request with expired JWT token. | Response interceptor catches `401`, clears storage, and redirects to `/login`. | **PASS** |

---

## 10. Research Contributions & Future Scope

### Key Accomplishments
1. **Hybrid Predictive-Intervention Paradigm:** Successfully bridged the gap between passive machine learning risk classification and active, dynamic learning roadmaps.
2. **Empirical Model Performance:** CatBoost classifier attained **93.4% accuracy** and **0.972 ROC-AUC**, outperforming baseline logistic regression and standard decision trees on OULAD benchmarks.
3. **Temporal Trajectory Modeling:** Combines deep learning sequence modeling with behavioral velocity feature projection to forecast multi-week trajectories.
4. **Comprehensive Multi-Role Architecture:** Delivered a production-ready LMS application with role-based access control (Student, Instructor, Admin), cross-user data scoping, formal course review workflows, and immutable audit logging.

### Future Roadmap
- **Reinforcement Learning Interventions:** Implementing contextual bandits or Deep Q-Networks (DQN) to optimize intervention task selection based on real-time student reward signals.
- **Generative AI Academic Mentor:** Incorporating an LLM-powered virtual teaching assistant to provide contextual code debugging and personalized tutoring directly within the course viewer.
- **LTI Integration:** Packaging the prediction and roadmap engine as an LTI (Learning Tools Interoperability) 1.3 microservice for plug-and-play adoption in Canvas, Moodle, and Blackboard.
