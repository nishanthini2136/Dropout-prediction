import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import axios from 'axios';
import { Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import './Dashboard.css';

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return { text: 'Not calculated', isStale: true };
  const date = new Date(dateStr);
  const diffMs = new Date() - date;
  if (isNaN(diffMs)) return { text: 'Unknown', isStale: false };
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const isStale = diffDays >= 7;

  if (diffMins < 1) return { text: 'Just now', isStale: false };
  if (diffMins < 60) return { text: `${diffMins}m ago`, isStale: false };
  if (diffHours < 24) return { text: `${diffHours}h ago`, isStale: false };
  return { text: `${diffDays}d ago`, isStale };
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('courses'); // courses, students, alerts, grading, analytics
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [stats, setStats] = useState({ totalCourses: 0, totalEnrollments: 0, totalStudents: 0, seatsRemaining: 0 });
  const [toastMessage, setToastMessage] = useState('');
  
  // Grading state
  const [assignments, setAssignments] = useState([]);
  const [selectedCourseForGrading, setSelectedCourseForGrading] = useState('');
  
  useEffect(() => {
    fetchStats();
    if (activeTab === 'courses') fetchCourses();
    if (activeTab === 'students' || activeTab === 'alerts') fetchStudents();
    if (activeTab === 'analytics') fetchAnalytics();
    if (activeTab === 'grading') {
      fetchCourses();
    }
  }, [activeTab]);

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/admin/dashboard', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const statsData = response.data.stats || response.data;
      setStats({
        totalCourses: statsData.total_courses || 0,
        totalEnrollments: statsData.total_enrollments || 0,
        totalStudents: statsData.total_students || 0,
        seatsRemaining: statsData.seats_remaining || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchCourses = async () => {
    try {
      const response = await axios.get('/api/courses', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setCourses(Array.isArray(response.data.courses || response.data) ? (response.data.courses || response.data) : []);
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await axios.get('/api/admin/students', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setStudents(response.data.students || []);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await axios.get('/api/admin/analytics', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setAnalytics(response.data.analytics);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const fetchAssignmentsForCourse = async (courseId) => {
    try {
      const response = await axios.get(`/api/assignments/course/${courseId}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setAssignments(response.data || []);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      setAssignments([]);
    }
  };

  const handleRecalculateRisk = async (studentId) => {
    try {
      await axios.post(`/api/admin/risk/recalculate`, { student_id: studentId }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setToastMessage('Risk recalculated successfully.');
      fetchStudents();
    } catch (error) {
      setToastMessage('Error recalculating risk.');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'AD';

  return (
    <div className="dashboard-screen">
      <Navbar />

      <div className="wrap">
        <div className="dash-header">
          <h1>Admin Dashboard</h1>
          <p>Manage courses, monitor student risk, and view platform analytics.</p>
        </div>

        <div className="stat-row">
          <div className="stat-card"><div className="icon">📚</div><div className="num">{stats.totalCourses}</div><div className="lbl">Active Courses</div></div>
          <div className="stat-card"><div className="icon">👥</div><div className="num">{stats.totalEnrollments}</div><div className="lbl">Total Enrollments</div></div>
          <div className="stat-card"><div className="icon">🎓</div><div className="num">{stats.totalStudents}</div><div className="lbl">Registered Students</div></div>
        </div>

        {/* Custom Tabs */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px' }}>
          <button 
            style={{ background: 'none', border: 'none', fontSize: '18px', fontWeight: activeTab === 'courses' ? 'bold' : 'normal', color: activeTab === 'courses' ? '#3b82f6' : '#6b7280', cursor: 'pointer' }}
            onClick={() => setActiveTab('courses')}
          >Courses</button>
          <button 
            style={{ background: 'none', border: 'none', fontSize: '18px', fontWeight: activeTab === 'students' ? 'bold' : 'normal', color: activeTab === 'students' ? '#3b82f6' : '#6b7280', cursor: 'pointer' }}
            onClick={() => setActiveTab('students')}
          >Students</button>
          <button 
            style={{ background: 'none', border: 'none', fontSize: '18px', fontWeight: activeTab === 'alerts' ? 'bold' : 'normal', color: activeTab === 'alerts' ? '#3b82f6' : '#6b7280', cursor: 'pointer' }}
            onClick={() => setActiveTab('alerts')}
          >Alerts</button>
          <button 
            style={{ background: 'none', border: 'none', fontSize: '18px', fontWeight: activeTab === 'grading' ? 'bold' : 'normal', color: activeTab === 'grading' ? '#3b82f6' : '#6b7280', cursor: 'pointer' }}
            onClick={() => setActiveTab('grading')}
          >Grading</button>
          <button 
            style={{ background: 'none', border: 'none', fontSize: '18px', fontWeight: activeTab === 'analytics' ? 'bold' : 'normal', color: activeTab === 'analytics' ? '#3b82f6' : '#6b7280', cursor: 'pointer' }}
            onClick={() => setActiveTab('analytics')}
          >Analytics</button>
        </div>

        {/* Tab Contents */}
        {activeTab === 'courses' && (
          <div>
            <div className="section-head">
              <h2>Course Catalog</h2>
              <button className="btn btn-gold btn-sm" onClick={() => navigate('/admin/course/create')}>+ Add Course</button>
            </div>
            <table className="admin-table">
              <thead><tr><th>Course</th><th>Code</th><th>Instructor</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {courses.map(course => (
                  <tr key={course._id}>
                    <td><div className="ttitle">{course.title}</div><div style={{ fontSize: '12px', color: '#9CA3AF' }}>{course.category}</div></td>
                    <td className="tcode">{course.code}</td>
                    <td>{course.instructor}</td>
                    <td><span className={`status-badge ${course.is_active ? 'active' : 'inactive'}`}>{course.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      <button 
                        className="btn btn-ghost btn-sm" 
                        onClick={() => navigate(`/admin/course/edit/${course._id}`)}
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                      >
                        ✏️ Edit Resources & Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}



        {activeTab === 'students' && (
          <div>
            <div className="section-head">
              <h2>Student Risk Monitoring</h2>
              <p>Monitor dropout risk scores generated by the CatBoost model.</p>
            </div>
            <table className="admin-table">
              <thead><tr><th>Student Name</th><th>Email</th><th>Risk Badge</th><th>Risk Score</th><th>Last Calculated</th><th>Actions</th></tr></thead>
              <tbody>
                {students.map(student => {
                  const staleness = formatTimeAgo(student.last_calculated || student.updated_at);
                  return (
                    <tr key={student._id}>
                      <td>{student.name}</td>
                      <td>{student.email}</td>
                      <td>
                        <span className="role-pill" style={{ 
                          background: student.risk_badge === 'High' ? '#fee2e2' : student.risk_badge === 'Medium' ? '#fef3c7' : '#dcfce3', 
                          color: student.risk_badge === 'High' ? '#ef4444' : student.risk_badge === 'Medium' ? '#f59e0b' : '#10b981',
                          border: 'none', padding: '4px 12px', borderRadius: '12px'
                        }}>
                          {student.risk_badge || 'Low'}
                        </span>
                      </td>
                      <td>{student.risk_score ? `${student.risk_score.toFixed(1)}%` : 'N/A'}</td>
                      <td>
                        <span style={{ fontSize: '13px', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {staleness.text}
                          {staleness.isStale && (
                            <span title="Risk data is older than 7 days — click Recalculate Risk to refresh" style={{ background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                              ⚠️ Needs Refresh
                            </span>
                          )}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-sm btn-ghost" onClick={() => handleRecalculateRisk(student._id)}>Recalculate Risk</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div>
            <div className="section-head">
              <h2>High Risk Student Alerts</h2>
              <p>Filtered list of students with 'High' dropout risk.</p>
            </div>
            <table className="admin-table">
              <thead><tr><th>Student Name</th><th>Email</th><th>Risk Score</th><th>Last Calculated</th><th>Actions</th></tr></thead>
              <tbody>
                {students.filter(s => s.risk_badge === 'High').map(student => {
                  const staleness = formatTimeAgo(student.last_calculated || student.updated_at);
                  return (
                    <tr key={student._id}>
                      <td>{student.name}</td>
                      <td>{student.email}</td>
                      <td><span style={{ color: '#ef4444', fontWeight: 'bold' }}>{student.risk_score ? `${student.risk_score.toFixed(1)}%` : 'N/A'}</span></td>
                      <td>
                        <span style={{ fontSize: '13px', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {staleness.text}
                          {staleness.isStale && (
                            <span title="Risk data is older than 7 days — click Recalculate Risk to refresh" style={{ background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                              ⚠️ Needs Refresh
                            </span>
                          )}
                        </span>
                      </td>
                      <td><button className="btn btn-sm btn-ghost" onClick={() => handleRecalculateRisk(student._id)}>Recalculate Risk</button></td>
                    </tr>
                  );
                })}
                {students.filter(s => s.risk_badge === 'High').length === 0 && (
                  <tr><td colSpan="5">No high-risk students found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'grading' && (
          <div>
            <div className="section-head">
              <h2>Assignment Grading</h2>
              <p>Select a course to view and grade assignment submissions.</p>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <select 
                value={selectedCourseForGrading} 
                onChange={(e) => {
                  setSelectedCourseForGrading(e.target.value);
                  if (e.target.value) fetchAssignmentsForCourse(e.target.value);
                }}
                style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', minWidth: '300px' }}
              >
                <option value="">-- Select a Course --</option>
                {courses.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
              </select>
            </div>
            
            {selectedCourseForGrading && (
              <div>
                {assignments.length > 0 ? (
                  <table className="admin-table">
                    <thead><tr><th>Assignment Title</th><th>Due Date</th><th>Weight</th><th>Actions</th></tr></thead>
                    <tbody>
                      {assignments.map(assign => (
                        <tr key={assign._id}>
                          <td>{assign.title}</td>
                          <td>{new Date(assign.due_date).toLocaleDateString()}</td>
                          <td>{assign.weight}%</td>
                          <td>
                            <button className="btn btn-sm btn-gold">View Submissions</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p>No assignments found for this course.</p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'analytics' && analytics && (
          <div>
            <div className="section-head">
              <h2>Platform Analytics</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', background: '#fff', padding: '30px', borderRadius: '10px', border: '1px solid #eaeaea' }}>
              <div>
                <h3>Risk Distribution</h3>
                <Pie 
                  data={{
                    labels: ['High', 'Medium', 'Low'],
                    datasets: [{
                      data: [analytics.risk_distribution.High || 0, analytics.risk_distribution.Medium || 0, analytics.risk_distribution.Low || 0],
                      backgroundColor: ['#ef4444', '#f59e0b', '#10b981']
                    }]
                  }}
                />
              </div>
              <div>
                <h3>Top Engaged Courses</h3>
                <Bar 
                  data={{
                    labels: analytics.top_courses.map(c => c.title),
                    datasets: [{
                      label: 'Enrollments',
                      data: analytics.top_courses.map(c => c.enrolled_count),
                      backgroundColor: '#3b82f6'
                    }]
                  }}
                  options={{ responsive: true, scales: { y: { min: 0 } } }}
                />
              </div>
            </div>
          </div>
        )}

        <footer className="dash-footer">E-LEARNING MANAGEMENT SYSTEM — ADMIN DASHBOARD</footer>
      </div>
      <Toast message={toastMessage} />
    </div>
  );
};

export default AdminDashboard;
