import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import './Landing.css';

const Landing = () => {
  const navigate = useNavigate();
  const [featuredCourses, setFeaturedCourses] = useState([]);

  useEffect(() => {
    // Fetch active courses to show as featured
    axios.get('/api/courses')
      .then(res => {
        // limit to 3 for featured
        setFeaturedCourses(res.data.slice(0, 3));
      })
      .catch(err => console.error("Error fetching courses", err));
  }, []);

  return (
    <div className="landing-screen">
      <Navbar />

      {/* Hero Section */}
      <div className="hero wrap" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div className="eyebrow" style={{ justifyContent: 'center', color: '#6b7280', textTransform: 'uppercase', fontSize: '14px', letterSpacing: '1px', marginBottom: '16px' }}>Your Learning Journey Starts Here</div>
        <h1 style={{ fontSize: '48px', fontWeight: '800', lineHeight: '1.2', marginBottom: '24px' }}>Manage courses,<br/><span className="line2" style={{ color: '#3b82f6' }}>track progress, achieve goals.</span></h1>
        <p style={{ fontSize: '18px', color: '#4b5563', maxWidth: '600px', margin: '0 auto', marginBottom: '40px' }}>A comprehensive platform for administrators to manage courses and students to enroll, learn, and succeed.</p>
        <button onClick={() => navigate('/student/register')} style={{ padding: '12px 24px', background: '#111827', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: '500', cursor: 'pointer' }}>Start Learning Now</button>
      </div>

      {/* Featured Courses Carousel */}
      <div className="featured-courses" style={{ padding: '60px 40px', background: '#f9fafb' }}>
        <h2 style={{ textAlign: 'center', fontSize: '32px', fontWeight: '700', marginBottom: '40px', color: '#111827' }}>Featured Courses</h2>
        <div className="course-grid" style={{ display: 'flex', gap: '24px', justifyContent: 'center', flexWrap: 'wrap', maxWidth: '1200px', margin: '0 auto' }}>
          {featuredCourses.length > 0 ? (
            featuredCourses.map(course => (
              <div key={course._id} className="course-card" style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', width: '300px' }}>
                <div className="thumbnail" style={{ height: '160px', background: '#e5e7eb', backgroundImage: `url(${course.thumbnail ? (course.thumbnail.startsWith('http') ? course.thumbnail : 'http://localhost:5000' + course.thumbnail) : 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600&auto=format&fit=crop'})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
                <div className="content" style={{ padding: '20px' }}>
                  <div className="tag" style={{ fontSize: '12px', color: '#3b82f6', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase' }}>{course.category}</div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>{course.title}</h3>
                  <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{course.description}</p>
                </div>
              </div>
            ))
          ) : (
            <p style={{ color: '#6b7280' }}>No courses available at the moment.</p>
          )}
        </div>
        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <button onClick={() => navigate('/catalog')} style={{ padding: '10px 20px', background: 'transparent', color: '#3b82f6', border: '1px solid #3b82f6', borderRadius: '4px', fontSize: '16px', fontWeight: '500', cursor: 'pointer' }}>Browse All Courses</button>
        </div>
      </div>

      {/* Roles Grid — both cards navigate to their respective login pages only, no credential bypass */}
      <div className="role-grid">
        <div className="role-card" onClick={() => navigate('/admin/login')}>
          <div className="tag">Administration</div>
          <h3>Administrator</h3>
          <p>Create and manage courses, track enrollments, and monitor student progress. Full control over the learning platform.</p>
          <div className="go">Sign in as Admin <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
        </div>
        <div className="role-card" onClick={() => navigate('/student/login')}>
          <div className="tag">Student Portal</div>
          <h3>Student</h3>
          <p>Browse available courses, enroll in classes, track your learning progress, and manage your academic journey.</p>
          <div className="go">Sign in as Student <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ background: '#111827', color: '#9ca3af', padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ marginBottom: '16px', fontWeight: '600', color: '#fff' }}>E-Learning System</div>
        <p style={{ fontSize: '14px' }}>&copy; {new Date().getFullYear()} E-Learning System. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Landing;
