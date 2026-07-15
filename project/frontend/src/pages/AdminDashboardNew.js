import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import axios from 'axios';
import './Dashboard.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [courses, setCourses] = useState([]);
  const [stats, setStats] = useState({ totalCourses: 0, totalEnrollments: 0, totalStudents: 0, seatsRemaining: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    code: '',
    category: 'Computer Science',
    instructor: '',
    description: '',
    duration: '',
    difficulty: 'Beginner',
    thumbnail: ''
  });

  useEffect(() => {
    fetchCourses();
    fetchStats();
  }, []);

  const fetchCourses = async () => {
    try {
      const response = await axios.get('/api/courses', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setCourses(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching courses:', error);
      setCourses([]);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const openModal = (course = null) => {
    if (course) {
      setEditingCourse(course);
      setFormData({
        title: course.title,
        code: course.code,
        category: course.category,
        instructor: course.instructor,
        description: course.description,
        duration: course.duration,
        difficulty: course.difficulty,
        thumbnail: course.thumbnail || ''
      });
    } else {
      setEditingCourse(null);
      setFormData({
        title: '',
        code: '',
        category: 'Computer Science',
        instructor: '',
        description: '',
        duration: '',
        difficulty: 'Beginner',
        thumbnail: ''
      });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingCourse(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      if (editingCourse) {
        await axios.put(`/api/courses/${editingCourse._id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setToastMessage('Course updated — students will see the change');
      } else {
        await axios.post('/api/courses', formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setToastMessage('Course published to student dashboards');
      }
      closeModal();
      fetchCourses();
      fetchStats();
    } catch (error) {
      console.error('Error saving course:', error);
      setToastMessage('Error saving course');
    }
  };

  const handleDelete = async (courseId) => {
    if (window.confirm('Are you sure you want to delete this course?')) {
      try {
        await axios.delete(`/api/courses/${courseId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setToastMessage('Course removed from the catalog');
        fetchCourses();
        fetchStats();
      } catch (error) {
        console.error('Error deleting course:', error);
        setToastMessage('Error deleting course');
      }
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const getInitials = (name) => {
    return name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'AD';
  };

  return (
    <div className="dashboard-screen">
      <div className="dash-nav">
        <div className="wrap">
          <div className="brandmark">
            <div className="seal">E</div>
            <div className="name">E-Learning<em>System</em></div>
          </div>
          <div className="nav-right">
            <span className="role-pill admin">Administrator</span>
            <div className="avatar">{getInitials(user?.name)}</div>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Sign out</button>
          </div>
        </div>
      </div>

      <div className="wrap">
        <div className="dash-header">
          <h1>Course Catalog Dashboard</h1>
          <p>Manage courses, instructors, enrollments, and student learning from one centralized dashboard.</p>
        </div>

        <div className="stat-row">
          <div className="stat-card">
            <div className="icon">📚</div>
            <div className="num">{stats.totalCourses}</div>
            <div className="lbl">Active Courses</div>
          </div>
          <div className="stat-card">
            <div className="icon">👥</div>
            <div className="num">{stats.totalEnrollments}</div>
            <div className="lbl">Total Enrollments</div>
          </div>
          <div className="stat-card">
            <div className="icon">🎓</div>
            <div className="num">{stats.totalStudents}</div>
            <div className="lbl">Registered Students</div>
          </div>
          <div className="stat-card">
            <div className="icon">💺</div>
            <div className="num">{stats.seatsRemaining}</div>
            <div className="lbl">Seats Remaining</div>
          </div>
        </div>

        <div className="section-head">
          <div>
            <h2>Course Management</h2>
            <p className="section-subtitle">Create, edit, and manage courses. Changes are immediately available to all students.</p>
          </div>
          <button className="btn btn-gold btn-sm" onClick={() => navigate('/admin/course/create')}>+ Add Course</button>
        </div>

        <div className="search-bar">
          <input type="text" placeholder="Search courses..." />
          <select className="toolbar-select">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select className="toolbar-select">
            <option value="">All Instructors</option>
          </select>
          <select className="toolbar-select">
            <option value="title">Sort by Title</option>
            <option value="code">Sort by Code</option>
            <option value="instructor">Sort by Instructor</option>
          </select>
        </div>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Course</th>
              <th>Code</th>
              <th>Instructor</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {courses.length === 0 ? (
              <tr>
                <td colSpan="5">
                  <div className="empty-state">
                    <div style={{ fontSize: '64px', marginBottom: '16px' }}>📚</div>
                    <div style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>No Courses Available</div>
                    <div style={{ fontSize: '14px', color: '#4B5563', marginBottom: '24px' }}>Start building your learning platform by creating your first course.</div>
                    <button className="btn btn-gold btn-sm" onClick={() => openModal()}>Add Your First Course</button>
                  </div>
                </td>
              </tr>
            ) : (
              courses.map(course => (
                <tr key={course._id}>
                  <td>
                    <div className="ttitle">{course.title}</div>
                    <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>{course.category}</div>
                  </td>
                  <td className="tcode">{course.code}</td>
                  <td>{course.instructor}</td>
                  <td>
                    <span className={`status-badge ${course.is_active ? 'active' : 'inactive'}`}>
                      {course.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-btn" title="Edit" onClick={() => openModal(course)}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 20h9"/>
                          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                        </svg>
                      </button>
                      <button className="icon-btn del" title="Delete" onClick={() => handleDelete(course._id)}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18"/>
                          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <footer className="dash-footer">E-LEARNING MANAGEMENT SYSTEM — ADMIN DASHBOARD</footer>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingCourse ? 'Edit Course' : 'Add a New Course'}
        subtitle="This will appear on every student dashboard immediately after saving."
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
            <button type="submit" form="course-form" className="btn btn-gold">Save Course</button>
          </>
        }
      >
        <form id="course-form" onSubmit={handleSubmit}>
          <div className="field">
            <label>Course title</label>
            <input name="title" placeholder="e.g. Introduction to Data Structures" value={formData.title} onChange={handleChange} required />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Course code</label>
              <input name="code" placeholder="e.g. CS-201" value={formData.code} onChange={handleChange} required />
            </div>
            <div className="field">
              <label>Category</label>
              <select name="category" value={formData.category} onChange={handleChange}>
                <option>Computer Science</option>
                <option>Design</option>
                <option>Business</option>
                <option>Mathematics</option>
                <option>Humanities</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>Instructor</label>
            <input name="instructor" placeholder="e.g. Dr. Lena Ortiz" value={formData.instructor} onChange={handleChange} required />
          </div>
          <div className="field">
            <label>Short description</label>
            <textarea name="description" rows="3" placeholder="One or two sentences about the course" value={formData.description} onChange={handleChange} required />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Duration</label>
              <input name="duration" placeholder="e.g. 8 weeks" value={formData.duration} onChange={handleChange} required />
            </div>
            <div className="field">
              <label>Difficulty</label>
              <select name="difficulty" value={formData.difficulty} onChange={handleChange}>
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>

      <Toast message={toastMessage} />
    </div>
  );
};

export default AdminDashboard;
