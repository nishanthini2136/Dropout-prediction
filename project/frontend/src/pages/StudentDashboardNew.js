import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CourseCard from '../components/CourseCard';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import './Dashboard.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [courses, setCourses] = useState([]);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [predictionsMap, setPredictionsMap] = useState({});
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [roadmap, setRoadmap] = useState(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const fallbackImage = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300"><rect width="100%" height="100%" fill="#1e293b"/><text x="50%" y="50%" fill="#94a3b8" font-family="sans-serif" font-size="20" text-anchor="middle" dy=".3em">Course Learning Material</text></svg>')}`;

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    await Promise.allSettled([
      fetchCourses(),
      fetchEnrolledCourses(),
      fetchRecommendations(),
      fetchDashboardStats()
    ]);
  };

  useEffect(() => {
    if (enrolledCourses.length > 0 && !selectedCourseId) {
      const firstCourseId = enrolledCourses[0].course_id._id;
      setSelectedCourseId(firstCourseId);
      fetchRoadmap(1, firstCourseId);
    }
  }, [enrolledCourses]);

  const fetchCourses = async () => {
    try {
      const response = await axios.get('/api/courses', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setCourses(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching courses:', error);
      setCourses([]);
    }
  };

  const fetchEnrolledCourses = async () => {
    try {
      const response = await axios.get('/api/enrollments/my-courses', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const data = Array.isArray(response.data) ? response.data : (response.data?.enrollments || []);
      setEnrolledCourses(data);
      if (data.length > 0 && !selectedCourseId) {
        const first = data[0];
        const cId = first.course_id?._id || first.course_id?.id || (typeof first.course_id === 'string' ? first.course_id : '') || first.course?._id;
        if (cId) {
          setSelectedCourseId(cId);
          fetchRoadmap(1, cId);
        }
      }
    } catch (error) {
      console.error('Error fetching enrolled courses:', error);
      setEnrolledCourses([]);
    }
  };

  const fetchRecommendations = async () => {
    try {
      const response = await axios.get('/api/student/recommendations', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setRecommendations(response.data.recommendations || []);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const response = await axios.get('/api/student/dashboard/stats', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setPredictionsMap(response.data.predictions || {});
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchRoadmap = async (week = 1, courseId = selectedCourseId) => {
    try {
      const url = courseId ? `/api/student/roadmap/${week}?course_id=${courseId}` : `/api/student/roadmap/${week}`;
      const response = await axios.get(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setRoadmap(response.data.roadmap);
    } catch (error) {
      console.error('Error fetching roadmap:', error);
    }
  };

  const handleEnroll = async (courseId) => {
    try {
      await axios.post('/api/enrollments', { course_id: courseId }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setToastMessage('Enrolled successfully');
      loadDashboardData();
    } catch (error) {
      setToastMessage('Error enrolling course');
    }
  };

  const handleDrop = async (enrollmentId) => {
    if (window.confirm('Are you sure you want to drop this course?')) {
      try {
        await axios.delete(`/api/enrollments/${enrollmentId}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        setToastMessage('Course dropped successfully');
        loadDashboardData();
      } catch (error) {
        setToastMessage('Error dropping course');
      }
    }
  };

  const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'ST';
  const getEnrollmentId = (courseId) => {
    const enrollment = enrolledCourses.find(e => e.course_id._id === courseId);
    return enrollment ? enrollment._id : null;
  };

  // Selected course prediction & forecast chart
  const currentPrediction = selectedCourseId ? (predictionsMap[selectedCourseId] || Object.values(predictionsMap)[0]) : Object.values(predictionsMap)[0];
  const selectedCourseDoc = enrolledCourses.find(e => e.course_id._id === selectedCourseId)?.course_id;

  const chartData = {
    labels: currentPrediction?.weekly_forecast?.map(f => `Week ${f.week}`) || ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    datasets: [
      {
        label: 'Risk Score (%)',
        data: currentPrediction?.weekly_forecast?.map(f => f.risk_pct) || [0, 0, 0, 0],
        borderColor: '#EF4444',
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#EF4444',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: {
        display: true,
        text: `Dropout Risk Forecast (${selectedCourseDoc?.title || 'Selected Course'})`,
        font: { size: 14, weight: '600' }
      },
      tooltip: {
        callbacks: {
          label: (context) => ` Risk Forecast: ${context.parsed.y}%`
        }
      }
    },
    scales: {
      y: {
        min: 0,
        max: 100,
        ticks: {
          callback: (value) => `${value}%`
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        }
      },
      x: {
        grid: {
          display: false
        }
      }
    }
  };

  return (
    <div className="dashboard-screen">
      <Navbar />

      <div className="wrap" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '30px', padding: '30px 20px' }}>
        
        {/* MAIN COLUMN */}
        <div className="main-col">
          <div className="dash-header" style={{ marginBottom: '30px' }}>
            <div className="eyebrow">Student Portal</div>
            <h1>Welcome back, {user?.name?.split(' ')[0]}.</h1>
            <p>Browse available courses, manage your enrollments, and track your per-course risk analytics.</p>
          </div>

          {/* Enrolled Courses */}
          <div className="section-head"><h2>My Enrolled Courses</h2></div>
          <div className="course-grid" style={{ marginBottom: '40px' }}>
            {enrolledCourses.length === 0 ? (
              <div className="empty-state" style={{ gridColumn: '1/-1' }}>You haven't enrolled in any courses yet.</div>
            ) : (
              enrolledCourses.map(enrollment => {
                const course = (typeof enrollment.course_id === 'object' && enrollment.course_id !== null)
                  ? enrollment.course_id
                  : (typeof enrollment.course === 'object' && enrollment.course !== null ? enrollment.course : {});
                const courseId = course._id || course.id || (typeof enrollment.course_id === 'string' ? enrollment.course_id : '') || enrollment._id;
                const thumbnailSrc = course.thumbnail 
                  ? (course.thumbnail.startsWith('http') ? course.thumbnail : `http://localhost:5000${course.thumbnail}`) 
                  : fallbackImage;
                const title = course.title || 'Enrolled Course';
                const code = course.code || 'COURSE';
                const category = course.category || 'General';
                const description = course.description || 'Access your coursework and resources.';
                const isDone = (enrollment.progress >= 100 || enrollment.is_completed);
                const riskBadge = isDone ? 'Low' : (enrollment.risk_badge || 'Low');
                const riskScore = isDone ? '0.0' : (enrollment.risk_score !== undefined ? Number(enrollment.risk_score).toFixed(1) : '0.0');

                return (
                  <div key={enrollment._id || courseId} className="course-card" onClick={() => courseId && navigate(`/course/${courseId}`)} style={{ cursor: 'pointer', position: 'relative' }}>
                    <div className="thumbnail-wrapper" style={{ height: '140px', width: '100%', borderRadius: '10px', overflow: 'hidden', marginBottom: '16px', position: 'relative' }}>
                      
                      {/* Status Badge (Left: Enrolled vs Completed) */}
                      <div 
                        className="badge-enrolled" 
                        style={{ 
                          top: '10px', 
                          left: '10px', 
                          right: 'auto',
                          background: isDone
                            ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' 
                            : undefined
                        }}
                      >
                        {isDone ? 'Completed 🎉' : 'Enrolled'}
                      </div>

                      {/* Risk Badge (Right) */}
                      <span style={{ 
                        position: 'absolute', 
                        top: '10px', 
                        right: '10px', 
                        zIndex: 10,
                        background: isDone
                          ? '#dcfce7'
                          : riskBadge === 'High' 
                            ? '#fee2e2' 
                            : riskBadge === 'Medium' 
                              ? '#fef3c7' 
                              : '#dcfce7', 
                        color: isDone
                          ? '#15803d'
                          : riskBadge === 'High' 
                            ? '#ef4444' 
                            : riskBadge === 'Medium' 
                              ? '#b45309' 
                              : '#047857',
                        padding: '4px 10px', 
                        borderRadius: '6px', 
                        fontWeight: 'bold', 
                        fontSize: '11px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                        border: '1px solid rgba(255, 255, 255, 0.4)'
                      }}>
                        {isDone
                          ? '0% Risk'
                          : `Risk: ${riskBadge} (${riskScore}%)`}
                      </span>

                      <img
                        src={thumbnailSrc}
                        alt={title}
                        style={{ height: '100%', width: '100%', objectFit: 'cover' }}
                        onError={(e) => e.target.src = fallbackImage}
                      />
                    </div>
                    <div className="code">{code} · {category}</div>
                    <h3>{title}</h3>
                    <div className="desc">{description}</div>
                    <div className="progress-section" style={{ marginTop: '16px' }}>
                      <div className="progress-bar"><div className="progress-fill" style={{ width: `${enrollment.progress || 0}%` }}/></div>
                      <div className="progress-text">{enrollment.progress || 0}% complete</div>
                    </div>
                    <div className="actions" onClick={(e) => e.stopPropagation()} style={{ marginTop: '16px' }}>
                      <button className="btn btn-gold btn-sm" style={{ width: '100%' }} onClick={() => courseId && navigate(`/course/${courseId}`)}>Continue Learning</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* KNN Recommendations */}
          {recommendations.length > 0 && (
            <>
              <div className="section-head"><h2>Recommended For You</h2></div>
              <div className="course-grid" style={{ marginBottom: '40px' }}>
                {recommendations.map(course => {
                  const capacity = course.capacity !== undefined ? course.capacity : 30;
                  const seatsLeft = course.seats_left !== undefined ? course.seats_left : Math.max(0, capacity - (course.enrolled_count || 0));
                  const isFull = seatsLeft <= 0;
                  return (
                    <CourseCard key={course._id} course={course} isEnrolled={false} onEnroll={() => handleEnroll(course._id)} onDrop={() => handleDrop(getEnrollmentId(course._id))} seatsLeft={seatsLeft} full={isFull} />
                  );
                })}
              </div>
            </>
          )}

        </div>

        {/* SIDEBAR */}
        <div className="sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Course Selector Dropdown */}
          {enrolledCourses.length > 0 && (
            <div className="widget" style={{ background: '#fff', padding: '16px 20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#4b5563', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Course Analytics Selector:</label>
              <select
                value={selectedCourseId}
                onChange={(e) => {
                  const newId = e.target.value;
                  setSelectedCourseId(newId);
                  fetchRoadmap(1, newId);
                }}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px', background: '#f9fafb', fontWeight: '500' }}
              >
                {enrolledCourses.map(e => (
                  <option key={e.course_id._id} value={e.course_id._id}>
                    {e.course_id.title} ({e.course_id.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Chart Widget */}
          <div className="widget" style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <h3 style={{ marginBottom: '5px', fontSize: '16px', color: '#0f172a', fontWeight: '700' }}>Risk Forecast</h3>
            {currentPrediction ? (
              <>
                <Line data={chartData} options={chartOptions} />
                <p style={{ fontSize: '11px', color: '#047857', marginTop: '8px', fontWeight: '600', lineHeight: '1.4' }}>
                  {enrolledCourses.find(e => e.course_id._id === selectedCourseId)?.progress >= 100 
                    ? '🎉 Course Completed — 0% Dropout Risk achieved!' 
                    : '📈 CatBoost 4-Week Forecast (evaluated on behavioral velocity & projected feature vectors)'}
                </p>
              </>
            ) : (
              <p style={{ color: '#6b7280', fontSize: '14px' }}>No forecast data available for selected course.</p>
            )}
          </div>

          {/* Roadmap Widget */}
          <div className="widget" style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a', fontWeight: '700' }}>Weekly Roadmap</h3>
              <span style={{ 
                fontSize: '11px', 
                fontWeight: '700', 
                padding: '3px 8px', 
                borderRadius: '12px',
                background: (enrolledCourses.find(e => e.course_id._id === selectedCourseId)?.progress >= 100 || enrolledCourses.find(e => e.course_id._id === selectedCourseId)?.is_completed) ? '#dcfce7' : '#e0e7ff',
                color: (enrolledCourses.find(e => e.course_id._id === selectedCourseId)?.progress >= 100 || enrolledCourses.find(e => e.course_id._id === selectedCourseId)?.is_completed) ? '#15803d' : '#4338ca'
              }}>
                {(enrolledCourses.find(e => e.course_id._id === selectedCourseId)?.progress >= 100 || enrolledCourses.find(e => e.course_id._id === selectedCourseId)?.is_completed) ? 'Completed 🎉' : 'Week 1'}
              </span>
            </div>
            {roadmap && roadmap.tasks && roadmap.tasks.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {roadmap.tasks.map((task, idx) => (
                  <li key={idx} style={{ marginBottom: '10px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <input type="checkbox" checked={task.status === 'Completed'} readOnly />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>{task.task_desc}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{task.day}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: '#6b7280', fontSize: '14px' }}>No roadmap generated yet for selected course.</p>
            )}
          </div>
        </div>

      </div>

      <footer className="dash-footer" style={{ textAlign: 'center', padding: '20px', color: '#9ca3af', marginTop: '40px' }}>
        E-LEARNING MANAGEMENT SYSTEM — STUDENT PORTAL
      </footer>
      <Toast message={toastMessage} />
    </div>
  );
};

export default StudentDashboard;
