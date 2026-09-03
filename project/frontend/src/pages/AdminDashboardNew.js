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
  const [activeTab, setActiveTab] = useState('courses'); // courses, students, alerts, grading, analytics
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [stats, setStats] = useState({ totalCourses: 0, totalEnrollments: 0, totalStudents: 0, seatsRemaining: 0 });
  const [toastMessage, setToastMessage] = useState('');
  const [recalculating, setRecalculating] = useState({}); // { [studentId]: boolean }
  const [recalculatingAll, setRecalculatingAll] = useState(false);
  
  // Grading & Submission state
  const [assignments, setAssignments] = useState([]);
  const [selectedCourseForGrading, setSelectedCourseForGrading] = useState('');
  const [selectedAssignmentForSubmissions, setSelectedAssignmentForSubmissions] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [gradingData, setGradingData] = useState({}); // { [submissionId]: { grade, feedback } }
  
  // Real-time ticking state to dynamically update relative timestamps (e.g., "Just now" -> "1m ago" -> "2m ago")
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000); // Ticks every 10 seconds to dynamically update relative timestamps
    return () => clearInterval(timer);
  }, []);
  
  useEffect(() => {
    fetchStats();
    if (activeTab === 'courses') fetchCourses();
    if (activeTab === 'students' || activeTab === 'alerts') fetchStudents();
    if (activeTab === 'analytics') fetchAnalytics();
    if (activeTab === 'grading') {
      fetchCourses().then(courseList => {
        if (courseList && courseList.length > 0) {
          const defaultCid = selectedCourseForGrading || courseList[0]._id;
          setSelectedCourseForGrading(defaultCid);
          fetchAssignmentsForCourse(defaultCid);
        }
      });
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
      const response = await axios.get('/api/admin/students', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const studentsList = Array.isArray(response.data) ? response.data : (response.data.students || []);
      setStudents(studentsList);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await axios.get('/api/admin/analytics', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const data = response.data.analytics || response.data;
      setAnalytics(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const fetchAssignmentsForCourse = async (courseId) => {
    try {
      setSelectedAssignmentForSubmissions(null);
      setSubmissions([]);
      const response = await axios.get(`/api/assignments/course/${courseId}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setAssignments(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      setAssignments([]);
    }
  };

  const handleViewSubmissions = async (assignment) => {
    setSelectedAssignmentForSubmissions(assignment);
    setLoadingSubmissions(true);
    try {
      const response = await axios.get(`/api/assignments/${assignment._id}/submissions`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const list = Array.isArray(response.data) ? response.data : [];
      setSubmissions(list);
      const initialGrades = {};
      list.forEach(s => {
        initialGrades[s._id] = { grade: (s.grade !== null && s.grade !== undefined) ? s.grade : '', feedback: s.feedback || '' };
      });
      setGradingData(initialGrades);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      setSubmissions([]);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleGradeChange = (submissionId, field, value) => {
    setGradingData(prev => ({
      ...prev,
      [submissionId]: {
        ...prev[submissionId],
        [field]: value
      }
    }));
  };

  const handleGradeSubmit = async (submissionId) => {
    const current = gradingData[submissionId] || {};
    if (current.grade === '' || isNaN(current.grade) || current.grade < 0 || current.grade > 100) {
      setToastMessage('Please enter a valid numeric grade between 0 and 100.');
      return;
    }
    try {
      await axios.post(`/api/assignments/submission/${submissionId}/grade`, {
        grade: parseFloat(current.grade),
        feedback: current.feedback || ''
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setToastMessage('Grade and feedback saved successfully!');
      setSubmissions(prev => prev.map(s => s._id === submissionId ? {
        ...s,
        status: 'Graded',
        grade: parseFloat(current.grade),
        feedback: current.feedback
      } : s));
    } catch (error) {
      console.error('Error grading submission:', error);
      setToastMessage('Failed to submit grade.');
    }
  };

  const handleRecalculateRisk = async (studentId) => {
    try {
      setRecalculating(prev => ({ ...prev, [studentId]: true }));
      const response = await axios.post(`/api/admin/risk/recalculate`, { student_id: studentId }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      
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
      const response = await axios.post(`/api/admin/risk/recalculate`, {}, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
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
                            <span title="Risk data is older than 7 days — click Recalculate Risk to refresh" style={{ background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
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
                            <span title="Risk data is older than 7 days — click Recalculate Risk to refresh" style={{ background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
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
                            cursor: isBusy ? 'not-allowed' : 'pointer'
                          }}
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

        {activeTab === 'grading' && (
          <div>
            <div className="section-head">
              <h2>Assignment Grading</h2>
              <p>Select a course to view assignments and review student submissions.</p>
            </div>
            <div style={{ marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'center' }}>
              <select 
                value={selectedCourseForGrading} 
                onChange={(e) => {
                  setSelectedCourseForGrading(e.target.value);
                  if (e.target.value) fetchAssignmentsForCourse(e.target.value);
                }}
                style={{ padding: '10px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', minWidth: '320px', fontSize: '14px' }}
              >
                <option value="">-- Select a Course --</option>
                {courses.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
              </select>
            </div>
            
            {selectedCourseForGrading && (
              <div>
                {assignments.length > 0 ? (
                  <table className="admin-table" style={{ marginBottom: '30px' }}>
                    <thead>
                      <tr>
                        <th>Assignment Title</th>
                        <th>Due Date</th>
                        <th>Weight</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignments.map(assign => (
                        <tr key={assign._id} style={{ background: selectedAssignmentForSubmissions?._id === assign._id ? '#f1f5f9' : 'transparent' }}>
                          <td style={{ fontWeight: '600' }}>{assign.title}</td>
                          <td>{assign.due_date ? new Date(assign.due_date).toLocaleDateString() : 'No due date'}</td>
                          <td><span style={{ fontWeight: 'bold', color: '#0284c7' }}>{assign.weight}%</span></td>
                          <td>
                            <button 
                              className="btn btn-sm btn-gold" 
                              onClick={() => handleViewSubmissions(assign)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                              📋 View Submissions {selectedAssignmentForSubmissions?._id === assign._id ? '(Active)' : ''}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#64748b' }}>
                    No assignments found for this course.
                  </div>
                )}

                {/* Submissions Section */}
                {selectedAssignmentForSubmissions && (
                  <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '700' }}>
                          Submissions for "{selectedAssignmentForSubmissions.title}"
                        </h3>
                        <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '13px' }}>
                          {selectedAssignmentForSubmissions.description}
                        </p>
                      </div>
                      <button 
                        className="btn btn-sm btn-ghost" 
                        onClick={() => setSelectedAssignmentForSubmissions(null)}
                        style={{ border: '1px solid #cbd5e1', padding: '4px 10px' }}
                      >
                        ✕ Close
                      </button>
                    </div>

                    {loadingSubmissions ? (
                      <p style={{ color: '#64748b' }}>Loading submissions...</p>
                    ) : submissions.length > 0 ? (
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Student</th>
                            <th>Submission Content</th>
                            <th>Submitted At</th>
                            <th>Status</th>
                            <th>Grade (0-100)</th>
                            <th>Feedback</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {submissions.map(sub => {
                            const cur = gradingData[sub._id] || {};
                            return (
                              <tr key={sub._id}>
                                <td>
                                  <div style={{ fontWeight: '600', color: '#0f172a' }}>{sub.student_name || 'Student'}</div>
                                  <div style={{ fontSize: '12px', color: '#64748b' }}>{sub.student_email}</div>
                                </td>
                                <td style={{ maxWidth: '280px' }}>
                                  <div style={{ fontSize: '13px', color: '#334155', maxHeight: '75px', overflowY: 'auto', background: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                    {sub.text_content || 'No text content submitted'}
                                  </div>
                                </td>
                                <td style={{ fontSize: '12px', color: '#64748b' }}>
                                  {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : 'N/A'}
                                </td>
                                <td>
                                  <span style={{ 
                                    fontSize: '11px', 
                                    fontWeight: '700', 
                                    padding: '3px 8px', 
                                    borderRadius: '12px',
                                    background: sub.status === 'Graded' ? '#dcfce7' : '#fef3c7',
                                    color: sub.status === 'Graded' ? '#15803d' : '#b45309'
                                  }}>
                                    {sub.status || 'Submitted'}
                                  </span>
                                </td>
                                <td>
                                  <input 
                                    type="number" 
                                    min="0" 
                                    max="100" 
                                    step="0.5"
                                    placeholder="Score"
                                    value={cur.grade !== undefined ? cur.grade : ''}
                                    onChange={(e) => handleGradeChange(sub._id, 'grade', e.target.value)}
                                    style={{ width: '75px', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                                  />
                                </td>
                                <td>
                                  <input 
                                    type="text" 
                                    placeholder="Add feedback..."
                                    value={cur.feedback !== undefined ? cur.feedback : ''}
                                    onChange={(e) => handleGradeChange(sub._id, 'feedback', e.target.value)}
                                    style={{ width: '160px', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                                  />
                                </td>
                                <td>
                                  <button 
                                    className="btn btn-sm btn-gold"
                                    onClick={() => handleGradeSubmit(sub._id)}
                                    style={{ padding: '6px 12px', fontSize: '12px' }}
                                  >
                                    Save Grade
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <p style={{ color: '#64748b' }}>No submissions received for this assignment yet.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'analytics' && (
          <div>
            {/* Header */}
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
                  <div style={{ 
                    background: '#ffffff', 
                    padding: '24px', 
                    borderRadius: '14px', 
                    border: '1px solid #e2e8f0', 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    <div style={{ marginBottom: '16px' }}>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>Cohort Risk Profiling</h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                        Predictive machine learning classification breakdown
                      </p>
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
                      {/* Center Label inside Donut */}
                      <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
                        <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', lineHeight: 1.1 }}>
                          {(analytics.risk_distribution?.High || 0) + (analytics.risk_distribution?.Medium || 0) + (analytics.risk_distribution?.Low || 0)}
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Students</div>
                      </div>
                    </div>

                    {/* Clean Pill Legend */}
                    <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
                      <div style={{ padding: '8px 4px', background: '#fff1f2', borderRadius: '8px', border: '1px solid #ffe4e6' }}>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: '#e11d48' }}>High</div>
                        <div style={{ fontSize: '15px', fontWeight: '800', color: '#e11d48', marginTop: '2px' }}>
                          {analytics.risk_distribution?.High || 0}
                        </div>
                      </div>
                      <div style={{ padding: '8px 4px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fef3c7' }}>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: '#b45309' }}>Medium</div>
                        <div style={{ fontSize: '15px', fontWeight: '800', color: '#b45309', marginTop: '2px' }}>
                          {analytics.risk_distribution?.Medium || 0}
                        </div>
                      </div>
                      <div style={{ padding: '8px 4px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #dcfce7' }}>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: '#15803d' }}>Low</div>
                        <div style={{ fontSize: '15px', fontWeight: '800', color: '#15803d', marginTop: '2px' }}>
                          {analytics.risk_distribution?.Low || 0}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Horizontal Bar Chart (Course Engagement) */}
                  <div style={{ 
                    background: '#ffffff', 
                    padding: '24px', 
                    borderRadius: '14px', 
                    border: '1px solid #e2e8f0', 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>Curriculum Enrollment Volume</h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                          Student enrollment count across published courses
                        </p>
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
                              callbacks: {
                                label: (context) => ` ${context.raw} Enrolled Students`
                              }
                            }
                          },
                          scales: { 
                            x: { 
                              beginAtZero: true, 
                              grid: { color: '#f1f5f9' },
                              ticks: { precision: 0, stepSize: 1, font: { size: 11 } } 
                            },
                            y: {
                              grid: { display: false },
                              ticks: { 
                                font: { size: 12, weight: '500' },
                                color: '#334155',
                                callback: function(val) {
                                  const text = this.getLabelForValue(val);
                                  return text.length > 28 ? text.substring(0, 26) + '...' : text;
                                }
                              }
                            }
                          } 
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Cohort Insight & Quick Action Bar */}
                <div style={{ 
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', 
                  borderRadius: '12px', 
                  padding: '18px 24px', 
                  color: '#ffffff',
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.12)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <span style={{ fontSize: '24px' }}>🛡️</span>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '700' }}>Early Academic Intervention Recommendation</div>
                      <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>
                        {(analytics.risk_distribution?.High || 0)} students currently show high dropout risk signals based on assignment deadlines & engagement velocity.
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveTab('alerts')}
                    style={{ 
                      background: '#f43f5e', 
                      color: '#ffffff', 
                      border: 'none', 
                      padding: '8px 18px', 
                      borderRadius: '8px', 
                      fontWeight: '700', 
                      fontSize: '13px', 
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(244, 63, 94, 0.4)',
                      transition: 'all 0.2s ease',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    View High-Risk Alerts →
                  </button>
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

        <footer className="dash-footer">E-LEARNING MANAGEMENT SYSTEM — ADMIN DASHBOARD</footer>
      </div>
      <Toast message={toastMessage} />
    </div>
  );
};

export default AdminDashboard;
