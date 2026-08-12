import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import CourseCard from '../components/CourseCard';
import Navbar from '../components/Navbar';
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
      fetchCourses();
      fetchEnrolledCourses();
    } catch (error) {
      setToastMessage(error.response?.data?.error || 'Error enrolling course');
    }
  };

  const handleDrop = async (enrollmentId) => {
    if (window.confirm('Are you sure you want to drop this course?')) {
      try {
        await axios.delete(`/api/enrollments/${enrollmentId}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        setToastMessage('Course dropped successfully');
        fetchCourses();
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
      <Navbar />

      <div className="wrap" style={{ padding: '40px 20px' }}>
        <button 
          onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/')} 
          style={{ 
            marginBottom: '20px', 
            background: '#ffffff', 
            border: '1px solid #CBD5E1', 
            borderRadius: '6px', 
            padding: '8px 16px', 
            cursor: 'pointer', 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '6px', 
            fontWeight: '500', 
            color: '#334155',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          ← Back
        </button>
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
              const capacity = course.capacity !== undefined ? course.capacity : 30;
              const seatsLeft = course.seats_left !== undefined ? course.seats_left : Math.max(0, capacity - (course.enrolled_count || 0));
              const isFull = seatsLeft <= 0;
              return (
                <CourseCard 
                  key={course._id} 
                  course={course} 
                  isEnrolled={isEnrolled} 
                  onEnroll={() => handleEnroll(course._id)} 
                  onDrop={() => handleDrop(getEnrollmentId(course._id))} 
                  seatsLeft={seatsLeft} 
                  full={isFull} 
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
