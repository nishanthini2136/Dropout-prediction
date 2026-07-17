import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';
import Toast from '../components/Toast';

const CourseDetails = () => {
  const { id } = useParams();
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrollment, setEnrollment] = useState(null);
  const [activeModule, setActiveModule] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    fetchCourseDetails();
  }, [id]);

  const fetchCourseDetails = async () => {
    try {
      const response = await axios.get(`/api/courses/${id}`);
      setCourse(response.data.course);
      
      // Check if user is enrolled
      if (user?.role === 'student') {
        await checkEnrollment();
      }
    } catch (error) {
      setError('Error fetching course details');
      console.error('Error fetching course:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkEnrollment = async () => {
    try {
      const response = await axios.get('/api/enrollments/my-courses', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const enrolled = response.data.find(
        enrollment => enrollment.course_id._id === id
      );
      if (enrolled) {
        setIsEnrolled(true);
        setEnrollment(enrolled);
        const courseObj = enrolled.course_id || course;
        if (courseObj && courseObj.modules && courseObj.modules.length > 0) {
          setActiveModule(courseObj.modules[0]);
          const firstModuleLessons = courseObj.modules[0].lessons || courseObj.modules[0].resources || [];
          if (firstModuleLessons.length > 0) {
            setActiveLesson(firstModuleLessons[0]);
          }
        }
      }
    } catch (error) {
      console.error('Error checking enrollment:', error);
    }
  };

  const handleEnroll = async () => {
    if (!user) {
      navigate('/student/login');
      return;
    }

    setEnrolling(true);
    setError('');

    try {
      await axios.post('/api/enrollments', { course_id: id }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setIsEnrolled(true);
      setToastMessage('Enrolled successfully');
      await checkEnrollment();
    } catch (error) {
      setError(error.response?.data?.error || 'Error enrolling in course');
      setToastMessage('Error enrolling in course');
    } finally {
      setEnrolling(false);
    }
  };

  const handleLessonComplete = async (moduleId, lessonId) => {
    try {
      await axios.put(`/api/enrollments/${enrollment._id}/lesson-progress`, {
        module_id: moduleId,
        lesson_id: lessonId,
        completed: true
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setToastMessage('Lesson marked as complete');
      await checkEnrollment();
    } catch (error) {
      console.error('Error updating lesson progress:', error);
      setToastMessage('Error updating progress');
    }
  };

  const getEmbedUrl = (url) => {
    if (!url) return '';
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      let videoId = '';
      try {
        if (url.includes('youtube.com/watch')) {
          const urlParams = new URLSearchParams(new URL(url).search);
          videoId = urlParams.get('v');
        } else if (url.includes('youtu.be/')) {
          videoId = url.split('youtu.be/')[1]?.split('?')[0];
        } else if (url.includes('youtube.com/embed/')) {
          videoId = url.split('youtube.com/embed/')[1]?.split('?')[0];
        }
      } catch (e) {
        const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
        videoId = match ? match[1] : '';
      }
      return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    }
    return url;
  };

  const getInitials = (name) => {
    return name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'ST';
  };

  if (loading) {
    return (
      <div className="dashboard-screen">
        <div className="wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <div style={{ color: '#4B5563' }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="dashboard-screen">
        <div className="wrap">
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#4B5563' }}>
            Course not found
          </div>
        </div>
      </div>
    );
  }

  const modules = course.modules || [
    {
      id: 1,
      title: 'Introduction',
      lessons: [
        { id: 1, title: 'Course Overview', type: 'video', duration: '10 min', url: '#', completed: false },
        { id: 2, title: 'Getting Started', type: 'video', duration: '15 min', url: '#', completed: false }
      ]
    },
    {
      id: 2,
      title: 'Core Concepts',
      lessons: [
        { id: 3, title: 'Fundamentals', type: 'video', duration: '20 min', url: '#', completed: false },
        { id: 4, title: 'Advanced Topics', type: 'video', duration: '25 min', url: '#', completed: false },
        { id: 5, title: 'Study Notes', type: 'pdf', duration: 'PDF', url: '#', completed: false }
      ]
    }
  ];

  const studyMaterials = course.studyMaterials || [
    { id: 1, title: 'Course Syllabus', type: 'pdf', url: '#' },
    { id: 2, title: 'Reference Materials', type: 'pdf', url: '#' },
    { id: 3, title: 'Practice Exercises', type: 'pdf', url: '#' }
  ];

  return (
    <div className="dashboard-screen">
      <div className="dash-nav">
        <div className="wrap">
          <div className="brandmark">
            <div className="seal">E</div>
            <div className="name">E-Learning<em>System</em></div>
          </div>
          <div className="nav-right">
            <span className="role-pill student">Student</span>
            <div className="avatar">{getInitials(user?.name)}</div>
            <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate('/'); }}>Sign out</button>
          </div>
        </div>
      </div>

      <div className="wrap">
        <div className="dash-header">
          <div className="eyebrow">Course Details</div>
          <h1>{course.title}</h1>
          <p>{course.description}</p>
        </div>

        {error && (
          <div style={{ 
            padding: '16px 24px', 
            marginBottom: '24px', 
            backgroundColor: '#FEE2E2', 
            color: '#DC2626', 
            borderRadius: '8px',
            border: '1px solid #FECACA'
          }}>
            {error}
          </div>
        )}

        {/* Course Info Card */}
        <div style={{ 
          background: '#ffffff', 
          border: '1px solid #E5E7EB', 
          borderRadius: '16px', 
          padding: '32px',
          marginBottom: '32px',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)'
        }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: '250px' }}>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <span style={{ 
                  padding: '6px 14px', 
                  borderRadius: '20px', 
                  fontSize: '12px', 
                  fontWeight: '600',
                  backgroundColor: '#0F172A',
                  color: '#ffffff'
                }}>
                  {course.category}
                </span>
                <span style={{ 
                  padding: '6px 14px', 
                  borderRadius: '20px', 
                  fontSize: '12px', 
                  fontWeight: '600',
                  backgroundColor: course.difficulty === 'Beginner' ? '#10B981' : course.difficulty === 'Intermediate' ? '#F59E0B' : '#EF4444',
                  color: '#ffffff'
                }}>
                  {course.difficulty}
                </span>
                {course.is_active ? (
                  <span style={{ 
                    padding: '6px 14px', 
                    borderRadius: '20px', 
                    fontSize: '12px', 
                    fontWeight: '600',
                    backgroundColor: '#10B981',
                    color: '#ffffff'
                  }}>
                    Active
                  </span>
                ) : (
                  <span style={{ 
                    padding: '6px 14px', 
                    borderRadius: '20px', 
                    fontSize: '12px', 
                    fontWeight: '600',
                    backgroundColor: '#EF4444',
                    color: '#ffffff'
                  }}>
                    Inactive
                  </span>
                )}
              </div>
              
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '12px' }}>
                {course.instructor}
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#4B5563' }}>
                <div><strong>Duration:</strong> {course.duration}</div>
                <div><strong>Difficulty Level:</strong> {course.difficulty}</div>
                <div><strong>Category:</strong> {course.category}</div>
                {isEnrolled && enrollment && (
                  <div><strong>Progress:</strong> {enrollment.progress}% complete</div>
                )}
              </div>
            </div>
            
            <div style={{ minWidth: '250px', maxWidth: '300px' }}>
              {isEnrolled ? (
                <div style={{ 
                  padding: '24px', 
                  backgroundColor: '#ECFDF5', 
                  borderRadius: '12px',
                  border: '1px solid #10B981'
                }}>
                  <div style={{ color: '#047857', fontWeight: '600', marginBottom: '12px' }}>
                    ✓ You are enrolled in this course!
                  </div>
                  <button 
                    className="btn btn-gold btn-sm"
                    style={{ width: '100%' }}
                    onClick={() => navigate('/student/dashboard')}
                  >
                    Go to My Courses
                  </button>
                </div>
              ) : (
                <button
                  className="btn btn-gold"
                  style={{ width: '100%', padding: '16px 24px' }}
                  onClick={handleEnroll}
                  disabled={enrolling || !course.is_active}
                >
                  {enrolling ? 'Enrolling...' : 'Enroll Now'}
                </button>
              )}
              {!course.is_active && (
                <div style={{ 
                  marginTop: '12px', 
                  padding: '12px 16px', 
                  backgroundColor: '#FEF3C7', 
                  borderRadius: '8px',
                  color: '#92400E',
                  fontSize: '14px'
                }}>
                  This course is currently not available for enrollment.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Module-wise Lessons (Only for enrolled students) */}
        {isEnrolled && (
          <>
            <div className="section-head">
              <h2>Course Modules</h2>
            </div>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '350px 1fr', 
              gap: '24px',
              marginBottom: '32px'
            }}>
              {/* Module List */}
              <div style={{ 
                background: '#ffffff', 
                border: '1px solid #E5E7EB', 
                borderRadius: '16px',
                overflow: 'hidden'
              }}>
                <div style={{ padding: '24px', borderBottom: '1px solid #E5E7EB' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', margin: 0 }}>
                    Modules
                  </h3>
                </div>
                <div>
                  {modules.map((module, index) => (
                    <div
                      key={module.id}
                      onClick={() => setActiveModule(module)}
                      style={{
                        padding: '16px 24px',
                        borderBottom: index < modules.length - 1 ? '1px solid #E5E7EB' : 'none',
                        cursor: 'pointer',
                        backgroundColor: activeModule?.id === module.id ? '#F8FAFC' : '#ffffff',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (activeModule?.id !== module.id) {
                          e.target.style.backgroundColor = '#F8FAFC';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (activeModule?.id !== module.id) {
                          e.target.style.backgroundColor = '#ffffff';
                        }
                      }}
                    >
                      <div style={{ fontWeight: '500', color: '#111827', marginBottom: '4px' }}>
                        {module.title}
                      </div>
                      <div style={{ fontSize: '13px', color: '#6B7280' }}>
                        {(module.lessons || module.resources || []).length} lessons
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lesson Content */}
              <div style={{ 
                background: '#ffffff', 
                border: '1px solid #E5E7EB', 
                borderRadius: '16px',
                padding: '24px'
              }}>
                {activeModule ? (
                  <>
                    <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '24px' }}>
                      {activeModule.title}
                    </h3>
                    
                    {activeModule.lessons.map((lesson, index) => {
                      const isCompleted = enrollment?.modules
                        ?.find(m => m.id === activeModule.id)
                        ?.lessons?.find(l => l.id === lesson.id)?.completed;
                      
                      return (
                        <div
                          key={lesson.id}
                          style={{
                            padding: '20px',
                            marginBottom: index < activeModule.lessons.length - 1 ? '16px' : '0',
                            backgroundColor: '#F8FAFC',
                            borderRadius: '12px',
                            border: '1px solid #E5E7EB'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ 
                                width: '40px', 
                                height: '40px', 
                                borderRadius: '8px',
                                backgroundColor: lesson.type === 'video' ? '#0F172A' : '#D4AF37',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff',
                                fontSize: '18px'
                              }}>
                                {lesson.type === 'video' ? '▶' : '📄'}
                              </div>
                              <div>
                                <div style={{ fontWeight: '500', color: '#111827' }}>
                                  {lesson.title}
                                </div>
                                <div style={{ fontSize: '13px', color: '#6B7280' }}>
                                  {lesson.duration}
                                </div>
                              </div>
                              {isCompleted && (
                                <span style={{ 
                                  marginLeft: '8px', 
                                  padding: '2px 8px', 
                                  borderRadius: '12px',
                                  backgroundColor: '#10B981',
                                  color: '#ffffff',
                                  fontSize: '11px',
                                  fontWeight: '600'
                                }}>
                                  Completed
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => setActiveLesson(lesson)}
                            >
                              {lesson.type === 'video' ? 'Watch Video' : 'View PDF'}
                            </button>
                            {!isCompleted && (
                              <button
                                className="btn btn-gold btn-sm"
                                onClick={() => handleLessonComplete(activeModule.id, lesson.id)}
                              >
                                Mark Complete
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div style={{ textAlign: 'center', color: '#6B7280', padding: '40px' }}>
                    Select a module to view lessons
                  </div>
                )}
              </div>
            </div>

            {/* Study Materials */}
            <div className="section-head">
              <h2>Study Materials</h2>
            </div>
            
            <div style={{ 
              background: '#F8FAFC', 
              border: '1px solid #E5E7EB', 
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '32px'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
                {studyMaterials.map(material => (
                  <div
                    key={material.id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #E5E7EB',
                      borderRadius: '12px',
                      padding: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#0F172A';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#E5E7EB';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{ 
                      width: '40px', 
                      height: '40px', 
                      borderRadius: '8px',
                      backgroundColor: '#D4AF37',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontSize: '18px'
                    }}>
                      📄
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '500', color: '#111827', fontSize: '14px' }}>
                        {material.title}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>
                        PDF
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <footer className="dash-footer">E-LEARNING MANAGEMENT SYSTEM — STUDENT PORTAL</footer>
      </div>

      <Toast message={toastMessage} />
    </div>
  );
};

export default CourseDetails;
