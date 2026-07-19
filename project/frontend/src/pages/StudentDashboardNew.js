import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CourseCard from '../components/CourseCard';
import Toast from '../components/Toast';
import axios from 'axios';
import './Dashboard.css';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [courses, setCourses] = useState([]);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    fetchCourses();
    fetchEnrolledCourses();

    // Set up polling for real-time updates
    const interval = setInterval(() => {
      fetchCourses();
      fetchEnrolledCourses();
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const fetchCourses = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/courses', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      console.log('Courses fetched successfully:', response.data);
      setCourses(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching courses:', error);
      console.error('Error response:', error.response);
      setCourses([]);
    }
  };

  const fetchEnrolledCourses = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/enrollments/my-courses', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      console.log('Enrolled courses fetched successfully:', response.data);
      setEnrolledCourses(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching enrolled courses:', error);
      console.error('Error response:', error.response);
      setEnrolledCourses([]);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleEnroll = async (courseId) => {
    try {
      const response = await axios.post('http://localhost:5000/api/enrollments', { course_id: courseId }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      console.log('Enrolled successfully:', response.data);
      setToastMessage('Enrolled successfully');
      fetchCourses();
      fetchEnrolledCourses();
    } catch (error) {
      console.error('Error enrolling:', error);
      console.error('Error response:', error.response);
      if (error.response) {
        setToastMessage(`Error: ${error.response.data?.message || error.response.statusText}`);
      } else if (error.request) {
        setToastMessage('Error: No response from server. Check if backend is running.');
      } else {
        setToastMessage(`Error: ${error.message}`);
      }
    }
  };

  const handleDrop = async (enrollmentId) => {
    if (window.confirm('Are you sure you want to drop this course?')) {
      try {
        const response = await axios.delete(`http://localhost:5000/api/enrollments/${enrollmentId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        console.log('Course dropped successfully:', response.data);
        setToastMessage('Course dropped successfully');
        fetchCourses();
        fetchEnrolledCourses();
      } catch (error) {
        console.error('Error dropping course:', error);
        console.error('Error response:', error.response);
        if (error.response) {
          setToastMessage(`Error: ${error.response.data?.message || error.response.statusText}`);
        } else if (error.request) {
          setToastMessage('Error: No response from server. Check if backend is running.');
        } else {
          setToastMessage(`Error: ${error.message}`);
        }
      }
    }
  };

  const handleUpdateProgress = async (enrollmentId, progress) => {
    try {
      await axios.put(`http://localhost:5000/api/enrollments/${enrollmentId}/progress`, { progress }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      fetchEnrolledCourses();
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  const filteredCourses = courses.filter(course =>
    course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name) => {
    return name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'ST';
  };

  const getEnrollmentId = (courseId) => {
    const enrollment = enrolledCourses.find(e => e.course_id._id === courseId);
    return enrollment ? enrollment._id : null;
  };

  return (
    <div className="dashboard-screen">
      <div className="dash-nav">
        <div className="wrap">
          <div className="brandmark">
            <div className="seal">E</div>
            <div className="name">E-Learning<em>System</em></div>
          </div>
          <div className="nav-right">
            <span className="role-pill student">Student</span>
            <div className="avatar">{getInitials(user?.name)}</div>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Sign out</button>
          </div>
        </div>
      </div>

      <div className="wrap">
        <div className="dash-header">
          <div className="eyebrow">Student Portal</div>
          <h1>Welcome back, {user?.name?.split(' ')[0]}.</h1>
          <p>Browse available courses, manage your enrollments, and track your learning progress.</p>
        </div>

        <div className="section-head">
          <h2>My Enrolled Courses</h2>
        </div>
        <div className="course-grid">
          {enrolledCourses.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1/-1' }}>
              You haven't enrolled in any courses yet — browse the catalog below.
            </div>
          ) : (
            enrolledCourses.map(enrollment => (
              <div key={enrollment._id} className="course-card">
                <div className="badge-enrolled">Enrolled</div>
                <div className="code">{enrollment.course_id.code} · {enrollment.course_id.category}</div>
                <h3>{enrollment.course_id.title}</h3>
                <div className="desc">{enrollment.course_id.description}</div>
                <div className="meta">
                  <span>{enrollment.course_id.instructor}</span>
                  <span className="seats-tag">{enrollment.progress}% complete</span>
                </div>
                <div className="progress-section">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${enrollment.progress}%` }}
                    />
                  </div>
                  <div className="progress-text">{enrollment.progress}% complete</div>
                </div>
                <div className="actions">
                  <button
                    className="btn btn-gold btn-sm"
                    style={{ width: '100%' }}
                    onClick={() => navigate(`/course/${enrollment.course_id._id}`)}
                  >
                    Continue Learning
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="section-head">
          <h2>Open Catalog</h2>
        </div>
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search courses by title or code…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="course-grid">
          {filteredCourses.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1/-1' }}>
              No courses match "{searchQuery}".
            </div>
          ) : (
            filteredCourses
              .filter(course => !enrolledCourses.find(e => e.course_id._id === course._id))
              .map(course => (
                <CourseCard
                  key={course._id}
                  course={course}
                  isEnrolled={false}
                  onEnroll={() => handleEnroll(course._id)}
                  onDrop={() => handleDrop(getEnrollmentId(course._id))}
                  seatsLeft={30 - (enrolledCourses.find(e => e.course_id._id === course._id)?.enrolled_count || 0)}
                  full={false}
                />
              ))
          )}
        </div>

        <footer className="dash-footer">E-LEARNING MANAGEMENT SYSTEM — STUDENT PORTAL</footer>
      </div>

      <Toast message={toastMessage} />
    </div>
  );
};

export default StudentDashboard;
