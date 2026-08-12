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
  const fallbackImage = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600&auto=format&fit=crop';

  useEffect(() => {
    fetchCourses();
    fetchEnrolledCourses();
    fetchRecommendations();
    fetchDashboardStats();
  }, []);

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
      const data = Array.isArray(response.data) ? response.data : [];
      setEnrolledCourses(data);
      if (data.length > 0 && !selectedCourseId) {
        const cId = data[0].course_id._id;
        setSelectedCourseId(cId);
        fetchRoadmap(1, cId);
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
      fetchCourses();
      fetchEnrolledCourses();
      fetchRecommendations();
      fetchDashboardStats();
    } catch (error) {
      setToastMessage('Error enrolling course');
    }
  };

  const handleDrop = async (enrollmentId) => {
    if (window.confirm('Are you sure you want to drop this course?')) {
      try {
        await axios.delete(`/api/enrollments/${enrollmentId}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        setToastMessage('Course dropped successfully');
        fetchCourses();
        fetchEnrolledCourses();
        fetchRecommendations();
        fetchDashboardStats();
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
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        tension: 0.3
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    plugins: { legend: { position: 'top' }, title: { display: true, text: `Dropout Risk Forecast (${selectedCourseDoc?.title || 'Selected Course'})` } },
    scales: { y: { min: 0, max: 100 } }
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
              enrolledCourses.map(enrollment => (
                <div key={enrollment._id} className="course-card" onClick={() => navigate(`/course/${enrollment.course_id._id}`)} style={{ cursor: 'pointer', position: 'relative' }}>
                  
                  {/* Per-Course Risk Badge */}
                  {enrollment.risk_badge && (
                    <span style={{ 
                      position: 'absolute', 
                      top: '12px', 
                      right: '12px', 
                      zIndex: 2,
                      background: enrollment.risk_badge === 'High' ? '#fee2e2' : enrollment.risk_badge === 'Medium' ? '#fef3c7' : '#dcfce3', 
                      color: enrollment.risk_badge === 'High' ? '#ef4444' : enrollment.risk_badge === 'Medium' ? '#f59e0b' : '#10b981',
                      padding: '4px 10px', 
                      borderRadius: '12px', 
                      fontWeight: 'bold', 
                      fontSize: '11px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                      Risk: {enrollment.risk_badge} ({enrollment.risk_score?.toFixed(1)}%)
                    </span>
                  )}

                  <div className="badge-enrolled" style={{ marginTop: enrollment.risk_badge ? '28px' : '0' }}>Enrolled</div>
                  <div className="thumbnail-wrapper" style={{ height: '140px', width: '100%', borderRadius: '10px', overflow: 'hidden', marginBottom: '16px' }}>
                    <img src={enrollment.course_id.thumbnail || fallbackImage} alt={enrollment.course_id.title} style={{ height: '100%', width: '100%', objectFit: 'cover' }} onError={(e) => e.target.src = fallbackImage}/>
                  </div>
                  <div className="code">{enrollment.course_id.code} · {enrollment.course_id.category}</div>
                  <h3>{enrollment.course_id.title}</h3>
                  <div className="desc">{enrollment.course_id.description}</div>
                  <div className="progress-section" style={{ marginTop: '16px' }}>
                    <div className="progress-bar"><div className="progress-fill" style={{ width: `${enrollment.progress}%` }}/></div>
                    <div className="progress-text">{enrollment.progress}% complete</div>
                  </div>
                  <div className="actions" onClick={(e) => e.stopPropagation()} style={{ marginTop: '16px' }}>
                    <button className="btn btn-gold btn-sm" style={{ width: '100%' }} onClick={() => navigate(`/course/${enrollment.course_id._id}`)}>Continue Learning</button>
                  </div>
                </div>
              ))
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
            <h3 style={{ marginBottom: '15px', fontSize: '16px' }}>Risk Forecast</h3>
            {currentPrediction ? (
              <Line data={chartData} options={chartOptions} />
            ) : (
              <p style={{ color: '#6b7280', fontSize: '14px' }}>No forecast data available for selected course.</p>
            )}
          </div>

          {/* Roadmap Widget */}
          <div className="widget" style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <h3 style={{ marginBottom: '15px', fontSize: '16px' }}>Weekly Roadmap (Week 1)</h3>
            {roadmap && roadmap.tasks && roadmap.tasks.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {roadmap.tasks.map((task, idx) => (
                  <li key={idx} style={{ marginBottom: '10px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <input type="checkbox" checked={task.status === 'Completed'} readOnly />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>{task.task_desc}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>{task.day}</div>
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
