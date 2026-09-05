import os
import sys
from datetime import datetime
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv(override=True)
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config.database import db
from models.user import User
from models.course import Course
from utils.auth import AuthUtils

def seed_instructors_and_courses():
    print("=== Starting Instructor and Course Seeding ===")
    
    # 1. Connect to MongoDB
    db.connect()
    database = db.get_db()
    users_col = database['users']
    courses_col = database['courses']

    # 2. Seed Instructor Accounts
    instructors_to_seed = [
        {
            'name': 'Dr. Alan Turing',
            'email': 'instructor1@elearning.com',
            'password': 'Instructor@123',
            'role': 'instructor',
            'phone': '+1 (555) 019-2831',
            'bio': 'Senior Professor in Computer Systems & Algorithmic Complexity with 15+ years of teaching experience.'
        },
        {
            'name': 'Dr. Ada Lovelace',
            'email': 'instructor2@elearning.com',
            'password': 'Instructor@123',
            'role': 'instructor',
            'phone': '+1 (555) 019-4720',
            'bio': 'Lead Research Scientist in Machine Learning, Neural Networks, and Distributed Computing.'
        }
    ]

    seeded_instructor_ids = {}

    for inst_data in instructors_to_seed:
        existing = users_col.find_one({'email': inst_data['email']})
        if existing:
            inst_id = str(existing['_id'])
            # Ensure role is set to instructor
            users_col.update_one({'_id': existing['_id']}, {'$set': {'role': 'instructor', 'updated_at': datetime.utcnow()}})
            print(f"[User] Instructor already exists: {inst_data['email']} (ID: {inst_id})")
        else:
            hashed_pw = AuthUtils.hash_password(inst_data['password'])
            new_user = {
                'name': inst_data['name'],
                'email': inst_data['email'],
                'password': hashed_pw,
                'role': 'instructor',
                'phone': inst_data['phone'],
                'bio': inst_data['bio'],
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow(),
                'last_active_at': datetime.utcnow()
            }
            res = users_col.insert_one(new_user)
            inst_id = str(res.inserted_id)
            print(f"[User] Created instructor: {inst_data['email']} (ID: {inst_id})")
            
        seeded_instructor_ids[inst_data['email']] = inst_id

    # 3. Seed Sample Draft & Pending Review Courses
    inst1_id = ObjectId(seeded_instructor_ids['instructor1@elearning.com'])
    inst2_id = ObjectId(seeded_instructor_ids['instructor2@elearning.com'])

    sample_courses = [
        {
            'title': 'Advanced Cloud Architecture & Microservices',
            'code': 'CS-401',
            'description': 'Master cloud-native distributed architecture, Docker containerization, Kubernetes orchestration, and event-driven patterns.',
            'category': 'Cloud Computing',
            'difficulty': 'Advanced',
            'credits': 30.0,
            'capacity': 40,
            'is_active': True,
            'status': 'pending_review',
            'instructor_id': inst1_id,
            'reviewed_by': None,
            'rejection_reason': None,
            'thumbnail': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800',
            'learning_outcomes': [
                'Design resilient multi-region cloud infrastructures',
                'Deploy and manage microservices using Kubernetes',
                'Implement distributed tracing and automated CI/CD pipelines'
            ],
            'modules': [
                {
                    '_id': 'mod_cloud_01',
                    'title': 'Module 1: Principles of Cloud-Native Systems',
                    'description': 'Introduction to 12-factor apps, service boundaries, and container basics.',
                    'lessons': [
                        {
                            'id': 'les_c1_01',
                            'title': '1.1 Monolith to Microservices Deconstruction',
                            'type': 'video',
                            'url': 'https://www.youtube.com/watch?v=1xo-0gCVhTU',
                            'duration': '18 min'
                        },
                        {
                            'id': 'les_c1_02',
                            'title': '1.2 Containerization with Docker Deep Dive',
                            'type': 'video',
                            'url': 'https://www.youtube.com/watch?v=fqMOX6JJhGo',
                            'duration': '22 min'
                        }
                    ]
                },
                {
                    '_id': 'mod_cloud_02',
                    'title': 'Module 2: Kubernetes Cluster Management',
                    'description': 'Pods, Deployments, StatefulSets, Ingress Controllers, and Service Mesh.',
                    'lessons': [
                        {
                            'id': 'les_c2_01',
                            'title': '2.1 Kubernetes Core Architecture',
                            'type': 'video',
                            'url': 'https://www.youtube.com/watch?v=X48VuDVv0do',
                            'duration': '25 min'
                        }
                    ]
                }
            ]
        },
        {
            'title': 'Deep Reinforcement Learning & Autonomous Agents',
            'code': 'AI-502',
            'description': 'Comprehensive hands-on study of Policy Gradients, Deep Q-Networks (DQN), Actor-Critic models, and Proximal Policy Optimization.',
            'category': 'Artificial Intelligence',
            'difficulty': 'Advanced',
            'credits': 30.0,
            'capacity': 35,
            'is_active': False,
            'status': 'draft',
            'instructor_id': inst2_id,
            'reviewed_by': None,
            'rejection_reason': None,
            'thumbnail': 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800',
            'learning_outcomes': [
                'Formulate real-world problems as Markov Decision Processes (MDPs)',
                'Train deep neural networks using PyTorch for continuous control tasks',
                'Implement multi-agent reinforcement learning environments'
            ],
            'modules': [
                {
                    '_id': 'mod_rl_01',
                    'title': 'Module 1: Foundations of Markov Decision Processes',
                    'description': 'Bellman equations, Value iteration, Policy iteration, and Temporal Difference learning.',
                    'lessons': [
                        {
                            'id': 'les_rl_01',
                            'title': '1.1 Introduction to Agent-Environment Interaction',
                            'type': 'video',
                            'url': 'https://www.youtube.com/watch?v=2pWv7GOvuf0',
                            'duration': '20 min'
                        }
                    ]
                }
            ]
        }
    ]

    for course_data in sample_courses:
        existing_course = courses_col.find_one({'title': course_data['title']})
        if existing_course:
            courses_col.update_one(
                {'_id': existing_course['_id']},
                {'$set': {
                    'status': course_data['status'],
                    'instructor_id': course_data['instructor_id'],
                    'updated_at': datetime.utcnow()
                }}
            )
            print(f"[Course] Updated existing course: '{course_data['title']}' -> Status: {course_data['status']}")
        else:
            course_data['created_at'] = datetime.utcnow()
            course_data['updated_at'] = datetime.utcnow()
            res = courses_col.insert_one(course_data)
            print(f"[Course] Created sample course: '{course_data['title']}' -> Status: {course_data['status']} (ID: {res.inserted_id})")

    print("\n=== Seeding Completed Successfully ===")
    print("Default Instructor Credentials:")
    print("1) Email: instructor1@elearning.com | Password: Instructor@123 (Dr. Alan Turing - Has 1 'pending_review' course)")
    print("2) Email: instructor2@elearning.com | Password: Instructor@123 (Dr. Ada Lovelace - Has 1 'draft' course)")

if __name__ == '__main__':
    seed_instructors_and_courses()
