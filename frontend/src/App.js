import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import AdminLogin from './pages/AdminLoginNew';
import StudentLogin from './pages/StudentLoginNew';
import StudentRegister from './pages/StudentRegister';
import AdminDashboard from './pages/AdminDashboardNew';
import StudentDashboard from './pages/StudentDashboardNew';
import CourseDetails from './pages/CourseDetails';
import MyCourses from './pages/MyCourses';
import Profile from './pages/Profile';
import { AuthProvider } from './context/AuthContext';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/student/login" element={<StudentLogin />} />
            <Route path="/student/register" element={<StudentRegister />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/student/dashboard" element={<StudentDashboard />} />
            <Route path="/course/:id" element={<CourseDetails />} />
            <Route path="/my-courses" element={<MyCourses />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
