from flask import Flask, jsonify
from flask_cors import CORS
from config.database import db
from routes.auth import auth_bp
from routes.courses import courses_bp
from routes.enrollments import enrollments_bp
from routes.admin import admin_bp

app = Flask(__name__)

# Enable CORS
CORS(app)

# Connect to database
db.connect()

# Register blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(courses_bp)
app.register_blueprint(enrollments_bp)
app.register_blueprint(admin_bp)

@app.route('/')
def home():
    return jsonify({
        'message': 'E-Learning Management System API',
        'version': '1.0.0'
    })

@app.route('/api/health')
def health_check():
    return jsonify({'status': 'healthy'}), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
