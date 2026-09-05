import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, parseJwt } from '../context/AuthContext';
import './Auth.css';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    
    try {
      const res = await login(formData.email.trim(), formData.password);
      
      // Determine destination strictly by decoded JWT role or authenticated user role
      const role = res.role || (res.token ? parseJwt(res.token)?.role : null) || 'student';
      
      if (role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else if (role === 'instructor') {
        navigate('/instructor/dashboard', { replace: true });
      } else {
        navigate('/student/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please check your email and password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-visual">
        <div>
          <div className="brandmark" style={{ marginBottom: '60px', cursor: 'pointer' }} onClick={() => navigate('/')}>
            <div className="seal">E</div>
            <div className="name">E-Learning<em>System</em></div>
          </div>
          <div className="eyebrow" style={{ marginBottom: '18px' }}>Unified LMS Portal</div>
          <p className="quote">
            Secure, personalized learning analytics & course management. <span>One sign-in</span> for students, instructors, and administrators.
          </p>
        </div>
        <div className="ledger-index">
          <div className="row"><span>Student Learning Studio</span><span>Online</span></div>
          <div className="row"><span>Instructor Authoring</span><span>Active</span></div>
          <div className="row"><span>Predictive Risk AI</span><span>Connected</span></div>
          <div className="row"><span>Role-Based Access</span><span>Enforced</span></div>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-box">
          <div className="back-link" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            ← Back
          </div>
          <h2>Account Sign In</h2>
          <div className="sub">Enter your email address and password to access your dashboard.</div>
          
          {error && <div className="error-message">{error}</div>}
          
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Email address</label>
              <input
                type="email"
                name="email"
                placeholder="name@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                autoFocus
              />
            </div>
            
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                name="password"
                placeholder="••••••••••••"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>
            
            <div className="form-foot">
              <label>
                <input type="checkbox" defaultChecked style={{ accentColor: 'var(--gold)' }} /> Remember me
              </label>
            </div>
            
            <button
              className="btn btn-gold"
              style={{ width: '100%', padding: '12px 0', fontSize: '15px', fontWeight: '600' }}
              type="submit"
              disabled={submitting}
            >
              {submitting ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
          
          <div className="hint" style={{ marginTop: '24px' }}>
            New student? <Link to="/student/register" style={{ color: 'var(--gold)', fontWeight: '600', textDecoration: 'none' }}>Create a student account →</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
