import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const StudentLogin = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(formData.email, formData.password, 'student');
      navigate('/student/dashboard');
    } catch (err) {
      setError('Invalid credentials. Please try again.');
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-visual">
        <div>
          <div className="brandmark" style={{ marginBottom: '60px' }}>
            <div className="seal">E</div>
            <div className="name">E-Learning<em>System</em></div>
          </div>
          <div className="eyebrow" style={{ marginBottom: '18px' }}>Student access</div>
          <p className="quote">Browse available courses, enroll in classes, and track your learning progress. <span>Your academic journey</span> starts here.</p>
        </div>
        <div className="ledger-index">
          <div className="row"><span>Available Courses</span><span>Open</span></div>
          <div className="row"><span>Progress Tracking</span><span>Enabled</span></div>
          <div className="row"><span>Learning Tools</span><span>Ready</span></div>
        </div>
      </div>
      <div className="auth-form-side">
        <div className="auth-box">
          <div className="back-link" onClick={() => navigate('/')}>← Back to role select</div>
          <h2>Student sign in</h2>
          <div className="sub">Access courses, track progress, and manage enrollments.</div>
          {error && <div className="error-message">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Email address</label>
              <input type="email" name="email" placeholder="student@example.com" value={formData.email} onChange={handleChange} required />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" name="password" placeholder="••••••••••" value={formData.password} onChange={handleChange} required />
            </div>
            <div className="form-foot">
              <label><input type="checkbox" defaultChecked style={{ accentColor: 'var(--teal)' }} /> Keep me signed in</label>
              <a href="#" style={{ color: 'var(--ink-faint)', textDecoration: 'none' }}>Forgot password?</a>
            </div>
            <button className="btn btn-teal" style={{ width: '100%' }} type="submit">Enter Student Dashboard</button>
          </form>
          <div className="hint">New student? <b onClick={() => navigate('/student/register')} style={{ cursor: 'pointer' }}>Create an account →</b></div>
        </div>
      </div>
    </div>
  );
};

export default StudentLogin;
