from flask import Flask, jsonify
from flask_cors import CORS
from config.database import db

# Import blueprints
from routes.auth import auth_bp
from routes.courses import courses_bp
from routes.enrollments import enrollments_bp
from routes.admin import admin_bp
from routes.modules import modules_bp
from routes.media import media_bp
from routes.quizzes import quizzes_bp
from routes.assignments import assignments_bp
from routes.forum import forum_bp
from routes.student import student_bp

app = Flask(__name__)

# Enable CORS
CORS(app)

# Connect to MongoDB
db.connect()

# Register blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(courses_bp)
app.register_blueprint(enrollments_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(modules_bp)
app.register_blueprint(media_bp)
app.register_blueprint(quizzes_bp)
app.register_blueprint(assignments_bp)
app.register_blueprint(forum_bp)
app.register_blueprint(student_bp)

@app.route('/')
def home():
    return jsonify({
        'message': 'E-Learning Management System API',
        'version': '1.0.0'
    })

@app.route('/api/health')
def health_check():
    return jsonify({'status': 'healthy'}), 200

@app.route('/static/uploads/<path:filename>')
def serve_uploads(filename):
    import os
    from flask import send_from_directory
    upload_dir = os.path.join(app.root_path, 'static', 'uploads')
    return send_from_directory(upload_dir, filename)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
