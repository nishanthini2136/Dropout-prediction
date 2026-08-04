import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import CourseCard from '../components/CourseCard';
import Toast from '../components/Toast';
import './Dashboard.css'; // Reuse dashboard styles for layout

const CourseCatalog = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  const [courses, setCourses] = useState([]);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  
  // Filtering state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');
  
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    fetchCourses();
    if (user && user.role === 'student') {
      fetchEnrolledCourses();
    }
  }, [user]);

  const fetchCourses = async () => {
    try {
      const response = await axios.get('/api/courses'); // Public or authenticated
      setCourses(Array.isArray(response.data.courses || response.data) ? (response.data.courses || response.data) : []);
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const fetchEnrolledCourses = async () => {
    if (!localStorage.getItem('token')) return;
    try {
      const response = await axios.get('/api/enrollments/my-courses', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setEnrolledCourses(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching enrolled courses:', error);
    }
  };

  const handleEnroll = async (courseId) => {
    if (!user) {
      navigate('/student/login');
      return;
    }
    try {
      await axios.post('/api/enrollments', { course_id: courseId }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setToastMessage('Enrolled successfully');
      fetchEnrolledCourses();
    } catch (error) {
      setToastMessage('Error enrolling course');
    }
  };

  const handleDrop = async (enrollmentId) => {
    if (window.confirm('Are you sure you want to drop this course?')) {
      try {
        await axios.delete(`/api/enrollments/${enrollmentId}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        setToastMessage('Course dropped successfully');
        fetchEnrolledCourses();
      } catch (error) {
        setToastMessage('Error dropping course');
      }
    }
  };

  const getEnrollmentId = (courseId) => {
    const enrollment = enrolledCourses.find(e => e.course_id._id === courseId || e.course_id === courseId);
    return enrollment ? enrollment._id : null;
  };

  const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'US';

  // Derived filters
  const categories = [...new Set(courses.map(c => c.category).filter(Boolean))];
  const levels = [...new Set(courses.map(c => c.difficulty).filter(Boolean))];

  const filteredCourses = courses.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (c.code && c.code.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory ? c.category === selectedCategory : true;
    const matchesLevel = selectedLevel ? c.difficulty === selectedLevel : true;
    return matchesSearch && matchesCategory && matchesLevel;
  });

  return (
    <div className="dashboard-screen">
      {/* Navigation */}
      <div className="dash-nav">
        <div className="wrap">
          <div className="brandmark" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <div className="seal">E</div>
            <div className="name">E-Learning<em>System</em></div>
          </div>
          <div className="nav-actions" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <button onClick={() => navigate('/catalog')} style={{ padding: '8px 16px', background: 'transparent', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '500' }}>Courses</button>
            
            {user ? (
              <>
                <button onClick={() => navigate(`/${user.role}/dashboard`)} style={{ padding: '8px 16px', background: 'transparent', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '500' }}>Dashboard</button>
                <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>{getInitials(user.name)}</div>
                <button className="btn btn-ghost btn-sm" style={{ borderColor: 'rgba(255,255,255,0.2)', color: '#fff' }} onClick={() => { logout(); navigate('/'); }}>Sign out</button>
              </>
            ) : (
              <>
                <button onClick={() => navigate('/student/login')} style={{ padding: '8px 16px', background: 'transparent', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '500' }}>Login</button>
                <button onClick={() => navigate('/student/register')} style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' }}>Register</button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="wrap" style={{ padding: '40px 20px' }}>
        <div className="dash-header" style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1>Course Catalog</h1>
          <p>Discover our wide range of courses and start your learning journey today.</p>
        </div>

        {/* Filters */}
        <div className="search-bar" style={{ display: 'flex', gap: '15px', marginBottom: '40px', background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <input 
            type="text" 
            placeholder="Search by title or code..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            style={{ flex: 1, padding: '12px', border: '1px solid #e5e7eb', borderRadius: '6px' }}
          />
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ padding: '12px', border: '1px solid #e5e7eb', borderRadius: '6px', minWidth: '180px' }}
          >
            <option value="">All Categories</option>
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <select 
            value={selectedLevel} 
            onChange={(e) => setSelectedLevel(e.target.value)}
            style={{ padding: '12px', border: '1px solid #e5e7eb', borderRadius: '6px', minWidth: '180px' }}
          >
            <option value="">All Levels</option>
            {levels.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
          </select>
        </div>

        {/* Course Grid */}
        <div className="course-grid">
          {filteredCourses.length > 0 ? (
            filteredCourses.map(course => {
              const isEnrolled = !!getEnrollmentId(course._id);
              return (
                <CourseCard 
                  key={course._id} 
                  course={course} 
                  isEnrolled={isEnrolled} 
                  onEnroll={() => handleEnroll(course._id)} 
                  onDrop={() => handleDrop(getEnrollmentId(course._id))} 
                  seatsLeft={30} 
                  full={false} 
                />
              )
            })
          ) : (
            <div className="empty-state" style={{ gridColumn: '1/-1' }}>
              <h3>No courses found</h3>
              <p>Try adjusting your search or filters.</p>
            </div>
          )}
        </div>
      </div>
      
      <footer className="dash-footer" style={{ textAlign: 'center', padding: '20px', color: '#9ca3af', marginTop: 'auto' }}>
        E-LEARNING MANAGEMENT SYSTEM — CATALOG
      </footer>
      <Toast message={toastMessage} />
    </div>
  );
};

export default CourseCatalog;
