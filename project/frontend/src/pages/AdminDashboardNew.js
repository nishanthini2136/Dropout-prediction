import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import axios from 'axios';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import './Dashboard.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const formatTimeAgo = (dateStr, now = Date.now()) => {
  if (!dateStr) return { text: 'Not calculated', isStale: true, isRecent: false, fullDate: 'Never' };
  
  let str = String(dateStr).trim();
  // Ensure UTC date strings without timezone indicator are correctly treated as UTC
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/.test(str)) {
    if (!str.endsWith('Z') && !/[+-]\d{2}(:\d{2})?$/.test(str)) {
      str = str.replace(' ', 'T') + 'Z';
    }
  }

  const date = new Date(str);
  const currentTime = typeof now === 'number' ? now : (now instanceof Date ? now.getTime() : new Date(now).getTime());
  const diffMs = currentTime - date.getTime();
  if (isNaN(diffMs)) return { text: 'Unknown', isStale: false, isRecent: false, fullDate: 'Unknown' };

  const diffSecs = Math.max(0, Math.floor(diffMs / 1000));
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  const isStale = diffDays >= 7;
  const isRecent = diffMins < 2;
  const fullDate = date.toLocaleString();

  if (diffSecs < 60) return { text: 'Just now', isStale: false, isRecent: true, fullDate };
  if (diffMins < 60) return { text: `${diffMins}m ago`, isStale: false, isRecent, fullDate };
  if (diffHours < 24) return { text: `${diffHours}h ago`, isStale: false, isRecent: false, fullDate };
  return { text: `${diffDays}d ago`, isStale, isRecent: false, fullDate };
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  // Navigation tabs: 'courses', 'reviews', 'instructors', 'students', 'alerts', 'analytics', 'audit'
  const [activeTab, setActiveTab] = useState('courses');
  
  // Core states
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [stats, setStats] = useState({ totalCourses: 0, totalEnrollments: 0, totalStudents: 0, seatsRemaining: 0 });
  const [toastMessage, setToastMessage] = useState('');
  const [recalculating, setRecalculating] = useState({}); // { [studentId]: boolean }
  const [recalculatingAll, setRecalculatingAll] = useState(false);
  
  // 1. Pending Course Reviews state
  const [pendingCourses, setPendingCourses] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [reviewActionInProgress, setReviewActionInProgress] = useState({}); // { [courseId]: boolean }
  const [rejectModalCourse, setRejectModalCourse] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  // 2. Instructors Management state
  const [instructors, setInstructors] = useState([]);
  const [loadingInstructors, setLoadingInstructors] = useState(false);
  const [showAddInstructorModal, setShowAddInstructorModal] = useState(false);
  const [newInstructor, setNewInstructor] = useState({ name: '', email: '', password: '', phone: '', bio: '' });
  const [addInstructorError, setAddInstructorError] = useState('');
  const [addInstructorSubmitting, setAddInstructorSubmitting] = useState(false);

  // 3. Audit Logs state
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);
  const [auditActionFilter, setAuditActionFilter] = useState('all');
  
  // Real-time relative clock
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);
  
  useEffect(() => {
    fetchStats();
    fetchPendingCoursesCount();
    
    if (activeTab === 'courses') fetchCourses();
    if (activeTab === 'reviews') fetchPendingCourses();
    if (activeTab === 'instructors') fetchInstructors();
    if (activeTab === 'students' || activeTab === 'alerts') fetchStudents();
    if (activeTab === 'analytics') fetchAnalytics();
    if (activeTab === 'audit') fetchAuditLogs();
  }, [activeTab]);

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/admin/dashboard');
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
      const response = await axios.get('/api/courses');
      const list = Array.isArray(response.data.courses || response.data) ? (response.data.courses || response.data) : [];
      setCourses(list);
      return list;
    } catch (error) {
      console.error('Error fetching courses:', error);
      return [];
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await axios.get('/api/admin/students');
      const studentsList = Array.isArray(response.data) ? response.data : (response.data.students || []);
      setStudents(studentsList);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await axios.get('/api/admin/analytics');
      const data = response.data.analytics || response.data;
      setAnalytics(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  // -------------------------------------------------------------
  // 1. Pending Course Reviews Handlers
  // -------------------------------------------------------------
  const fetchPendingCoursesCount = async () => {
    try {
      const res = await axios.get('/api/admin/courses/pending');
      const list = res.data.courses || [];
      setPendingCourses(list);
    } catch (err) {
      console.error('Failed to query pending courses count:', err);
    }
  };

  const fetchPendingCourses = async () => {
    setLoadingPending(true);
    try {
      const res = await axios.get('/api/admin/courses/pending');
      setPendingCourses(res.data.courses || []);
    } catch (err) {
      console.error('Error fetching pending courses:', err);
      setToastMessage(err.response?.data?.error || 'Failed to fetch pending courses');
    } finally {
      setLoadingPending(false);
    }
  };

  const handleApproveCourse = async (course) => {
    const courseId = course._id;
    setReviewActionInProgress(prev => ({ ...prev, [courseId]: true }));
    try {
      const res = await axios.post(`/api/admin/courses/${courseId}/approve`);
      // Optimistically remove from pending list
      setPendingCourses(prev => prev.filter(c => c._id !== courseId));
      setToastMessage(res.data.message || `Course "${course.title}" approved and published successfully!`);
      fetchStats();
    } catch (err) {
      console.error('Error approving course:', err);
      setToastMessage(err.response?.data?.error || 'Failed to approve course');
    } finally {
      setReviewActionInProgress(prev => ({ ...prev, [courseId]: false }));
    }
  };

  const handleOpenRejectModal = (course) => {
    setRejectModalCourse(course);
    setRejectionReason('');
  };

  const handleCloseRejectModal = () => {
    setRejectModalCourse(null);
    setRejectionReason('');
  };

  const handleRejectCourseSubmit = async (e) => {
    e.preventDefault();
    if (!rejectModalCourse) return;
    if (!rejectionReason.trim()) {
      setToastMessage('Rejection reason is required.');
      return;
    }

    const courseId = rejectModalCourse._id;
    const courseTitle = rejectModalCourse.title;
    setRejectSubmitting(true);
    try {
      const res = await axios.post(`/api/admin/courses/${courseId}/reject`, {
        rejection_reason: rejectionReason.trim()
      });
      // Optimistically remove from pending list
      setPendingCourses(prev => prev.filter(c => c._id !== courseId));
      setToastMessage(res.data.message || `Course "${courseTitle}" returned with rejection feedback.`);
      handleCloseRejectModal();
      fetchStats();
    } catch (err) {
      console.error('Error rejecting course:', err);
      setToastMessage(err.response?.data?.error || 'Failed to reject course');
    } finally {
      setRejectSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // 2. Instructor Management Handlers
  // -------------------------------------------------------------
  const fetchInstructors = async () => {
    setLoadingInstructors(true);
    try {
      const res = await axios.get('/api/admin/instructors');
      setInstructors(res.data.instructors || []);
    } catch (err) {
      console.error('Error fetching instructors:', err);
      setToastMessage(err.response?.data?.error || 'Failed to fetch instructors');
    } finally {
      setLoadingInstructors(false);
    }
  };

  const handleCreateInstructorSubmit = async (e) => {
    e.preventDefault();
    setAddInstructorError('');

    if (!newInstructor.name.trim() || !newInstructor.email.trim() || !newInstructor.password.trim()) {
      setAddInstructorError('Name, email, and temporary password are required.');
      return;
    }

    setAddInstructorSubmitting(true);
    try {
      const res = await axios.post('/api/admin/instructors', {
        name: newInstructor.name.trim(),
        email: newInstructor.email.trim().toLowerCase(),
        password: newInstructor.password,
        phone: newInstructor.phone.trim(),
        bio: newInstructor.bio.trim()
      });

      setToastMessage(res.data.message || `Instructor "${newInstructor.name}" provisioned successfully!`);
      setShowAddInstructorModal(false);
      setNewInstructor({ name: '', email: '', password: '', phone: '', bio: '' });
      fetchInstructors();
    } catch (err) {
      console.error('Error creating instructor:', err);
      setAddInstructorError(err.response?.data?.error || 'Failed to provision instructor');
    } finally {
      setAddInstructorSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // 3. Audit Logs Handlers
  // -------------------------------------------------------------
  const fetchAuditLogs = async (filter = auditActionFilter) => {
    setLoadingAuditLogs(true);
    try {
      const url = filter && filter !== 'all' 
        ? `/api/admin/audit-logs?action=${filter}` 
        : '/api/admin/audit-logs';
      const res = await axios.get(url);
      setAuditLogs(res.data.logs || []);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setToastMessage(err.response?.data?.error || 'Failed to fetch audit logs');
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  const handleAuditFilterChange = (e) => {
    const val = e.target.value;
    setAuditActionFilter(val);
    fetchAuditLogs(val);
  };

  // -------------------------------------------------------------
  // 4. Student Risk Handlers
  // -------------------------------------------------------------
  const handleRecalculateRisk = async (studentId) => {
    try {
      setRecalculating(prev => ({ ...prev, [studentId]: true }));
      const response = await axios.post(`/api/admin/risk/recalculate`, { student_id: studentId });
      
      const updated = response.data.student;
      const nowIso = new Date().toISOString();
      if (updated) {
        setStudents(prev => prev.map(s => s._id === studentId ? { ...s, ...updated } : s));
      } else if (response.data.risk_score !== undefined) {
        setStudents(prev => prev.map(s => s._id === studentId ? {
          ...s,
          risk_score: response.data.risk_score,
          risk_badge: response.data.risk_badge,
          last_calculated: response.data.last_calculated || nowIso
        } : s));
      }
      
      setCurrentTime(Date.now());
      setToastMessage(response.data.message || 'Risk recalculated successfully.');
      fetchStats();
      if (activeTab === 'analytics') fetchAnalytics();
    } catch (error) {
      console.error('Error recalculating risk:', error);
      setToastMessage('Error recalculating risk.');
    } finally {
      setRecalculating(prev => ({ ...prev, [studentId]: false }));
    }
  };

  const handleRecalculateAllRisk = async () => {
    try {
      setRecalculatingAll(true);
      const response = await axios.post(`/api/admin/risk/recalculate`, {});
      setToastMessage(response.data.message || 'All student risks recalculated.');
      await fetchStudents();
      setCurrentTime(Date.now());
      fetchStats();
      if (activeTab === 'analytics') fetchAnalytics();
    } catch (error) {
      console.error('Error recalculating all risks:', error);
      setToastMessage('Error recalculating risks.');
    } finally {
      setRecalculatingAll(false);
    }
  };

  const getActionBadgeStyle = (action) => {
    switch (action) {
      case 'approve_course':
        return { bg: '#ecfdf5', color: '#047857', label: 'Approve Course' };
      case 'reject_course':
        return { bg: '#fee2e2', color: '#b91c1c', label: 'Reject Course' };
      case 'provision_instructor':
        return { bg: '#f3e8ff', color: '#7e22ce', label: 'Provision Instructor' };
      case 'recalculate_student_risk':
        return { bg: '#e0f2fe', color: '#0369a1', label: 'Risk Recalculation' };
      case 'view_student_roster':
        return { bg: '#f1f5f9', color: '#475569', label: 'View Roster' };
      default:
        return { bg: '#f8fafc', color: '#334155', label: action || 'Action' };
    }
  };

  return (
    <div className="dashboard-screen">
      <Navbar />

      <div className="wrap">
        <div className="dash-header">
          <h1>Admin Control Center</h1>
          <p>Review course submissions, manage faculty instructors, monitor student risk intelligence, and audit operations.</p>
        </div>

        <div className="stat-row">
          <div className="stat-card"><div className="icon">📚</div><div className="num">{stats.totalCourses}</div><div className="lbl">Published Courses</div></div>
          <div className="stat-card"><div className="icon">⏳</div><div className="num" style={{ color: pendingCourses.length > 0 ? '#f59e0b' : 'inherit' }}>{pendingCourses.length}</div><div className="lbl">Pending Review</div></div>
          <div className="stat-card"><div className="icon">👥</div><div className="num">{stats.totalEnrollments}</div><div className="lbl">Total Enrollments</div></div>
          <div className="stat-card"><div className="icon">🎓</div><div className="num">{stats.totalStudents}</div><div className="lbl">Registered Students</div></div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '30px', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px', flexWrap: 'wrap' }}>
          {[
            { id: 'courses', label: 'Published Courses' },
            { id: 'reviews', label: `Pending Reviews${pendingCourses.length > 0 ? ` (${pendingCourses.length})` : ''}`, badge: pendingCourses.length > 0 },
            { id: 'instructors', label: 'Instructors' },
            { id: 'students', label: 'Students' },
            { id: 'alerts', label: 'Risk Alerts' },
            { id: 'analytics', label: 'Analytics' },
            { id: 'audit', label: 'Audit Log' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? '3px solid #3b82f6' : '3px solid transparent',
                fontSize: '15px',
                fontWeight: activeTab === tab.id ? '700' : '500',
                color: activeTab === tab.id ? '#1d4ed8' : '#64748b',
                padding: '10px 14px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
              {tab.badge && (
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
              )}
            </button>
          ))}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: PUBLISHED COURSES                                      */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'courses' && (
          <div>
            <div className="section-head">
              <h2>Published Course Catalog</h2>
            </div>
            <table className="admin-table">
              <thead><tr><th>Course</th><th>Code</th><th>Instructor</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {courses.map(course => (
                  <tr key={course._id}>
                    <td><div className="ttitle">{course.title}</div><div style={{ fontSize: '12px', color: '#9CA3AF' }}>{course.category}</div></td>
                    <td className="tcode">{course.code || '—'}</td>
                    <td>{course.instructor || 'E-Learning Faculty'}</td>
                    <td><span className={`status-badge ${course.is_active ? 'active' : 'inactive'}`}>{course.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      <button 
                        className="btn btn-ghost btn-sm" 
                        onClick={() => navigate(`/course/${course._id}`)}
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                      >
                        👁️ View Course
                      </button>
                    </td>
                  </tr>
                ))}
                {courses.length === 0 && (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No courses in catalog.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: PENDING COURSE REVIEWS                                  */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'reviews' && (
          <div>
            <div className="section-head" style={{ marginBottom: '20px' }}>
              <div>
                <h2>Pending Course Reviews</h2>
                <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>
                  Evaluate course curriculum, video resources, and assessment materials submitted by instructors.
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={fetchPendingCourses} disabled={loadingPending}>
                {loadingPending ? 'Refreshing...' : '🔄 Refresh Queue'}
              </button>
            </div>

            {loadingPending ? (
              <div style={{ background: '#fff', padding: '40px', borderRadius: '12px', textAlign: 'center', color: '#64748b', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
                <div>Loading pending review submissions...</div>
              </div>
            ) : pendingCourses.length === 0 ? (
              <div style={{ background: '#ffffff', padding: '48px 24px', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
                <h3 style={{ margin: '0 0 6px', color: '#0f172a', fontWeight: '700' }}>No courses pending review</h3>
                <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
                  All instructor course submissions have been reviewed and published.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
                {pendingCourses.map(course => {
                  const isProcessing = reviewActionInProgress[course._id];
                  const moduleCount = Array.isArray(course.modules) ? course.modules.length : 0;
                  const dateStr = course.updated_at || course.created_at;
                  const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Recently';

                  return (
                    <div 
                      key={course._id}
                      style={{ 
                        background: '#ffffff', 
                        borderRadius: '12px', 
                        border: '1px solid #e2e8f0', 
                        padding: '20px', 
                        boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#d97706', background: '#fef3c7', padding: '3px 8px', borderRadius: '4px' }}>
                            Pending Review
                          </span>
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Submitted {formattedDate}</span>
                        </div>

                        <h3 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: '700', color: '#0f172a', lineHeight: 1.3 }}>
                          {course.title}
                        </h3>
                        
                        <div style={{ fontSize: '12px', color: '#3b82f6', fontWeight: '600', marginBottom: '12px' }}>
                          🏷️ {course.category || 'General'}
                        </div>

                        <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, margin: '0 0 16px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {course.description || 'No description provided.'}
                        </p>

                        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9', marginBottom: '18px', fontSize: '13px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ color: '#64748b' }}>Instructor:</span>
                            <span style={{ fontWeight: '600', color: '#0f172a' }}>{course.instructor_name || course.instructor || 'Unknown'}</span>
                          </div>
                          {course.instructor_email && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ color: '#64748b' }}>Email:</span>
                              <span style={{ color: '#475569', fontSize: '12px' }}>{course.instructor_email}</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748b' }}>Modules & Lessons:</span>
                            <span style={{ fontWeight: '600', color: '#0f172a' }}>{moduleCount} Modules</span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => navigate(`/course/${course._id}`)}
                          style={{ flex: 1, padding: '8px 0', fontSize: '13px', border: '1px solid #cbd5e1' }}
                        >
                          👁️ Preview
                        </button>
                        <button
                          onClick={() => handleOpenRejectModal(course)}
                          disabled={isProcessing}
                          style={{
                            flex: 1,
                            padding: '8px 0',
                            fontSize: '13px',
                            fontWeight: '600',
                            background: '#fff1f2',
                            color: '#e11d48',
                            border: '1px solid #fecdd3',
                            borderRadius: '6px',
                            cursor: isProcessing ? 'not-allowed' : 'pointer'
                          }}
                        >
                          ✕ Reject
                        </button>
                        <button
                          onClick={() => handleApproveCourse(course)}
                          disabled={isProcessing}
                          style={{
                            flex: 1.2,
                            padding: '8px 0',
                            fontSize: '13px',
                            fontWeight: '600',
                            background: '#10b981',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: isProcessing ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {isProcessing ? 'Saving...' : '✓ Approve'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: INSTRUCTORS MANAGEMENT                                 */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'instructors' && (
          <div>
            <div className="section-head" style={{ marginBottom: '20px' }}>
              <div>
                <h2>Instructor Directory & Faculty Management</h2>
                <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>
                  Provision instructor accounts, inspect course catalogs, and track cumulative student reach.
                </p>
              </div>
              <button 
                className="btn btn-gold btn-sm"
                onClick={() => { setShowAddInstructorModal(true); setAddInstructorError(''); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                + Provision Instructor
              </button>
            </div>

            {loadingInstructors ? (
              <div style={{ background: '#fff', padding: '40px', borderRadius: '12px', textAlign: 'center', color: '#64748b', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>👥</div>
                <div>Loading instructors...</div>
              </div>
            ) : instructors.length === 0 ? (
              <div style={{ background: '#ffffff', padding: '40px', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>👨‍🏫</div>
                <h3 style={{ margin: '0 0 6px', color: '#0f172a' }}>No instructors provisioned</h3>
                <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>Click "Provision Instructor" to create the first faculty account.</p>
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Instructor</th>
                    <th>Contact</th>
                    <th>Authored Courses</th>
                    <th>Total Student Reach</th>
                    <th>Status</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {instructors.map(inst => {
                    const joined = inst.created_at ? new Date(inst.created_at).toLocaleDateString() : 'Active Faculty';
                    return (
                      <tr key={inst._id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ 
                              width: '36px', 
                              height: '36px', 
                              borderRadius: '50%', 
                              background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)', 
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: '700',
                              fontSize: '13px'
                            }}>
                              {inst.name ? inst.name.slice(0, 2).toUpperCase() : 'IN'}
                            </div>
                            <div>
                              <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '14px' }}>{inst.name}</div>
                              <div style={{ fontSize: '12px', color: '#64748b' }}>{inst.bio || 'Platform Instructor'}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: '500', color: '#334155' }}>{inst.email}</div>
                          <div style={{ fontSize: '12px', color: '#94a3b8' }}>{inst.phone || 'No phone recorded'}</div>
                        </td>
                        <td>
                          <span style={{ 
                            fontWeight: '700', 
                            fontSize: '14px', 
                            color: '#4338ca', 
                            background: '#eef2ff', 
                            padding: '4px 10px', 
                            borderRadius: '6px' 
                          }}>
                            📚 {inst.course_count || 0} Courses
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '14px' }}>
                            👥 {inst.total_students || 0} Learners
                          </span>
                        </td>
                        <td>
                          <span style={{ 
                            fontSize: '11px', 
                            fontWeight: '700', 
                            color: '#15803d', 
                            background: '#dcfce7', 
                            padding: '3px 8px', 
                            borderRadius: '12px' 
                          }}>
                            Active
                          </span>
                        </td>
                        <td style={{ fontSize: '13px', color: '#64748b' }}>
                          {joined}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 4: STUDENTS                                               */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'students' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: '0 0 4px 0' }}>Student Risk Monitoring</h2>
                <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
                  Per-student dropout probability generated by the CatBoost machine learning model.
                </p>
              </div>
              <button 
                className="btn btn-sm btn-gold" 
                onClick={handleRecalculateAllRisk}
                disabled={recalculatingAll}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px' }}
              >
                {recalculatingAll ? '🔄 Recalculating All...' : '⚡ Recalculate All Cohort Risks'}
              </button>
            </div>

            <table className="admin-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Enrolled Course(s)</th>
                  <th>Risk Level</th>
                  <th>Risk Percentage</th>
                  <th>Last Calculated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map(student => {
                  const staleness = formatTimeAgo(student.last_calculated || student.updated_at, currentTime);
                  const isBusy = recalculating[student._id];
                  const riskScore = student.risk_score !== undefined && student.risk_score !== null ? Number(student.risk_score) : 0.0;
                  const isHigh = student.risk_badge === 'High';
                  const isMed = student.risk_badge === 'Medium';

                  return (
                    <tr key={student._id}>
                      <td>
                        <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '14px' }}>{student.name}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{student.email}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxWidth: '280px' }}>
                          {student.courses && student.courses.length > 0 ? (
                            student.courses.map((c, i) => (
                              <span key={i} style={{ 
                                fontSize: '11px', 
                                fontWeight: '600', 
                                background: c.is_completed ? '#ecfdf5' : '#f8fafc',
                                color: c.is_completed ? '#047857' : '#1e293b',
                                border: `1px solid ${c.is_completed ? '#a7f3d0' : '#e2e8f0'}`,
                                padding: '3px 8px', 
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                📖 {c.title}
                                <span style={{ fontSize: '10px', color: c.is_completed ? '#059669' : '#64748b' }}>
                                  ({c.progress}%)
                                </span>
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>No active enrollments</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span style={{ 
                          background: isHigh ? '#fee2e2' : isMed ? '#fef3c7' : '#dcfce7', 
                          color: isHigh ? '#ef4444' : isMed ? '#b45309' : '#15803d',
                          border: 'none', padding: '4px 12px', borderRadius: '12px',
                          fontWeight: '700', fontSize: '12px', display: 'inline-block'
                        }}>
                          {student.risk_badge || 'Low'}
                        </span>
                      </td>
                      <td>
                        <div style={{ minWidth: '120px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ 
                              fontWeight: '800', 
                              fontSize: '15px', 
                              color: isHigh ? '#e11d48' : isMed ? '#d97706' : '#16a34a' 
                            }}>
                              {riskScore.toFixed(1)}%
                            </span>
                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>Dropout prob.</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ 
                              width: `${Math.min(100, Math.max(0, riskScore))}%`, 
                              height: '100%', 
                              background: isHigh ? '#f43f5e' : isMed ? '#f59e0b' : '#10b981',
                              borderRadius: '3px',
                              transition: 'width 0.4s ease'
                            }} />
                          </div>
                        </div>
                      </td>
                      <td>
                        <span 
                          title={`Last evaluated: ${staleness.fullDate}`}
                          style={{ fontSize: '13px', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          {staleness.isRecent && (
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                          )}
                          <span style={{ fontWeight: staleness.isRecent ? '700' : '400', color: staleness.isRecent ? '#15803d' : '#475569' }}>
                            {staleness.text}
                          </span>
                          {staleness.isStale && (
                            <span title="Risk data is older than 7 days" style={{ background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                              ⚠️ Needs Refresh
                            </span>
                          )}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="btn btn-sm btn-ghost" 
                          onClick={() => handleRecalculateRisk(student._id)}
                          disabled={isBusy}
                          style={{ 
                            border: '1px solid #cbd5e1', 
                            padding: '6px 12px', 
                            fontSize: '12px', 
                            fontWeight: '600',
                            background: isBusy ? '#f1f5f9' : '#ffffff',
                            cursor: isBusy ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          {isBusy ? '🔄 Calculating...' : '⚡ Recalculate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 5: ALERTS                                                 */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'alerts' && (
          <div>
            <div className="section-head">
              <h2>High Risk Student Alerts</h2>
              <p>Filtered list of students with 'High' dropout risk requiring academic intervention.</p>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Enrolled Course(s)</th>
                  <th>Risk Score</th>
                  <th>Last Calculated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.filter(s => s.risk_badge === 'High').map(student => {
                  const staleness = formatTimeAgo(student.last_calculated || student.updated_at, currentTime);
                  const isBusy = recalculating[student._id];
                  const riskScore = student.risk_score !== undefined && student.risk_score !== null ? Number(student.risk_score) : 0.0;

                  return (
                    <tr key={student._id}>
                      <td>
                        <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '14px' }}>{student.name}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{student.email}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxWidth: '280px' }}>
                          {student.courses && student.courses.length > 0 ? (
                            student.courses.map((c, i) => (
                              <span key={i} style={{ 
                                fontSize: '11px', 
                                fontWeight: '600', 
                                background: '#fee2e2',
                                color: '#991b1b',
                                border: '1px solid #fecdd3',
                                padding: '3px 8px', 
                                borderRadius: '6px'
                              }}>
                                📖 {c.title} ({c.progress}%)
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>No active enrollments</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ minWidth: '120px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontWeight: '800', fontSize: '15px', color: '#e11d48' }}>
                              {riskScore.toFixed(1)}%
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', background: '#fee2e2', color: '#e11d48' }}>
                              CRITICAL
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ 
                              width: `${Math.min(100, Math.max(0, riskScore))}%`, 
                              height: '100%', 
                              background: '#f43f5e', 
                              borderRadius: '3px' 
                            }} />
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '13px', color: '#64748b' }}>
                          {staleness.text}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="btn btn-sm btn-ghost" 
                          onClick={() => handleRecalculateRisk(student._id)}
                          disabled={isBusy}
                          style={{ border: '1px solid #cbd5e1', padding: '6px 12px', fontSize: '12px', fontWeight: '600' }}
                        >
                          {isBusy ? '🔄 Calculating...' : '⚡ Recalculate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {students.filter(s => s.risk_badge === 'High').length === 0 && (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>No high-risk students found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 6: ANALYTICS                                              */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'analytics' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
                  Platform Analytics & Risk Intelligence
                </h2>
                <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
                  Cohort-wide dropout risk modeling, active student monitoring, and curriculum engagement metrics.
                </p>
              </div>
            </div>

            {analytics ? (
              <>
                {/* Executive KPI Summary Cards */}
                {(() => {
                  const high = analytics.risk_distribution?.High || 0;
                  const medium = analytics.risk_distribution?.Medium || 0;
                  const low = analytics.risk_distribution?.Low || 0;
                  const total = high + medium + low;
                  const highPct = total > 0 ? Math.round((high / total) * 100) : 0;
                  const lowPct = total > 0 ? Math.round((low / total) * 100) : 0;
                  const totalEnrolled = (analytics.top_courses || []).reduce((sum, c) => sum + (c.enrolled_count || 0), 0);

                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                      <div style={{ background: '#ffffff', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Monitored Students</div>
                        <div style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>{total}</div>
                        <div style={{ fontSize: '12px', color: '#0284c7', marginTop: '4px', fontWeight: '500' }}>Active learner cohort</div>
                      </div>

                      <div style={{ background: '#ffffff', padding: '18px 20px', borderRadius: '12px', border: '1px solid #fecdd3', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#e11d48', textTransform: 'uppercase', letterSpacing: '0.05em' }}>High Risk Students</div>
                        <div style={{ fontSize: '26px', fontWeight: '800', color: '#e11d48', marginTop: '6px' }}>{high} <span style={{ fontSize: '14px', fontWeight: '600', color: '#f43f5e' }}>({highPct}%)</span></div>
                        <div style={{ fontSize: '12px', color: '#e11d48', marginTop: '4px', fontWeight: '500' }}>Needs immediate intervention</div>
                      </div>

                      <div style={{ background: '#ffffff', padding: '18px 20px', borderRadius: '12px', border: '1px solid #bbf7d0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Low Risk / Safe</div>
                        <div style={{ fontSize: '26px', fontWeight: '800', color: '#15803d', marginTop: '6px' }}>{low} <span style={{ fontSize: '14px', fontWeight: '600', color: '#16a34a' }}>({lowPct}%)</span></div>
                        <div style={{ fontSize: '12px', color: '#15803d', marginTop: '4px', fontWeight: '500' }}>Steady learning velocity</div>
                      </div>

                      <div style={{ background: '#ffffff', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Enrollments</div>
                        <div style={{ fontSize: '26px', fontWeight: '800', color: '#4338ca', marginTop: '6px' }}>{totalEnrolled}</div>
                        <div style={{ fontSize: '12px', color: '#6366f1', marginTop: '4px', fontWeight: '500' }}>Across {analytics.top_courses?.length || 0} published courses</div>
                      </div>
                    </div>
                  );
                })()}

                {/* Main Charts Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px', marginBottom: '24px' }}>
                  {/* Doughnut Chart */}
                  <div style={{ background: '#ffffff', padding: '24px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ marginBottom: '16px' }}>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>Cohort Risk Profiling</h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>Predictive machine learning classification breakdown</p>
                    </div>

                    <div style={{ position: 'relative', height: '210px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Doughnut 
                        data={{
                          labels: ['High Risk', 'Medium Risk', 'Low Risk'],
                          datasets: [{
                            data: [
                              analytics.risk_distribution?.High || 0, 
                              analytics.risk_distribution?.Medium || 0, 
                              analytics.risk_distribution?.Low || 0
                            ],
                            backgroundColor: ['#f43f5e', '#f59e0b', '#10b981'],
                            hoverBackgroundColor: ['#e11d48', '#d97706', '#059669'],
                            borderWidth: 3,
                            borderColor: '#ffffff'
                          }]
                        }}
                        options={{
                          maintainAspectRatio: false,
                          cutout: '74%',
                          plugins: {
                            legend: { display: false },
                            tooltip: {
                              callbacks: {
                                label: function(context) {
                                  const total = (context.dataset.data || []).reduce((a, b) => a + b, 0);
                                  const val = context.raw || 0;
                                  const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                                  return ` ${context.label}: ${val} (${pct}%)`;
                                }
                              }
                            }
                          }
                        }}
                      />
                      <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
                        <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', lineHeight: 1.1 }}>
                          {(analytics.risk_distribution?.High || 0) + (analytics.risk_distribution?.Medium || 0) + (analytics.risk_distribution?.Low || 0)}
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Students</div>
                      </div>
                    </div>

                    <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
                      <div style={{ padding: '8px 4px', background: '#fff1f2', borderRadius: '8px', border: '1px solid #ffe4e6' }}>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: '#e11d48' }}>High</div>
                        <div style={{ fontSize: '15px', fontWeight: '800', color: '#e11d48', marginTop: '2px' }}>{analytics.risk_distribution?.High || 0}</div>
                      </div>
                      <div style={{ padding: '8px 4px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fef3c7' }}>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: '#b45309' }}>Medium</div>
                        <div style={{ fontSize: '15px', fontWeight: '800', color: '#b45309', marginTop: '2px' }}>{analytics.risk_distribution?.Medium || 0}</div>
                      </div>
                      <div style={{ padding: '8px 4px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #dcfce7' }}>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: '#15803d' }}>Low</div>
                        <div style={{ fontSize: '15px', fontWeight: '800', color: '#15803d', marginTop: '2px' }}>{analytics.risk_distribution?.Low || 0}</div>
                      </div>
                    </div>
                  </div>

                  {/* Horizontal Bar Chart */}
                  <div style={{ background: '#ffffff', padding: '24px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>Curriculum Enrollment Volume</h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>Student enrollment count across published courses</p>
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#6366f1', background: '#eef2ff', padding: '4px 10px', borderRadius: '6px' }}>
                        Top {analytics.top_courses?.length || 0} Courses
                      </span>
                    </div>

                    <div style={{ flex: 1, minHeight: '260px' }}>
                      <Bar 
                        data={{
                          labels: (analytics.top_courses || []).map(c => c.title),
                          datasets: [{
                            label: 'Enrolled Students',
                            data: (analytics.top_courses || []).map(c => c.enrolled_count),
                            backgroundColor: '#4f46e5',
                            hoverBackgroundColor: '#4338ca',
                            borderRadius: 6,
                            barThickness: 16
                          }]
                        }}
                        options={{ 
                          indexAxis: 'y',
                          responsive: true, 
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { display: false },
                            tooltip: {
                              backgroundColor: '#0f172a',
                              titleFont: { size: 12, weight: 'bold' },
                              bodyFont: { size: 12 },
                              padding: 10,
                              cornerRadius: 6,
                              callbacks: { label: (context) => ` ${context.raw} Enrolled Students` }
                            }
                          },
                          scales: { 
                            x: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { precision: 0, stepSize: 1, font: { size: 11 } } },
                            y: { grid: { display: false }, ticks: { font: { size: 12, weight: '500' }, color: '#334155' } }
                          } 
                        }}
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ background: '#fff', padding: '40px', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#64748b', textAlign: 'center' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>📊</div>
                <div style={{ fontWeight: '600' }}>Loading platform analytics...</div>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 8: AUDIT LOG                                              */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'audit' && (
          <div>
            <div className="section-head" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2>Administrative Audit Log</h2>
                <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>
                  Immutable security audit trail recording course approvals, rejections, instructor provisioning, and cross-user data access.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <select
                  value={auditActionFilter}
                  onChange={handleAuditFilterChange}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                >
                  <option value="all">All Actions</option>
                  <option value="approve_course">Course Approvals</option>
                  <option value="reject_course">Course Rejections</option>
                  <option value="provision_instructor">Instructor Provisioning</option>
                  <option value="recalculate_student_risk">Risk Recalculations</option>
                  <option value="view_student_roster">Roster Views</option>
                </select>
                <button className="btn btn-ghost btn-sm" onClick={() => fetchAuditLogs(auditActionFilter)} disabled={loadingAuditLogs}>
                  {loadingAuditLogs ? 'Refreshing...' : '🔄 Refresh'}
                </button>
              </div>
            </div>

            {loadingAuditLogs ? (
              <div style={{ background: '#fff', padding: '40px', borderRadius: '12px', textAlign: 'center', color: '#64748b', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>📜</div>
                <div>Loading audit log records...</div>
              </div>
            ) : auditLogs.length === 0 ? (
              <div style={{ background: '#ffffff', padding: '40px', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</div>
                <h3 style={{ margin: '0 0 6px', color: '#0f172a' }}>No audit records found</h3>
                <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>No administrative events recorded matching this filter.</p>
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Administrator</th>
                    <th>Action</th>
                    <th>Target / Resource</th>
                    <th>Context Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map(log => {
                    const badge = getActionBadgeStyle(log.action);
                    const ts = log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A';
                    return (
                      <tr key={log._id}>
                        <td style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {ts}
                        </td>
                        <td>
                          <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '13px' }}>{log.admin_name || 'Administrator'}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{log.admin_email || String(log.admin_id || '')}</div>
                        </td>
                        <td>
                          <span style={{ 
                            fontSize: '11px', 
                            fontWeight: '700', 
                            padding: '3px 8px', 
                            borderRadius: '6px', 
                            background: badge.bg, 
                            color: badge.color 
                          }}>
                            {badge.label}
                          </span>
                        </td>
                        <td style={{ fontSize: '13px', color: '#334155' }}>
                          {log.details?.title || log.details?.name || log.target_user_id || 'System Entity'}
                        </td>
                        <td style={{ fontSize: '12px', color: '#64748b', maxWidth: '320px' }}>
                          {log.details?.rejection_reason && (
                            <div style={{ color: '#b91c1c' }}>Reason: "{log.details.rejection_reason}"</div>
                          )}
                          {log.details?.email && (
                            <div>Email: {log.details.email}</div>
                          )}
                          {log.details?.course_id && (
                            <div>Course ID: {String(log.details.course_id)}</div>
                          )}
                          {log.details?.ip && (
                            <div style={{ color: '#94a3b8' }}>IP: {log.details.ip}</div>
                          )}
                          {!log.details?.rejection_reason && !log.details?.email && !log.details?.course_id && !log.details?.ip && (
                            <div>Standard operation</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        <footer className="dash-footer">E-LEARNING MANAGEMENT SYSTEM — ADMIN CONTROL CENTER</footer>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* REJECT COURSE MODAL                                           */}
      {/* ------------------------------------------------------------- */}
      {rejectModalCourse && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '14px',
            maxWidth: '520px',
            width: '100%',
            padding: '28px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                  Reject Course Submission
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  Provide constructive revision feedback for "{rejectModalCourse.title}"
                </p>
              </div>
              <button 
                onClick={handleCloseRejectModal}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRejectCourseSubmit}>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Rejection Reason / Required Changes <span style={{ color: '#e11d48' }}>*</span>
                </label>
                <textarea
                  rows="4"
                  required
                  placeholder="e.g. Please update Module 2 video resources and add at least 3 practice questions to the final quiz before resubmitting."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleCloseRejectModal}
                  disabled={rejectSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rejectSubmitting || !rejectionReason.trim()}
                  style={{
                    background: '#e11d48',
                    color: '#ffffff',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: (rejectSubmitting || !rejectionReason.trim()) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {rejectSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* ADD INSTRUCTOR MODAL                                          */}
      {/* ------------------------------------------------------------- */}
      {showAddInstructorModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '14px',
            maxWidth: '540px',
            width: '100%',
            padding: '28px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                  Provision Faculty Instructor
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  Create an instructor account with course authoring and grading permissions.
                </p>
              </div>
              <button 
                onClick={() => setShowAddInstructorModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {addInstructorError && (
              <div style={{ background: '#fff1f2', color: '#e11d48', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', border: '1px solid #fecdd3' }}>
                {addInstructorError}
              </div>
            )}

            <form onSubmit={handleCreateInstructorSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                  Full Name <span style={{ color: '#e11d48' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Alan Turing"
                  value={newInstructor.name}
                  onChange={(e) => setNewInstructor({ ...newInstructor, name: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    Email Address <span style={{ color: '#e11d48' }}>*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="instructor@domain.com"
                    value={newInstructor.email}
                    onChange={(e) => setNewInstructor({ ...newInstructor, email: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    Temporary Password <span style={{ color: '#e11d48' }}>*</span>
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={newInstructor.password}
                    onChange={(e) => setNewInstructor({ ...newInstructor, password: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                  Phone Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="+1 (555) 019-2831"
                  value={newInstructor.phone}
                  onChange={(e) => setNewInstructor({ ...newInstructor, phone: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                  Academic Bio / Specialization
                </label>
                <textarea
                  rows="2"
                  placeholder="e.g. Professor of Machine Learning & Neural Networks with 10+ years teaching experience."
                  value={newInstructor.bio}
                  onChange={(e) => setNewInstructor({ ...newInstructor, bio: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowAddInstructorModal(false)}
                  disabled={addInstructorSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-gold"
                  disabled={addInstructorSubmitting}
                  style={{ padding: '9px 22px' }}
                >
                  {addInstructorSubmitting ? 'Provisioning...' : 'Provision Instructor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Toast message={toastMessage} />
    </div>
  );
};

export default AdminDashboard;
