import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import AdminLogin from './pages/AdminLoginNew';
import StudentLogin from './pages/StudentLoginNew';
import StudentRegister from './pages/StudentRegister';
import AdminDashboard from './pages/AdminDashboardNew';
import StudentDashboard from './pages/StudentDashboardNew';
import InstructorDashboard from './pages/InstructorDashboard';
import CourseDetails from './pages/CourseDetails';
import CourseCreator from './pages/CourseCreator';
import MyCourses from './pages/MyCourses';
import Profile from './pages/Profile';
import CourseCatalog from './pages/CourseCatalog';
import RequireRole from './components/RequireRole';
import { AuthProvider } from './context/AuthContext';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/catalog" element={<CourseCatalog />} />
            <Route path="/course/:id" element={<CourseDetails />} />
            <Route path="/login" element={<Login />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/student/login" element={<StudentLogin />} />
            <Route path="/student/register" element={<StudentRegister />} />

            {/* Student Scoped Routes */}
            <Route
              path="/student/dashboard"
              element={
                <RequireRole allowedRoles={['student']}>
                  <StudentDashboard />
                </RequireRole>
              }
            />
            <Route
              path="/my-courses"
              element={
                <RequireRole allowedRoles={['student']}>
                  <MyCourses />
                </RequireRole>
              }
            />
            <Route
              path="/profile"
              element={
                <RequireRole allowedRoles={['student', 'instructor', 'admin']}>
                  <Profile />
                </RequireRole>
              }
            />

            {/* Instructor Scoped Routes */}
            <Route
              path="/instructor/dashboard"
              element={
                <RequireRole allowedRoles={['instructor', 'admin']}>
                  <InstructorDashboard />
                </RequireRole>
              }
            />
            <Route
              path="/instructor/course/create"
              element={
                <RequireRole allowedRoles={['instructor', 'admin']}>
                  <CourseCreator />
                </RequireRole>
              }
            />
            <Route
              path="/instructor/course/edit/:id"
              element={
                <RequireRole allowedRoles={['instructor', 'admin']}>
                  <CourseCreator />
                </RequireRole>
              }
            />

            {/* Admin Scoped Routes */}
            <Route
              path="/admin/dashboard"
              element={
                <RequireRole allowedRoles={['admin']}>
                  <AdminDashboard />
                </RequireRole>
              }
            />
            <Route
              path="/admin/course/create"
              element={
                <RequireRole allowedRoles={['admin']}>
                  <CourseCreator />
                </RequireRole>
              }
            />
            <Route
              path="/admin/course/edit/:id"
              element={
                <RequireRole allowedRoles={['admin']}>
                  <CourseCreator />
                </RequireRole>
              }
            />

            {/* Catch-all fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
