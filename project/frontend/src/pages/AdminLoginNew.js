import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const AdminLogin = () => {
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
      await login(formData.email, formData.password, 'admin');
      navigate('/admin/dashboard');
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
          <div className="eyebrow" style={{ marginBottom: '18px' }}>Administrator access</div>
          <p className="quote">Create and manage courses, track enrollments, and monitor student progress. <span>Full control</span> over the learning platform.</p>
        </div>
        <div className="ledger-index">
          <div className="row"><span>Course Management</span><span>Full Access</span></div>
          <div className="row"><span>Student Monitoring</span><span>Enabled</span></div>
          <div className="row"><span>Platform Status</span><span>Active</span></div>
        </div>
      </div>
      <div className="auth-form-side">
        <div className="auth-box">
          <div className="back-link" onClick={() => navigate('/')}>← Back to role select</div>
          <h2>Administrator sign in</h2>
          <div className="sub">Manage courses, enrollments, and student progress.</div>
          {error && <div className="error-message">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Email address</label>
              <input type="email" name="email" placeholder="admin@example.com" value={formData.email} onChange={handleChange} required />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" name="password" placeholder="••••••••••" value={formData.password} onChange={handleChange} required />
            </div>
            <div className="form-foot">
              <label><input type="checkbox" defaultChecked style={{ accentColor: 'var(--gold)' }} /> Keep me signed in</label>
              <a href="#" style={{ color: 'var(--ink-faint)', textDecoration: 'none' }}>Forgot password?</a>
            </div>
            <button className="btn btn-gold" type="submit">Enter Admin Dashboard</button>
          </form>
          <div className="hint">Not an administrator? <b onClick={() => navigate('/student/login')} style={{ cursor: 'pointer' }}>Sign in as a student →</b></div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
