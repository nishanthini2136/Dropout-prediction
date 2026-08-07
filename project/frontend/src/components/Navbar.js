import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'US';

  const handleBrandClick = () => {
    if (user?.role === 'admin') {
      navigate('/admin/dashboard');
    } else if (user?.role === 'student') {
      navigate('/student/dashboard');
    } else {
      navigate('/');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="dash-nav" style={{ background: '#0F172A', borderBottom: '1px solid #1E293B', padding: '12px 0' }}>
      <div className="wrap" style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Brandmark */}
        <div className="brandmark" onClick={handleBrandClick} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="seal" style={{ width: '34px', height: '34px', borderRadius: '50%', border: '1.5px solid #D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '15px', color: '#D4AF37' }}>E</div>
          <div className="name" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: '600', fontSize: '19px', color: '#ffffff' }}>
            E-Learning<em style={{ fontStyle: 'italic', color: '#D4AF37', fontWeight: '500' }}>System</em>
          </div>
        </div>

        {/* Right Actions */}
        <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {/* Courses link - always visible for all users */}
          <button 
            onClick={() => navigate('/catalog')} 
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: location.pathname === '/catalog' ? '#D4AF37' : '#ffffff', 
              fontWeight: location.pathname === '/catalog' ? '600' : '500', 
              fontSize: '14px', 
              cursor: 'pointer',
              padding: '6px 12px'
            }}
          >
            Courses
          </button>

          {user ? (
            <>
              {/* Dashboard link */}
              <button 
                onClick={() => navigate(`/${user.role}/dashboard`)} 
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: location.pathname.includes('/dashboard') ? '#D4AF37' : '#ffffff', 
                  fontWeight: location.pathname.includes('/dashboard') ? '600' : '500', 
                  fontSize: '14px', 
                  cursor: 'pointer',
                  padding: '6px 12px'
                }}
              >
                Dashboard
              </button>


              {/* Role Pill */}
              <span className={`role-pill ${user.role}`} style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                padding: '4px 12px',
                borderRadius: '20px',
                border: user.role === 'admin' ? '1px solid #D4AF37' : '1px solid rgba(47, 191, 159, 0.4)',
                color: user.role === 'admin' ? '#D4AF37' : '#2fbfbf',
                background: user.role === 'admin' ? 'rgba(212, 175, 55, 0.15)' : 'transparent'
              }}>
                {user.role === 'admin' ? 'Administrator' : 'Student'}
              </span>

              {/* Avatar */}
              <div className="avatar" style={{ 
                width: '36px', 
                height: '36px', 
                borderRadius: '50%', 
                background: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)', 
                border: '2px solid #D4AF37', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontWeight: '600', 
                fontSize: '13px', 
                color: '#ffffff' 
              }}>
                {getInitials(user.name)}
              </div>

              {/* Sign out */}
              <button 
                className="btn btn-ghost btn-sm" 
                onClick={handleLogout}
                style={{ 
                  background: 'transparent', 
                  border: '1px solid rgba(255, 255, 255, 0.2)', 
                  color: '#ffffff', 
                  borderRadius: '6px', 
                  padding: '6px 14px', 
                  fontSize: '13px', 
                  cursor: 'pointer' 
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => navigate('/student/login')} 
                style={{ background: 'transparent', border: 'none', color: '#ffffff', fontWeight: '500', fontSize: '14px', cursor: 'pointer', padding: '6px 12px' }}
              >
                Login
              </button>
              <button 
                onClick={() => navigate('/student/register')} 
                style={{ background: '#3b82f6', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '8px 16px', fontWeight: '500', fontSize: '14px', cursor: 'pointer' }}
              >
                Register
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Navbar;
