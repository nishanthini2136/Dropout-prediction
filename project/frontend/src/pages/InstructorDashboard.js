import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import axios from 'axios';
import './Dashboard.css';

const InstructorDashboard = () => {
  const navigate = useNavigate();
  
  // Navigation tabs: 'courses', 'students', 'grading'
  const [activeTab, setActiveTab] = useState('courses');
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [students, setStudents] = useState([]);
  const [toastMessage, setToastMessage] = useState('');
  const [submittingReview, setSubmittingReview] = useState({});

  // Grading states
  const [assignments, setAssignments] = useState([]);
  const [selectedCourseForGrading, setSelectedCourseForGrading] = useState('');
  const [selectedAssignmentForSubmissions, setSelectedAssignmentForSubmissions] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [gradingData, setGradingData] = useState({}); // { [submissionId]: { grade, feedback } }

  useEffect(() => {
    fetchInstructorData();
  }, []);

  useEffect(() => {
    if (activeTab === 'grading' && courses.length > 0) {
      const cid = selectedCourseForGrading || courses[0]._id;
      setSelectedCourseForGrading(cid);
      fetchAssignmentsForCourse(cid);
    }
  }, [activeTab, courses]);

  const showToast = (msg) => {
    setToastMessage(msg);
  };

  const fetchInstructorData = async () => {
    try {
      // Fetch instructor authored courses
      const courseRes = await axios.get('/api/instructor/courses');
      const fetchedCourses = courseRes.data.courses || [];
      setCourses(fetchedCourses);

      if (fetchedCourses.length > 0) {
        const initialCid = fetchedCourses[0]._id;
        setSelectedCourseId(initialCid);
        fetchEnrolledStudents(initialCid);
        if (!selectedCourseForGrading) {
          setSelectedCourseForGrading(initialCid);
        }
      }
    } catch (err) {
      console.error('Failed to fetch instructor data:', err);
      showToast(err.response?.data?.error || 'Failed to load instructor dashboard');
    }
  };

  const fetchEnrolledStudents = async (courseId) => {
    if (!courseId) return;
    try {
      const res = await axios.get(`/api/instructor/students/${courseId}`);
      setStudents(res.data.students || []);
    } catch (err) {
      console.error('Failed to load students:', err);
      setStudents([]);
    }
  };

  const handleCourseChange = (e) => {
    const cid = e.target.value;
    setSelectedCourseId(cid);
    fetchEnrolledStudents(cid);
  };

  const handleSubmitForReview = async (courseId) => {
    setSubmittingReview((prev) => ({ ...prev, [courseId]: true }));
    try {
      const res = await axios.post(`/api/instructor/courses/${courseId}/submit`);
      showToast(res.data.message || 'Course submitted for admin review!');
      fetchInstructorData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to submit course for review');
    } finally {
      setSubmittingReview((prev) => ({ ...prev, [courseId]: false }));
    }
  };

  // -------------------------------------------------------------
  // Grading Handlers
  // -------------------------------------------------------------
  const fetchAssignmentsForCourse = async (courseId) => {
    try {
      setSelectedAssignmentForSubmissions(null);
      setSubmissions([]);
      const response = await axios.get(`/api/assignments/course/${courseId}`);
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
      const response = await axios.get(`/api/assignments/${assignment._id}/submissions`);
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
      showToast('Please enter a valid numeric grade between 0 and 100.');
      return;
    }
    try {
      await axios.post(`/api/assignments/submission/${submissionId}/grade`, {
        grade: parseFloat(current.grade),
        feedback: current.feedback || ''
      });
      showToast('Grade and feedback saved successfully!');
      setSubmissions(prev => prev.map(s => s._id === submissionId ? {
        ...s,
        status: 'Graded',
        grade: parseFloat(current.grade),
        feedback: current.feedback
      } : s));
    } catch (error) {
      console.error('Error grading submission:', error);
      showToast('Failed to submit grade.');
    }
  };

  // Status Badge Renderer matching system theme
  const renderStatusBadge = (course) => {
    const status = course.status || 'draft';
    const styles = {
      published: { bg: '#dcfce7', border: '#bbf7d0', color: '#15803d', text: 'Published' },
      pending_review: { bg: '#fef3c7', border: '#fde68a', color: '#d97706', text: 'Pending Admin Review' },
      rejected: { bg: '#fee2e2', border: '#fecdd3', color: '#b91c1c', text: 'Revision Requested' },
      draft: { bg: '#f1f5f9', border: '#e2e8f0', color: '#475569', text: 'Draft' }
    };
    const s = styles[status] || styles.draft;
    return (
      <span style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.color,
        fontSize: '11px',
        fontWeight: '700',
        padding: '4px 10px',
        borderRadius: '12px',
        textTransform: 'uppercase',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        letterSpacing: '0.04em'
      }}>
        {s.text}
      </span>
    );
  };

  const renderRiskBadge = (level) => {
    const lvl = (level || 'Low').toLowerCase();
    const colors = {
      high: { bg: '#fee2e2', border: '#fecdd3', text: '#b91c1c' },
      medium: { bg: '#fef3c7', border: '#fde68a', text: '#b45309' },
      low: { bg: '#dcfce7', border: '#bbf7d0', text: '#15803d' }
    };
    const c = colors[lvl] || colors.low;
    return (
      <span style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
        fontSize: '11px',
        fontWeight: '700',
        padding: '3px 8px',
        borderRadius: '10px',
        display: 'inline-block'
      }}>
        {level || 'Low'} Risk
      </span>
    );
  };

  const totalEnrollments = courses.reduce((acc, c) => acc + (c.enrollment_count || 0), 0);
  const totalCompleted = courses.reduce((acc, c) => acc + (c.completed_count || 0), 0);

  return (
    <div className="dashboard-screen">
      <Navbar />
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage('')} />}

      <div className="wrap">
        {/* Header matching Admin / Student Dashboard */}
        <div className="dash-header">
          <div className="eyebrow">Instructor Authoring Studio</div>
          <h1>Instructor Control Center</h1>
          <p>
            Manage curriculum drafts, monitor student retention metrics, and evaluate assignment submissions.
          </p>
        </div>

        {/* KPI Stat Row */}
        <div className="stat-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="stat-card">
            <div className="icon">📚</div>
            <div className="num">{courses.length}</div>
            <div className="lbl">Authored Courses</div>
          </div>

          <div className="stat-card">
            <div className="icon">👥</div>
            <div className="num">{totalEnrollments}</div>
            <div className="lbl">Total Enrollments</div>
          </div>

          <div className="stat-card">
            <div className="icon">🎓</div>
            <div className="num" style={{ color: '#10b981' }}>{totalCompleted}</div>
            <div className="lbl">Completed Learners</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '30px', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px', flexWrap: 'wrap' }}>
          {[
            { id: 'courses', label: `My Courses (${courses.length})` },
            { id: 'students', label: 'Enrolled Students & Risk' },
            { id: 'grading', label: 'Assignment Grading' }
          ].map((tab) => (
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
            </button>
          ))}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: MY COURSES                                             */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'courses' && (
          <div>
            <div className="section-head" style={{ marginBottom: '20px' }}>
              <div>
                <h2>My Authored Courses</h2>
                <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>
                  Create and manage curriculum modules, video lessons, and submit courses for admin review.
                </p>
              </div>
              <button
                className="btn btn-gold btn-sm"
                onClick={() => navigate('/instructor/course/create')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                + Create New Course
              </button>
            </div>

            {courses.length === 0 ? (
              <div style={{ background: '#ffffff', padding: '48px 24px', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '42px', marginBottom: '12px' }}>📚</div>
                <h3 style={{ color: '#0f172a', margin: '0 0 8px', fontWeight: '700' }}>No courses created yet</h3>
                <p style={{ color: '#64748b', maxWidth: '440px', margin: '0 auto 20px', fontSize: '14px' }}>
                  Create your first course with rich modules, video lessons, and interactive assessments.
                </p>
                <button
                  className="btn btn-gold btn-sm"
                  onClick={() => navigate('/instructor/course/create')}
                >
                  Create Course Now
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
                {courses.map((course) => (
                  <div
                    key={course._id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                    }}
                  >
                    {/* Card Top */}
                    <div style={{ padding: '20px', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#3b82f6', fontWeight: '600' }}>
                          🏷️ {course.category || 'General'}
                        </span>
                        {renderStatusBadge(course)}
                      </div>
                      <h4 style={{ color: '#0f172a', margin: '6px 0 0', fontSize: '18px', fontWeight: '700', lineHeight: 1.3 }}>
                        {course.title}
                      </h4>
                    </div>

                    {/* Card Body */}
                    <div style={{ padding: '20px', flex: 1 }}>
                      <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {course.description || 'No description provided.'}
                      </p>

                      {course.status === 'rejected' && course.rejection_reason && (
                        <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                          <div style={{ color: '#e11d48', fontSize: '12px', fontWeight: '700' }}>⚠️ Admin Feedback:</div>
                          <div style={{ color: '#9f1239', fontSize: '12px', marginTop: '4px' }}>{course.rejection_reason}</div>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                        <span>Modules: <b style={{ color: '#0f172a' }}>{course.modules?.length || 0}</b></span>
                        <span>Students: <b style={{ color: '#0f172a' }}>{course.enrollment_count || 0}</b></span>
                        <span>Level: <b style={{ color: '#0f172a' }}>{course.difficulty || 'Beginner'}</b></span>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => navigate(`/instructor/course/edit/${course._id}`)}
                        style={{ flex: 1, padding: '8px 10px', fontSize: '12px', border: '1px solid #cbd5e1' }}
                      >
                        ✏️ Edit Content
                      </button>

                      {(course.status === 'draft' || course.status === 'rejected') && (
                        <button
                          className="btn btn-gold btn-sm"
                          onClick={() => handleSubmitForReview(course._id)}
                          disabled={submittingReview[course._id]}
                          style={{ flex: 1.3, padding: '8px 10px', fontSize: '12px' }}
                        >
                          {submittingReview[course._id] ? 'Submitting...' : '🚀 Submit for Review'}
                        </button>
                      )}

                      {course.status === 'published' && (
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => {
                            setSelectedCourseId(course._id);
                            fetchEnrolledStudents(course._id);
                            setActiveTab('students');
                          }}
                          style={{ flex: 1.2, padding: '8px 10px', fontSize: '12px', background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe', fontWeight: '600' }}
                        >
                          👥 View Students
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: ENROLLED STUDENTS & RISK                               */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'students' && (
          <div>
            <div className="section-head" style={{ marginBottom: '20px' }}>
              <div>
                <h2>Enrolled Students Roster & AI Risk Intelligence</h2>
                <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>
                  Live progress tracking and AI dropout risk forecast for learners in your course.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Select Course:</span>
                <select
                  value={selectedCourseId}
                  onChange={handleCourseChange}
                  style={{ background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 14px', fontSize: '14px', outline: 'none', fontWeight: '500' }}
                >
                  {courses.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.title} ({c.enrollment_count || 0} students)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {students.length === 0 ? (
              <div style={{ background: '#ffffff', padding: '48px 24px', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0', color: '#64748b' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>👥</div>
                <div style={{ fontWeight: '600', color: '#0f172a', marginBottom: '4px' }}>No students currently enrolled</div>
                <div>Learners who enroll in this course will appear here with dynamic risk telemetry.</div>
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Enrolled On</th>
                    <th>Learning Progress</th>
                    <th>Completed Lessons</th>
                    <th>Predicted Dropout Risk</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((st) => (
                    <tr key={st.enrollment_id}>
                      <td>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>{st.name}</div>
                        <div style={{ color: '#64748b', fontSize: '12px' }}>{st.email}</div>
                      </td>
                      <td style={{ color: '#64748b', fontSize: '13px' }}>
                        {st.enrolled_at ? new Date(st.enrolled_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ flex: 1, background: '#e2e8f0', height: '8px', borderRadius: '4px', overflow: 'hidden', minWidth: '90px' }}>
                            <div style={{ width: `${st.progress}%`, background: st.progress === 100 ? '#10b981' : '#3b82f6', height: '100%', borderRadius: '4px' }} />
                          </div>
                          <span style={{ color: '#0f172a', fontWeight: '700', fontSize: '12px' }}>{st.progress}%</span>
                        </div>
                      </td>
                      <td style={{ color: '#334155', fontWeight: '500' }}>
                        {st.completed_lessons} lessons
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {renderRiskBadge(st.risk_level)}
                          <span style={{ color: '#64748b', fontSize: '11px', fontWeight: '600' }}>
                            ({Math.round((st.risk_probability || 0) * 100)}%)
                          </span>
                        </div>
                      </td>
                      <td>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          background: st.progress === 100 ? '#dcfce7' : '#e0f2fe',
                          color: st.progress === 100 ? '#15803d' : '#0369a1'
                        }}>
                          {st.progress === 100 ? 'Completed' : 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: ASSIGNMENT GRADING                                     */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'grading' && (
          <div>
            <div className="section-head" style={{ marginBottom: '20px' }}>
              <div>
                <h2>Assignment Grading & Submissions</h2>
                <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>
                  Select a course to evaluate student assignment submissions, assign grades, and provide feedback.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Course:</span>
                <select 
                  value={selectedCourseForGrading} 
                  onChange={(e) => {
                    setSelectedCourseForGrading(e.target.value);
                    if (e.target.value) fetchAssignmentsForCourse(e.target.value);
                  }}
                  style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', minWidth: '280px', fontSize: '14px', outline: 'none', fontWeight: '500', background: '#ffffff' }}
                >
                  {courses.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                </select>
              </div>
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
                        <tr key={assign._id} style={{ background: selectedAssignmentForSubmissions?._id === assign._id ? '#f8fafc' : 'transparent' }}>
                          <td style={{ fontWeight: '600', color: '#0f172a' }}>{assign.title}</td>
                          <td style={{ color: '#64748b' }}>{assign.due_date ? new Date(assign.due_date).toLocaleDateString() : 'No due date'}</td>
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
                  <div style={{ background: '#fff', padding: '32px', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#64748b', textAlign: 'center', marginBottom: '24px' }}>
                    No assignments found for this course. Add assignments in the course creator.
                  </div>
                )}

                {/* Submissions Section */}
                {selectedAssignmentForSubmissions && (
                  <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.04)', marginTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '700' }}>
                          Submissions for "{selectedAssignmentForSubmissions.title}"
                        </h3>
                        <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '13px' }}>
                          {selectedAssignmentForSubmissions.description || 'Review student answers below and record grades.'}
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
                      <p style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>Loading submissions...</p>
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
                      <p style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>No submissions received for this assignment yet.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <footer className="dash-footer">E-LEARNING MANAGEMENT SYSTEM — INSTRUCTOR STUDIO</footer>
      </div>
    </div>
  );
};

export default InstructorDashboard;
