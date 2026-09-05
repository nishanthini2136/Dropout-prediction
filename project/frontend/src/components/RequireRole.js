import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const parseJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

const RequireRole = ({ allowedRoles = [], children }) => {
  const { token, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F172A', color: '#D4AF37' }}>
        <div style={{ fontSize: '16px', fontWeight: '500' }}>Verifying authorization...</div>
      </div>
    );
  }

  const storedToken = token || localStorage.getItem('token');
  if (!storedToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Parse role directly from verified decoded JWT token payload
  const decoded = parseJwt(storedToken);
  if (!decoded || !decoded.role) {
    localStorage.removeItem('token');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check token expiration
  if (decoded.exp && decoded.exp * 1000 < Date.now()) {
    localStorage.removeItem('token');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const userRole = decoded.role;

  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    // Redirect to the user's own authorized dashboard
    if (userRole === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    } else if (userRole === 'instructor') {
      return <Navigate to="/instructor/dashboard" replace />;
    } else {
      return <Navigate to="/student/dashboard" replace />;
    }
  }

  return children;
};

export default RequireRole;
