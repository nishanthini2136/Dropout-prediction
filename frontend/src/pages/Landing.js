import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Landing.css';

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="landing-screen">
      <div className="wrap">
        <div className="top">
          <div className="brandmark">
            <div className="seal">E</div>
            <div className="name">E-Learning<em>System</em></div>
          </div>
          <div className="eyebrow">Course Management Platform</div>
        </div>
      </div>

      <div className="hero wrap">
        <div className="eyebrow" style={{ justifyContent: 'center' }}>Your Learning Journey Starts Here</div>
        <h1>Manage courses,<span className="line2">track progress, achieve goals.</span></h1>
        <p>A comprehensive platform for administrators to manage courses and students to enroll, learn, and succeed.</p>
      </div>

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
    </div>
  );
};

export default Landing;
