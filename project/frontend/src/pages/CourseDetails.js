import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';

const CourseDetails = () => {
  const { id } = useParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrollment, setEnrollment] = useState(null);
  const [activeModule, setActiveModule] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);
  // Helper to check if a lesson is completed based on enrollment data
  const isLessonCompleted = (moduleId, lessonId) => {
    const key = `${moduleId}:${lessonId}`;
    return (enrollment?.completed_lessons || []).includes(key);
  };
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [pdfModal, setPdfModal] = useState({ open: false, url: '', title: '' });
  const [toastMessage, setToastMessage] = useState('');
  const [player, setPlayer] = useState(null);

  const [videoEnded, setVideoEnded] = useState(false);
  const [quizData, setQuizData] = useState(null);
  const [quizError, setQuizError] = useState('');


  const [userAnswers, setUserAnswers] = useState({});
  const [quizResults, setQuizResults] = useState({});
  const [completedModuleIds, setCompletedModuleIds] = useState([]);
  const [videoWatchedModuleIds, setVideoWatchedModuleIds] = useState([]);
  const [unlockedModuleIds, setUnlockedModuleIds] = useState([]);
  const [autoNavCountdown, setAutoNavCountdown] = useState(0);
  const [isAutoNavigating, setIsAutoNavigating] = useState(false);



  useEffect(() => {
    fetchCourseDetails();
  }, [id]);

  // Load YouTube IFrame API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // Initialize player when video modal opens
  useEffect(() => {
    let playerInstance = null;

    const createPlayer = (videoId) => {
      try {
        playerInstance = new window.YT.Player('youtube-player', {
          videoId: videoId,
          playerVars: {
            autoplay: 1,
            modestbranding: 1,
            rel: 0
          },
          events: {
            'onReady': (event) => {
              console.log('YouTube player ready');
              setPlayer(event.target);
            },
            'onStateChange': (event) => {
              if (event.data === window.YT.PlayerState.ENDED) {
                console.log('Video ended, marking as complete');
                handleVideoComplete();
              }
            }
          }
        });
      } catch (err) {
        console.error('Error creating YouTube player:', err);
      }
    };

    if (showVideoPlayer && activeLesson?.type === 'video') {
      const videoId = getYouTubeVideoId(activeLesson.url);
      console.log('Initializing YouTube player with video ID:', videoId);
      if (videoId) {
        // Check if YT API is fully ready
        if (window.YT && window.YT.Player) {
          createPlayer(videoId);
        } else {
          // Wait for the API to load
          window.onYouTubeIframeAPIReady = () => {
            createPlayer(videoId);
          };
        }
      }
    }

    return () => {
      if (playerInstance) {
        try {
          playerInstance.destroy();
        } catch (e) {
          console.log('Player already destroyed');
        }
        setPlayer(null);
      }
    };
  }, [showVideoPlayer, activeLesson]);

  const fetchCourseDetails = async () => {
    try {
      const response = await axios.get(`/api/courses/${id}`);
      const courseData = response.data.course || response.data;
      setCourse(courseData);

      const mods = courseData?.modules || [];
      if (mods.length > 0 && !activeModule) {
        setActiveModule(mods[0]);
        const firstLessons = mods[0].lessons || mods[0].resources || [];
        if (firstLessons.length > 0) {
          setActiveLesson(firstLessons[0]);
        }
      }

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

  const fetchStudentProgress = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/student/progress?course_id=${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.data) {
        const quizDone = [];
        const videoDone = [];
        Object.keys(res.data).forEach(modId => {
          if (res.data[modId].quiz_completed) {
            quizDone.push(String(modId));
          }
          if (res.data[modId].video_watched) {
            videoDone.push(String(modId));
          }
        });
        setCompletedModuleIds(quizDone);
        setVideoWatchedModuleIds(videoDone);
      }
    } catch (e) {
      console.log('Error fetching student progress:', e);
    }
  };

  const getModuleIdVariants = (moduleObj) => {
    if (!moduleObj) return [];
    const ids = [];
    if (moduleObj._id !== undefined && moduleObj._id !== null) ids.push(String(moduleObj._id));
    if (moduleObj.id !== undefined && moduleObj.id !== null) ids.push(String(moduleObj.id));
    return Array.from(new Set(ids));
  };

  const isModuleCompleted = (moduleObj) => {
    if (!moduleObj) return false;
    const variants = getModuleIdVariants(moduleObj);
    // A module is "Done" if its quiz is completed OR its video has been watched
    return variants.some(id => completedModuleIds.includes(id) || videoWatchedModuleIds.includes(id));
  };

  const isModuleUnlocked = (moduleObj, index) => {
    if (!isEnrolled) return true; // Allow non-enrolled students to preview all modules
    if (index === 0) return true;
    if (isModuleCompleted(moduleObj)) return true;

    const allMods = course?.modules || modules || [];
    const prevModule = allMods[index - 1];
    if (!prevModule) return true;

    const prevCompleted = isModuleCompleted(prevModule);
    const variants = getModuleIdVariants(moduleObj);
    const inUnlockedState = variants.some(id => unlockedModuleIds.includes(id));

    return prevCompleted || inUnlockedState;
  };

  const checkEnrollment = async () => {
    try {
      const response = await axios.get('/api/enrollments/my-courses', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const enrollList = Array.isArray(response.data.enrollments) ? response.data.enrollments : (Array.isArray(response.data) ? response.data : []);
      const enrolled = enrollList.find(
        item => {
          const c = item.course_id || item.course;
          const cId = typeof c === 'object' ? (c._id || c.id) : c;
          return String(cId) === String(id);
        }
      );
      if (enrolled) {
        setIsEnrolled(true);
        setEnrollment(enrolled.enrollment || enrolled);
        await fetchStudentProgress();
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
      setToastMessage('🎉 Enrolled successfully! You can now access full video lectures, complete quizzes, and track progress.');
      await checkEnrollment();
    } catch (error) {
      setError(error.response?.data?.error || 'Error enrolling in course');
      setToastMessage(error.response?.data?.error || 'Error enrolling in course');
    } finally {
      setEnrolling(false);
    }
  };

  const handleLessonComplete = async (moduleId, lessonId) => {
    try {
      await axios.put(`http://localhost:5000/api/enrollments/${enrollment._id}/lesson-progress`, {
        module_id: moduleId,
        lesson_id: lessonId,
        completed: true
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setToastMessage('Lesson marked as complete');
      // Backend already recalculates progress, just refresh enrollment data
      await checkEnrollment();
    } catch (error) {
      console.error('Error updating lesson progress:', error);
      setToastMessage('Error updating progress');
    }
  };

  const getYouTubeVideoId = (url) => {
    if (!url) return '';
    try {
      if (url.includes('youtube.com/watch')) {
        const urlParams = new URLSearchParams(new URL(url).search);
        return urlParams.get('v');
      } else if (url.includes('youtu.be/')) {
        return url.split('youtu.be/')[1]?.split('?')[0];
      } else if (url.includes('youtube.com/embed/')) {
        return url.split('youtube.com/embed/')[1]?.split('?')[0];
      }
      const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
      return match ? match[1] : '';
    } catch (e) {
      return '';
    }
  };

  // Fetch quiz for a module after video completion
  const fetchQuiz = async (moduleId) => {
    try {
      const response = await axios.get(`http://localhost:5000/api/student/module/${moduleId}/quiz?course_id=${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      console.log('Quiz fetched:', response.data);
      setQuizData(response.data);
      setQuizError('');
    } catch (error) {
      console.error('Error fetching quiz:', error);
      if (error.response && error.response.status === 403) {
        setQuizError('Quiz is locked until the video is completed');
      } else if (error.response && error.response.status === 404) {
        setQuizError('No quiz available for this module');
      } else {
        setQuizError('Failed to load quiz');
      }
    }
  };

  const handleVideoComplete = async () => {
    if (activeLesson && activeModule) {
      console.log('handleVideoComplete called for lesson:', activeLesson.id, 'in module:', activeModule.id);
      setVideoEnded(true);

      // 1. Mark lesson progress in enrollment
      await handleLessonComplete(activeModule.id, activeLesson.id);

      // 2. Mark video as watched in ProgressModel so quiz is unlocked
      try {
        await axios.post(
          `http://localhost:5000/api/student/module/${activeModule._id || activeModule.id}/watch`,
          { course_id: id },
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        );
        console.log('Video marked as watched in ProgressModel');

        // 3. Immediately update sidebar badge: mark this module's id variants as video-watched
        const watchedVariants = getModuleIdVariants(activeModule);
        const updatedVideoWatched = Array.from(new Set([...videoWatchedModuleIds, ...watchedVariants]));
        setVideoWatchedModuleIds(updatedVideoWatched);

        // 4. Recalculate enrollment progress percentage using backend
        if (enrollment?._id) {
          try {
            await axios.put(`http://localhost:5000/api/enrollments/${enrollment._id}/module-progress`, {}, {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            // Refresh enrollment to get updated progress
            await checkEnrollment();
          } catch (e) {
            console.error('Error updating enrollment progress:', e);
          }
        }
      } catch (err) {
        console.error('Error marking video as watched:', err);
      }

      // 5. Close the video modal and fetch the quiz
      setShowVideoPlayer(false);
      setToastMessage('🎉 Video completed! Quiz is now unlocked below.');
      await fetchQuiz(activeModule._id || activeModule.id);

      // 6. Scroll to quiz section smoothly
      setTimeout(() => {
        const quizSection = document.getElementById('quiz-section');
        if (quizSection) quizSection.scrollIntoView({ behavior: 'smooth' });
      }, 400);
    }
  };

  const handleOptionChange = (quizId, qIdx, optionIdx) => {
    setUserAnswers(prev => ({
      ...prev,
      [`${quizId}_q${qIdx}`]: optionIdx
    }));
  };

  const getCorrectAnswerIndex = (question) => {
    if (question.correctAnswer !== undefined && question.correctAnswer !== null) {
      const val = parseInt(question.correctAnswer, 10);
      if (!isNaN(val)) return val;
    }
    if (question.answer !== undefined && question.answer !== null) {
      if (typeof question.answer === 'number') return question.answer;
      if (typeof question.answer === 'string') {
        const parsed = parseInt(question.answer, 10);
        if (!isNaN(parsed) && parsed.toString() === question.answer.trim()) {
          return parsed;
        }
        if (question.options) {
          const idx = question.options.findIndex(opt => opt.trim().toLowerCase() === question.answer.trim().toLowerCase());
          if (idx !== -1) return idx;
        }
      }
    }
    if (question.correct_answer !== undefined && question.correct_answer !== null) {
      if (typeof question.correct_answer === 'number') return question.correct_answer;
      if (question.options) {
        const idx = question.options.findIndex(opt => opt.trim().toLowerCase() === String(question.correct_answer).trim().toLowerCase());
        if (idx !== -1) return idx;
      }
    }
    return 0;
  };

  const navigateToNextModule = () => {
    setIsAutoNavigating(false);
    const allMods = course?.modules || modules;
    if (!activeModule || !allMods || allMods.length === 0) return;
    const curIdx = allMods.findIndex(m => String(m._id || m.id) === String(activeModule._id || activeModule.id));
    if (curIdx !== -1 && curIdx < allMods.length - 1) {
      const nextMod = allMods[curIdx + 1];
      const nextId = String(nextMod._id || nextMod.id);
      setUnlockedModuleIds(prev => Array.from(new Set([...prev, nextId])));
      setActiveModule(nextMod);
      const nextLessons = nextMod.lessons || nextMod.resources || [];
      if (nextLessons.length > 0) setActiveLesson(nextLessons[0]);
      setQuizData(null);
      setQuizError('');
      setToastMessage(`🚀 Unlocked & navigated to Module ${curIdx + 2}: ${nextMod.title}`);
      setTimeout(() => {
        window.scrollTo({ top: 350, behavior: 'smooth' });
      }, 200);
    }
  };

  const handleQuizSubmit = async (quiz) => {
    const quizId = String(quiz._id || quiz.id || 'default_quiz');
    const questions = quiz.questions || [];

    const unanswered = questions.filter((_, idx) => userAnswers[`${quizId}_q${idx}`] === undefined);
    if (unanswered.length > 0) {
      setToastMessage(`⚠️ Please answer all questions before submitting (${unanswered.length} remaining).`);
      return;
    }

    let correctCount = 0;
    const questionDetails = questions.map((q, idx) => {
      const selectedIdx = userAnswers[`${quizId}_q${idx}`];
      const correctIdx = getCorrectAnswerIndex(q);
      const isCorrect = selectedIdx === correctIdx;
      if (isCorrect) correctCount++;
      return {
        question: q.question,
        options: q.options || [],
        selectedIdx,
        correctIdx,
        isCorrect
      };
    });

    const total = questions.length;
    const percentage = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const passed = percentage >= 50;

    const resultObj = {
      score: correctCount,
      total,
      percentage,
      passed,
      details: questionDetails
    };

    setQuizResults(prev => ({ ...prev, [quizId]: resultObj }));

    const currentModId = String(activeModule?._id || activeModule?.id || '');
    if (currentModId) {
      try {
        await axios.post(
          `http://localhost:5000/api/student/module/${currentModId}/quiz/submit`,
          { score: correctCount, total, answers: userAnswers },
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        );
      } catch (err) {
        console.error('Error saving quiz submit:', err);
      }

      const activeVariants = getModuleIdVariants(activeModule);
      setCompletedModuleIds(prev => Array.from(new Set([...prev, ...activeVariants, currentModId])));

      // Update enrollment overall progress percentage using backend
      if (enrollment?._id) {
        try {
          await axios.put(
            `http://localhost:5000/api/enrollments/${enrollment._id}/module-progress`,
            {},
            { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
          );
          // Refresh enrollment to get updated progress
          await checkEnrollment();
        } catch (e) {
          console.error('Error updating enrollment progress:', e);
        }
      }
    }

    setToastMessage(`🎉 Quiz submitted! Score: ${correctCount}/${total} (${percentage}%)`);

    // Auto-unlock next module if available
    const allMods = course?.modules || modules;
    if (allMods && activeModule) {
      const curIdx = allMods.findIndex(m => getModuleIdVariants(m).includes(currentModId));
      if (curIdx !== -1 && curIdx < allMods.length - 1) {
        const nextMod = allMods[curIdx + 1];
        const nextVariants = getModuleIdVariants(nextMod);
        setUnlockedModuleIds(prev => Array.from(new Set([...prev, ...nextVariants])));
        setAutoNavCountdown(5);
        setIsAutoNavigating(true);
      }
    }
  };

  const handleRetakeQuiz = (quizId) => {
    setIsAutoNavigating(false);
    setQuizResults(prev => {
      const copy = { ...prev };
      delete copy[quizId];
      return copy;
    });
  };

  useEffect(() => {
    let timer = null;
    if (isAutoNavigating && autoNavCountdown > 0) {
      timer = setTimeout(() => {
        setAutoNavCountdown(prev => prev - 1);
      }, 1000);
    } else if (isAutoNavigating && autoNavCountdown === 0) {
      setIsAutoNavigating(false);
      navigateToNextModule();
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isAutoNavigating, autoNavCountdown]);



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

  const modules = course?.modules || [
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

  const getResourceUrl = (urlPath) => {
    if (!urlPath || urlPath === '#') return null;
    if (urlPath.startsWith('http://') || urlPath.startsWith('https://')) return urlPath;
    return `http://localhost:5000${urlPath}`;
  };

  const rawMaterials = course?.studyMaterials && course.studyMaterials.length > 0
    ? course.studyMaterials
    : [
        { id: 'syllabus', title: 'Course Syllabus PDF', type: 'pdf', url: course?.syllabus_pdf || '/static/uploads/sample_syllabus.pdf' },
        { id: 'reference', title: 'Reference Materials PDF', type: 'pdf', url: course?.reference_materials_pdf || '/static/uploads/sample_reference.pdf' },
        { id: 'exercises', title: 'Practice Exercises PDF', type: 'pdf', url: course?.practice_exercises_pdf || '/static/uploads/sample_exercises.pdf' }
      ];

  const studyMaterials = rawMaterials.map((item, idx) => {
    const rawUrl = item.url || (item.id === 'syllabus' ? course?.syllabus_pdf : item.id === 'reference' ? course?.reference_materials_pdf : course?.practice_exercises_pdf);
    return {
      ...item,
      id: item.id || idx,
      url: rawUrl,
      fullUrl: getResourceUrl(rawUrl)
    };
  });

  return (
    <div className="dashboard-screen">
      <Navbar />

      <div className="wrap">
        <div className="dash-header" style={{ marginTop: '20px' }}>
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
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {course.thumbnail && (
              <div style={{ width: '240px', height: '140px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <img
                  src={course.thumbnail.startsWith('http') ? course.thumbnail : `http://localhost:5000${course.thumbnail}`}
                  alt={course.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            )}
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

        {/* Module-wise Lessons & Syllabus Preview */}
        {course && (
          <>
            <div className="section-head">
              <h2>Course Curriculum & Modules</h2>
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
                    Modules ({modules.length})
                  </h3>
                </div>
                <div>
                  {modules.map((module, index) => {
                    const isUnlocked = isModuleUnlocked(module, index);
                    const isCompleted = isModuleCompleted(module);

                    return (
                      <div
                        key={module.id || module._id || index}
                        onClick={() => {
                          if (isUnlocked || !isEnrolled) {
                            setActiveModule(module);
                            const modLessons = module.lessons || module.resources || [];
                            if (modLessons.length > 0) setActiveLesson(modLessons[0]);
                            setQuizData(null);
                            setQuizError('');
                            setIsAutoNavigating(false);
                          } else {
                            setToastMessage('🔒 Complete the previous module quiz to unlock this module!');
                          }
                        }}
                        style={{
                          padding: '16px 24px',
                          borderBottom: index < modules.length - 1 ? '1px solid #E5E7EB' : 'none',
                          cursor: 'pointer',
                          backgroundColor: (activeModule?.id === module.id || activeModule?._id === module._id || activeModule?.title === module.title) ? '#F8FAFC' : '#ffffff',
                          opacity: (isUnlocked || !isEnrolled) ? 1 : 0.65,
                          transition: 'background-color 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <div style={{ fontWeight: '600', color: '#111827', fontSize: '15px' }}>
                            {module.title}
                          </div>
                          {!isEnrolled ? (
                            <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#F3F4F6', color: '#4B5563' }}>
                              Preview
                            </span>
                          ) : isCompleted ? (
                            <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#D1FAE5', color: '#047857' }}>
                              ✓ Done
                            </span>
                          ) : isUnlocked ? (
                            <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#DBEAFE', color: '#1E40AF' }}>
                              Unlocked
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#F3F4F6', color: '#6B7280' }}>
                              🔒 Locked
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '13px', color: '#6B7280' }}>
                          {(module.lessons || module.resources || []).length} lessons
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>

              {/* Lesson Content / Preview */}
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

                    {(activeModule.lessons || activeModule.resources || []).map((lesson, index) => {
                      const isCompleted = isLessonCompleted(activeModule.id, lesson.id);

                      return (
                        <div
                          key={lesson.id || index}
                          style={{
                            padding: '20px',
                            marginBottom: index < (activeModule.lessons || activeModule.resources || []).length - 1 ? '16px' : '0',
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
                              className="btn btn-gold btn-sm"
                              onClick={() => {
                                if (!isEnrolled) {
                                  setToastMessage('Please click "Enroll Now" to access video lectures and coursework!');
                                  return;
                                }
                                setActiveLesson(lesson);
                                setShowVideoPlayer(true);
                              }}
                            >
                              {lesson.type === 'video' ? 'Watch Video' : 'View PDF'}
                            </button>
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

            {/* Non-Enrolled Student Enrollment Call-to-Action Banner */}
            {!isEnrolled && (
              <div style={{
                background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
                border: '1.5px solid #D4AF37',
                borderRadius: '16px',
                padding: '28px 36px',
                marginTop: '32px',
                marginBottom: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '20px',
                color: '#ffffff',
                boxShadow: '0 8px 24px rgba(15,23,42,0.2)'
              }}>
                <div style={{ flex: '1', minWidth: '280px' }}>
                  <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: '#D4AF37', fontWeight: '700', marginBottom: '6px' }}>
                    Ready to start learning?
                  </div>
                  <h3 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#ffffff' }}>
                    Enroll in {course?.title || 'this course'}
                  </h3>
                  <p style={{ margin: '6px 0 0 0', fontSize: '14px', color: '#94A3B8', lineHeight: '1.5' }}>
                    Gain full access to video lectures, downloadable resources, interactive quizzes, assignments, and progress tracking.
                  </p>
                </div>
                <button
                  className="btn btn-gold"
                  onClick={handleEnroll}
                  disabled={enrolling || !course?.is_active}
                  style={{ padding: '14px 32px', fontSize: '16px', fontWeight: '600', borderRadius: '8px' }}
                >
                  {enrolling ? 'Enrolling...' : 'Enroll Now'}
                </button>
              </div>
            )}

            {/* Quiz Section — unlocked after video completion for enrolled students */}
            {isEnrolled && (
              <div id="quiz-section">
              {quizData && quizData.length > 0 && (
                <>
                  <div className="section-head">
                    <h2>📝 Module Quiz</h2>
                  </div>
                  {quizData.map((quiz, qIdx) => {
                    const quizId = String(quiz._id || quiz.id || qIdx);
                    const result = quizResults[quizId];
                    const allMods = course?.modules || modules;
                    const curIdx = allMods.findIndex(m => String(m._id || m.id) === String(activeModule?._id || activeModule?.id));
                    const hasNextModule = curIdx !== -1 && curIdx < allMods.length - 1;
                    const nextModule = hasNextModule ? allMods[curIdx + 1] : null;

                    return (
                      <div key={quizId} style={{
                        background: '#ffffff',
                        border: result ? (result.passed ? '2px solid #10B981' : '2px solid #F59E0B') : '2px solid #3B82F6',
                        borderRadius: '16px',
                        padding: '32px',
                        marginBottom: '32px',
                        boxShadow: '0 4px 16px rgba(15,23,42,0.06)'
                      }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                          <span style={{ fontSize: '24px' }}>{result ? (result.passed ? '🏆' : '📝') : '📝'}</span>
                          <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', margin: 0 }}>{quiz.title}</h3>
                          <span style={{ 
                            marginLeft: 'auto', 
                            padding: '4px 14px', 
                            borderRadius: '20px', 
                            backgroundColor: result ? (result.passed ? '#D1FAE5' : '#FEF3C7') : '#DBEAFE', 
                            color: result ? (result.passed ? '#047857' : '#92400E') : '#1E40AF', 
                            fontSize: '13px', 
                            fontWeight: '600' 
                          }}>
                            {result ? `Submitted - Score: ${result.score}/${result.total} (${result.percentage}%)` : 'Quiz Unlocked'}
                          </span>
                        </div>

                        {quiz.description && <p style={{ color: '#4B5563', marginBottom: '24px' }}>{quiz.description}</p>}

                        {/* Overall Results Summary Banner (If Submitted) */}
                        {result && (
                          <div style={{
                            backgroundColor: result.passed ? '#ECFDF5' : '#FEF3C7',
                            border: result.passed ? '1px solid #A7F3D0' : '1px solid #FDE68A',
                            borderRadius: '12px',
                            padding: '20px',
                            marginBottom: '28px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                              <div>
                                <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: result.passed ? '#065F46' : '#92400E' }}>
                                  {result.passed ? '🎉 Quiz Completed & Passed!' : '📝 Quiz Completed'}
                                </h4>
                                <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: result.passed ? '#047857' : '#B45309' }}>
                                  You scored <strong>{result.score}</strong> out of <strong>{result.total}</strong> ({result.percentage}%). Correct and incorrect answers are detailed below.
                                </p>
                              </div>
                              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                {hasNextModule && (
                                  <button
                                    className="btn btn-gold"
                                    onClick={navigateToNextModule}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: '600' }}
                                  >
                                    <span>Continue to Next Module ({nextModule?.title})</span>
                                    <span>→</span>
                                  </button>
                                )}
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => handleRetakeQuiz(quizId)}
                                  style={{ padding: '10px 16px' }}
                                >
                                  🔄 Retake Quiz
                                </button>
                              </div>
                            </div>

                            {/* Auto Navigation Countdown Bar */}
                            {isAutoNavigating && hasNextModule && (
                              <div style={{
                                marginTop: '16px',
                                padding: '12px 16px',
                                backgroundColor: '#ffffff',
                                borderRadius: '8px',
                                border: '1px dashed #10B981',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                              }}>
                                <span style={{ fontSize: '14px', fontWeight: '600', color: '#047857', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  🔓 Next Module Unlocked! Automatically navigating to "{nextModule?.title}" in {autoNavCountdown}s...
                                </span>
                                <button
                                  className="btn btn-sm btn-gold"
                                  onClick={navigateToNextModule}
                                  style={{ fontSize: '12px', padding: '6px 14px' }}
                                >
                                  Go to Next Module Now →
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Question Breakdown */}
                        {quiz.questions && quiz.questions.map((q, idx) => {
                          const selectedOptIdx = userAnswers[`${quizId}_q${idx}`];
                          const correctOptIdx = getCorrectAnswerIndex(q);
                          const isQuestionSubmitted = !!result;
                          const isCorrect = isQuestionSubmitted && (selectedOptIdx === correctOptIdx);

                          return (
                            <div key={idx} style={{
                              marginBottom: '24px',
                              padding: '20px',
                              background: isQuestionSubmitted
                                ? (isCorrect ? '#F0FDF4' : '#FEF2F2')
                                : '#F8FAFC',
                              borderRadius: '12px',
                              border: isQuestionSubmitted
                                ? (isCorrect ? '1px solid #BBF7D0' : '1px solid #FECACA')
                                : '1px solid #E5E7EB'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                <div style={{ fontWeight: '600', color: '#111827', fontSize: '15px' }}>
                                  Q{idx + 1}: {q.question}
                                </div>
                                {isQuestionSubmitted && (
                                  <span style={{
                                    padding: '4px 10px',
                                    borderRadius: '12px',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    backgroundColor: isCorrect ? '#10B981' : '#EF4444',
                                    color: '#ffffff'
                                  }}>
                                    {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                                  </span>
                                )}
                              </div>

                              {q.options && q.options.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  {q.options.map((opt, oIdx) => {
                                    const isSelected = selectedOptIdx === oIdx;
                                    const isThisCorrect = correctOptIdx === oIdx;

                                    let optStyle = {
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '12px 16px',
                                      borderRadius: '8px',
                                      border: '1px solid #E5E7EB',
                                      background: '#ffffff',
                                      cursor: isQuestionSubmitted ? 'default' : 'pointer',
                                      transition: 'all 0.2s'
                                    };

                                    if (isQuestionSubmitted) {
                                      if (isSelected && isThisCorrect) {
                                        optStyle.border = '2px solid #10B981';
                                        optStyle.background = '#D1FAE5';
                                        optStyle.fontWeight = '600';
                                      } else if (isSelected && !isThisCorrect) {
                                        optStyle.border = '2px solid #EF4444';
                                        optStyle.background = '#FEE2E2';
                                        optStyle.fontWeight = '600';
                                      } else if (!isSelected && isThisCorrect) {
                                        optStyle.border = '2px solid #10B981';
                                        optStyle.background = '#ECFDF5';
                                      }
                                    } else if (isSelected) {
                                      optStyle.border = '2px solid #0F172A';
                                      optStyle.background = '#F1F5F9';
                                      optStyle.fontWeight = '600';
                                    }

                                    return (
                                      <label key={oIdx} style={optStyle}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                          <input
                                            type={q.type === 'multiple' ? 'checkbox' : 'radio'}
                                            name={`quiz-${quizId}-q${idx}`}
                                            value={oIdx}
                                            checked={isSelected}
                                            disabled={isQuestionSubmitted}
                                            onChange={() => handleOptionChange(quizId, idx, oIdx)}
                                            style={{ accentColor: '#0F172A' }}
                                          />
                                          <span style={{ color: '#374151', fontSize: '14px' }}>{opt}</span>
                                        </div>

                                        {/* Status Labels on Option */}
                                        {isQuestionSubmitted && (
                                          <div>
                                            {isSelected && isThisCorrect && (
                                              <span style={{ color: '#047857', fontWeight: '700', fontSize: '13px' }}>
                                                ✓ Your Answer (Correct)
                                              </span>
                                            )}
                                            {isSelected && !isThisCorrect && (
                                              <span style={{ color: '#DC2626', fontWeight: '700', fontSize: '13px' }}>
                                                ✗ Your Answer (Incorrect)
                                              </span>
                                            )}
                                            {!isSelected && isThisCorrect && (
                                              <span style={{ color: '#047857', fontWeight: '700', fontSize: '13px' }}>
                                                ✓ Correct Answer
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Submit Button (Only shown if not yet submitted) */}
                        {!result && quiz.questions && quiz.questions.length > 0 && (
                          <button
                            className="btn btn-gold"
                            style={{ marginTop: '8px', padding: '12px 24px', fontSize: '15px' }}
                            onClick={() => handleQuizSubmit(quiz)}
                          >
                            Submit Quiz & View Results
                          </button>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
              {quizError && (
                <div style={{ background: '#FEF3C7', color: '#92400E', padding: '16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #FDE68A' }}>
                  ⚠️ {quizError}
                </div>
              )}
            </div>
            )}


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
                {studyMaterials.map(material => {
                  const filename = material.url ? material.url.split('/').pop() : '';
                  const downloadUrl = filename ? `http://localhost:5000/api/courses/resources/download/${filename}?download=true` : '#';

                  return (
                    <div
                      key={material.id}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #E5E7EB',
                        borderRadius: '12px',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '14px',
                        transition: 'all 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ 
                          width: '42px', 
                          height: '42px', 
                          borderRadius: '8px',
                          backgroundColor: '#0F172A',
                          color: '#D4AF37',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '20px',
                          fontWeight: 'bold'
                        }}>
                          📄
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '600', color: '#111827', fontSize: '14px' }}>
                            {material.title}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                            Official Resource PDF
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                        {material.fullUrl ? (
                          <button
                            onClick={() => setPdfModal({ open: true, url: material.fullUrl, title: material.title })}
                            className="btn btn-gold btn-sm"
                            style={{ flex: 1, textDecoration: 'none', textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '12px', padding: '8px 12px' }}
                          >
                            👁️ View PDF
                          </button>
                        ) : (
                          <button disabled className="btn btn-ghost btn-sm" style={{ flex: 1, fontSize: '12px' }}>
                            Not Available
                          </button>
                        )}
                        {filename && (
                          <a
                            href={downloadUrl}
                            download={filename}
                            className="btn btn-ghost btn-sm"
                            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '12px', padding: '8px 12px', border: '1px solid #CBD5E1', color: '#334155' }}
                          >
                            ⬇️ Download
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Video Player Modal */}
        {showVideoPlayer && activeLesson && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '900px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto'
            }}>
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #E5E7EB',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', margin: 0 }}>
                  {activeLesson.title}
                </h3>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowVideoPlayer(false)}
                  style={{ padding: '8px 16px' }}
                >
                  ✕
                </button>
              </div>
              <div style={{ padding: '24px' }}>
                {activeLesson.type === 'video' ? (
                  <div style={{
                    position: 'relative',
                    paddingBottom: '56.25%',
                    height: 0,
                    overflow: 'hidden',
                    borderRadius: '8px',
                    backgroundColor: '#000'
                  }}>
                    {getYouTubeVideoId(activeLesson.url) ? (
                      <>
                        <div id="youtube-player" style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%'
                        }} />
                        {/* Iframe fallback in case YT API doesn't load */}
                        {!player && (
                          <iframe
                            src={`https://www.youtube.com/embed/${getYouTubeVideoId(activeLesson.url)}?autoplay=1&rel=0`}
                            title={activeLesson.title}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              border: 'none'
                            }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        )}
                      </>
                    ) : (
                      <iframe
                        src={activeLesson.url}
                        title={activeLesson.title}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          border: 'none'
                        }}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    )}
                  </div>
                ) : (
                  <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      backgroundColor: '#F8FAFC',
                      borderBottom: '1px solid #E2E8F0'
                    }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>
                        📄 {activeLesson.title} — PDF Document
                      </span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <a
                          href={getResourceUrl(activeLesson.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-gold btn-sm"
                          style={{ fontSize: '12px', padding: '6px 12px', textDecoration: 'none' }}
                        >
                          ↗️ Open in New Tab
                        </a>
                        <a
                          href={getResourceUrl(activeLesson.url)}
                          download
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: '12px', padding: '6px 12px', textDecoration: 'none', border: '1px solid #CBD5E1', color: '#334155' }}
                        >
                          ⬇️ Download
                        </a>
                      </div>
                    </div>
                    <iframe
                      src={getResourceUrl(activeLesson.url)}
                      title={activeLesson.title}
                      style={{
                        width: '100%',
                        height: '600px',
                        border: 'none'
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Dedicated Interactive PDF Preview Modal */}
        {pdfModal.open && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100
          }}>
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '1000px',
              width: '92%',
              height: '88vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}>
              <div style={{
                padding: '16px 24px',
                borderBottom: '1px solid #E5E7EB',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#F8FAFC'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '20px' }}>📄</span>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', margin: 0 }}>
                    {pdfModal.title}
                  </h3>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <a
                    href={pdfModal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-gold btn-sm"
                    style={{ textDecoration: 'none', fontSize: '13px', padding: '6px 14px' }}
                  >
                    ↗️ Open in New Tab
                  </a>
                  <a
                    href={pdfModal.url}
                    download
                    className="btn btn-ghost btn-sm"
                    style={{ textDecoration: 'none', fontSize: '13px', padding: '6px 14px', border: '1px solid #CBD5E1', color: '#334155' }}
                  >
                    ⬇️ Download
                  </a>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setPdfModal({ open: false, url: '', title: '' })}
                    style={{ padding: '6px 12px', fontSize: '16px', fontWeight: 'bold' }}
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, backgroundColor: '#525659' }}>
                <iframe
                  src={pdfModal.url}
                  title={pdfModal.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none'
                  }}
                />
              </div>
            </div>
          </div>
        )}

        <footer className="dash-footer">E-LEARNING MANAGEMENT SYSTEM — STUDENT PORTAL</footer>
      </div>

      <Toast message={toastMessage} />
    </div>
  );
};

export default CourseDetails;
