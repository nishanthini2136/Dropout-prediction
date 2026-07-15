import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const StudentRegister = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    bio: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    const { confirmPassword, ...registrationData } = formData;
    registrationData.role = 'student';

    const result = await register(registrationData);
    
    if (result.success) {
      navigate('/student/login');
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div className="auth-screen">
      <div className="auth-visual">
        <div>
          <div className="brandmark" style={{ marginBottom: '60px' }}>
            <div className="seal">E</div>
            <div className="name">E-Learning<em>System</em></div>
          </div>
          <div className="eyebrow" style={{ marginBottom: '18px' }}>Student registration</div>
          <p className="quote">Create your student account to access courses, track progress, and manage your learning journey.</p>
        </div>
        <div className="ledger-index">
          <div className="row"><span>Course Access</span><span>Full</span></div>
          <div className="row"><span>Progress Tracking</span><span>Enabled</span></div>
          <div className="row"><span>Learning Tools</span><span>Ready</span></div>
        </div>
      </div>
      <div className="auth-form-side">
        <div className="auth-box">
          <div className="back-link" onClick={() => navigate('/')}>← Back to role select</div>
          <h2>Student registration</h2>
          <div className="sub">Create your account to start learning.</div>
          {error && <div className="error-message">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Full name</label>
              <input type="text" name="name" placeholder="Enter your full name" value={formData.name} onChange={handleChange} required />
            </div>
            <div className="field">
              <label>Email address</label>
              <input type="email" name="email" placeholder="student@example.com" value={formData.email} onChange={handleChange} required />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" name="password" placeholder="••••••••••" value={formData.password} onChange={handleChange} required />
            </div>
            <div className="field">
              <label>Confirm password</label>
              <input type="password" name="confirmPassword" placeholder="••••••••••" value={formData.confirmPassword} onChange={handleChange} required />
            </div>
            <div className="field">
              <label>Phone (optional)</label>
              <input type="text" name="phone" placeholder="+1 234 567 890" value={formData.phone} onChange={handleChange} />
            </div>
            <div className="field">
              <label>Bio (optional)</label>
              <textarea name="bio" rows="3" placeholder="Tell us about yourself" value={formData.bio} onChange={handleChange} />
            </div>
            <button className="btn btn-teal" style={{ width: '100%' }} type="submit" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Student Account'}
            </button>
          </form>
          <div className="hint">Already have an account? <b onClick={() => navigate('/student/login')} style={{ cursor: 'pointer' }}>Sign in as Student →</b></div>
        </div>
      </div>
    </div>
  );
};

export default StudentRegister;
