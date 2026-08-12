import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import './Dashboard.css';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';

const CourseCreator = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [toastMessage, setToastMessage] = useState('');
  const [activeSection, setActiveSection] = useState('basic');
  const [saving, setSaving] = useState(false);

  // Basic Course Information
  const [basicInfo, setBasicInfo] = useState({
    title: '',
    description: '',
    category: '',
    difficulty: 'Beginner',
    instructor: '',
    duration: '',
    language: 'English',
    thumbnail: null,
    prerequisites: '',
    syllabus_pdf: null,
    reference_materials_pdf: null,
    practice_exercises_pdf: null
  });

  useEffect(() => {
    if (id) {
      axios.get(`http://localhost:5000/api/courses/${id}`)
        .then(res => {
          const c = res.data.course;
          if (c) {
            setBasicInfo(prev => ({
              ...prev,
              title: c.title || '',
              description: c.description || '',
              category: c.category || '',
              difficulty: c.difficulty || 'Beginner',
              instructor: c.instructor || '',
              duration: c.duration || '',
              language: c.language || 'English',
              prerequisites: c.prerequisites || '',
              syllabus_pdf: c.syllabus_pdf || null,
              reference_materials_pdf: c.reference_materials_pdf || null,
              practice_exercises_pdf: c.practice_exercises_pdf || null
            }));
            if (c.modules) setModules(c.modules);
            if (c.completionCriteria) setCompletionCriteria(c.completionCriteria);
            if (c.learningConfig) setLearningConfig(c.learningConfig);
            if (c.discussionTopics) setDiscussionTopics(c.discussionTopics);
          }
        })
        .catch(err => console.error('Error fetching course for edit:', err));
    }
  }, [id]);

  // Course Modules
  const [modules, setModules] = useState([
    { id: 1, title: '', description: '', resources: [], quizzes: [], assignments: [] }
  ]);

  // Course Completion Criteria
  const [completionCriteria, setCompletionCriteria] = useState({
    minQuizScore: 70,
    assignmentCompletion: 100,
    minVideoWatchPercentage: 80,
    minOverallProgress: 100
  });

  // Learning Configuration
  const [learningConfig, setLearningConfig] = useState({
    estimatedStudyTime: '',
    unlockRules: 'Sequential',
    reminderSchedule: 'Weekly',
    moduleWeightage: 'Equal',
    learningObjectives: ''
  });

  // Discussion Forum
  const [discussionTopics, setDiscussionTopics] = useState([
    { id: 1, title: 'Doubt Discussion', type: 'general' },
    { id: 2, title: 'Assignment Discussion', type: 'assignment' }
  ]);

  const handleBasicInfoChange = (e) => {
    e.stopPropagation();
    const { name, value } = e.target;
    setBasicInfo(prev => ({ ...prev, [name]: value }));
  };

  const handleThumbnailUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setBasicInfo(prev => ({ ...prev, thumbnail: file }));
    }
  };

  const addModule = () => {
    const newModule = {
      id: Date.now(),
      title: '',
      description: '',
      resources: [],
      quizzes: [],
      assignments: []
    };
    setModules(prev => [...prev, newModule]);
  };

  const updateModule = (moduleId, field, value) => {
    setModules(prev => prev.map(module => 
      module.id === moduleId ? { ...module, [field]: value } : module
    ));
  };

  const handleModuleChange = (e, moduleId, field) => {
    e.stopPropagation();
    updateModule(moduleId, field, e.target.value);
  };

  const deleteModule = (moduleId) => {
    if (modules.length > 1) {
      setModules(prev => prev.filter(module => module.id !== moduleId));
    }
  };

  const addResource = (moduleId) => {
    const newResource = {
      id: Date.now(),
      type: 'video',
      title: '',
      url: '',
      duration: ''
    };
    setModules(prev => prev.map(module =>
      module.id === moduleId
        ? { ...module, resources: [...module.resources, newResource] }
        : module
    ));
  };

  const updateResource = (moduleId, resourceId, field, value) => {
    setModules(prev => prev.map(module =>
      module.id === moduleId
        ? {
            ...module,
            resources: module.resources.map(resource =>
              resource.id === resourceId ? { ...resource, [field]: value } : resource
            )
          }
        : module
    ));
  };

  const handleResourceChange = (e, moduleId, resourceId, field) => {
    e.preventDefault();
    e.stopPropagation();
    updateResource(moduleId, resourceId, field, e.target.value);
  };

  const deleteResource = (moduleId, resourceId) => {
    setModules(prev => prev.map(module =>
      module.id === moduleId
        ? { ...module, resources: module.resources.filter(r => r.id !== resourceId) }
        : module
    ));
  };

  const addQuiz = (moduleId) => {
    const newQuiz = {
      id: Date.now(),
      title: '',
      timeLimit: 30,
      passingMarks: 70,
      questions: [
        {
          id: 1,
          question: '',
          options: ['', '', '', ''],
          correctAnswer: 0,
          marks: 1
        }
      ]
    };
    setModules(prev => prev.map(module =>
      module.id === moduleId
        ? { ...module, quizzes: [...module.quizzes, newQuiz] }
        : module
    ));
  };

  const updateQuiz = (moduleId, quizId, field, value) => {
    setModules(prev => prev.map(module =>
      module.id === moduleId
        ? {
            ...module,
            quizzes: module.quizzes.map(quiz =>
              quiz.id === quizId ? { ...quiz, [field]: value } : quiz
            )
          }
        : module
    ));
  };

  const handleQuizChange = (e, moduleId, quizId, field) => {
    e.stopPropagation();
    updateQuiz(moduleId, quizId, field, e.target.value);
  };

  const addQuestion = (moduleId, quizId) => {
    const newQuestion = {
      id: Date.now(),
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      marks: 1
    };
    setModules(prev => prev.map(module =>
      module.id === moduleId
        ? {
            ...module,
            quizzes: module.quizzes.map(quiz =>
              quiz.id === quizId
                ? { ...quiz, questions: [...quiz.questions, newQuestion] }
                : quiz
            )
          }
        : module
    ));
  };

  const updateQuestion = (moduleId, quizId, questionId, field, value) => {
    setModules(prev => prev.map(module =>
      module.id === moduleId
        ? {
            ...module,
            quizzes: module.quizzes.map(quiz =>
              quiz.id === quizId
                ? {
                    ...quiz,
                    questions: quiz.questions.map(question =>
                      question.id === questionId ? { ...question, [field]: value } : question
                    )
                  }
                : quiz
            )
          }
        : module
    ));
  };

  const handleQuestionChange = (e, moduleId, quizId, questionId, field) => {
    e.stopPropagation();
    updateQuestion(moduleId, quizId, questionId, field, e.target.value);
  };

  const updateQuestionOption = (moduleId, quizId, questionId, optionIndex, value) => {
    setModules(prev => prev.map(module =>
      module.id === moduleId
        ? {
            ...module,
            quizzes: module.quizzes.map(quiz =>
              quiz.id === quizId
                ? {
                    ...quiz,
                    questions: quiz.questions.map(question =>
                      question.id === questionId
                        ? {
                            ...question,
                            options: question.options.map((opt, idx) =>
                              idx === optionIndex ? value : opt
                            )
                          }
                        : question
                    )
                  }
                : quiz
            )
          }
        : module
    ));
  };

  const deleteQuiz = (moduleId, quizId) => {
    setModules(prev => prev.map(module =>
      module.id === moduleId
        ? { ...module, quizzes: module.quizzes.filter(q => q.id !== quizId) }
        : module
    ));
  };

  const addAssignment = (moduleId) => {
    const newAssignment = {
      id: Date.now(),
      title: '',
      description: '',
      dueDate: '',
      maxMarks: 100,
      submissionType: 'PDF',
      fileUpload: false
    };
    setModules(prev => prev.map(module =>
      module.id === moduleId
        ? { ...module, assignments: [...module.assignments, newAssignment] }
        : module
    ));
  };

  const updateAssignment = (moduleId, assignmentId, field, value) => {
    setModules(prev => prev.map(module =>
      module.id === moduleId
        ? {
            ...module,
            assignments: module.assignments.map(assignment =>
              assignment.id === assignmentId ? { ...assignment, [field]: value } : assignment
            )
          }
        : module
    ));
  };

  const handleAssignmentChange = (e, moduleId, assignmentId, field) => {
    e.stopPropagation();
    updateAssignment(moduleId, assignmentId, field, e.target.value);
  };

  const deleteAssignment = (moduleId, assignmentId) => {
    setModules(prev => prev.map(module =>
      module.id === moduleId
        ? { ...module, assignments: module.assignments.filter(a => a.id !== assignmentId) }
        : module
    ));
  };

  const addDiscussionTopic = () => {
    const newTopic = {
      id: Date.now(),
      title: '',
      type: 'general'
    };
    setDiscussionTopics(prev => [...prev, newTopic]);
  };

  const updateDiscussionTopic = (topicId, field, value) => {
    setDiscussionTopics(prev => prev.map(topic =>
      topic.id === topicId ? { ...topic, [field]: value } : topic
    ));
  };

  const handleDiscussionTopicChange = (e, topicId, field) => {
    e.stopPropagation();
    updateDiscussionTopic(topicId, field, e.target.value);
  };

  const deleteDiscussionTopic = (topicId) => {
    setDiscussionTopics(prev => prev.filter(topic => topic.id !== topicId));
  };

  const handleSaveAsDraft = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('title', basicInfo.title);
      formData.append('description', basicInfo.description);
      formData.append('category', basicInfo.category);
      formData.append('difficulty', basicInfo.difficulty);
      formData.append('instructor', basicInfo.instructor);
      formData.append('duration', basicInfo.duration);
      formData.append('language', basicInfo.language);
      formData.append('prerequisites', basicInfo.prerequisites);
      formData.append('is_active', false);

      if (basicInfo.thumbnail instanceof File) {
        formData.append('thumbnail', basicInfo.thumbnail);
      }
      if (basicInfo.syllabus_pdf instanceof File) {
        formData.append('syllabus_pdf', basicInfo.syllabus_pdf);
      }
      if (basicInfo.reference_materials_pdf instanceof File) {
        formData.append('reference_materials_pdf', basicInfo.reference_materials_pdf);
      }
      if (basicInfo.practice_exercises_pdf instanceof File) {
        formData.append('practice_exercises_pdf', basicInfo.practice_exercises_pdf);
      }

      formData.append('modules', JSON.stringify(modules));
      formData.append('completionCriteria', JSON.stringify(completionCriteria));
      formData.append('learningConfig', JSON.stringify(learningConfig));
      formData.append('discussionTopics', JSON.stringify(discussionTopics));

      const url = id ? `http://localhost:5000/api/courses/${id}` : 'http://localhost:5000/api/courses';
      const method = id ? 'put' : 'post';

      const response = await axios[method](url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      console.log('Course saved successfully:', response.data);
      setToastMessage(id ? 'Course updated successfully' : 'Course saved as draft');
      setTimeout(() => navigate('/admin/dashboard'), 1500);
    } catch (error) {
      console.error('Error saving course:', error);
      if (error.response) {
        setToastMessage(`Error: ${error.response.data?.error || error.response.statusText}`);
      } else {
        setToastMessage(`Error: ${error.message}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    const errors = {};
    if (!basicInfo.title || !basicInfo.title.trim()) {
      errors.title = 'Course title is required';
    }
    if (!basicInfo.description || !basicInfo.description.trim()) {
      errors.description = 'Course description is required';
    }
    if (!basicInfo.category || !basicInfo.category.trim()) {
      errors.category = 'Category is required';
    }
    if (!basicInfo.instructor || !basicInfo.instructor.trim()) {
      errors.instructor = 'Instructor name is required';
    }
    if (!basicInfo.duration || !basicInfo.duration.trim()) {
      errors.duration = 'Course duration is required';
    }

    if (Object.keys(errors).length > 0) {
      const errorMessage = Object.values(errors).join(', ');
      setToastMessage(`Please fill in required fields: ${errorMessage}`);
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('title', basicInfo.title);
      formData.append('description', basicInfo.description);
      formData.append('category', basicInfo.category);
      formData.append('difficulty', basicInfo.difficulty);
      formData.append('instructor', basicInfo.instructor);
      formData.append('duration', basicInfo.duration);
      formData.append('language', basicInfo.language);
      formData.append('prerequisites', basicInfo.prerequisites);
      formData.append('is_active', true);

      if (basicInfo.thumbnail instanceof File) {
        formData.append('thumbnail', basicInfo.thumbnail);
      }
      if (basicInfo.syllabus_pdf instanceof File) {
        formData.append('syllabus_pdf', basicInfo.syllabus_pdf);
      }
      if (basicInfo.reference_materials_pdf instanceof File) {
        formData.append('reference_materials_pdf', basicInfo.reference_materials_pdf);
      }
      if (basicInfo.practice_exercises_pdf instanceof File) {
        formData.append('practice_exercises_pdf', basicInfo.practice_exercises_pdf);
      }

      formData.append('modules', JSON.stringify(modules));
      formData.append('completionCriteria', JSON.stringify(completionCriteria));
      formData.append('learningConfig', JSON.stringify(learningConfig));
      formData.append('discussionTopics', JSON.stringify(discussionTopics));

      const url = id ? `http://localhost:5000/api/courses/${id}` : 'http://localhost:5000/api/courses';
      const method = id ? 'put' : 'post';

      const response = await axios[method](url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      console.log('Course published successfully:', response.data);
      setToastMessage(id ? 'Course updated & published successfully' : 'Course published successfully');
      setTimeout(() => navigate('/admin/dashboard'), 1500);
    } catch (error) {
      console.error('Error publishing course:', error);
      if (error.response) {
        setToastMessage(`Error: ${error.response.data?.error || error.response.statusText}`);
      } else {
        setToastMessage(`Error: ${error.message}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (section) => {
    setActiveSection(activeSection === section ? null : section);
  };

  const handleSectionClick = (e, section) => {
    // Only toggle if clicking on the header, not on form elements
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select') || e.target.closest('textarea')) {
      return;
    }
    toggleSection(section);
  };

  const sections = [
    { id: 'basic', title: 'Basic Course Information', icon: '📋' },
    { id: 'modules', title: 'Course Modules', icon: '📚' },
    { id: 'completion', title: 'Course Completion Criteria', icon: '✅' },
    { id: 'learning', title: 'Learning Configuration', icon: '⚙️' },
    { id: 'discussion', title: 'Discussion Forum', icon: '💬' }
  ];

  return (
    <div className="dashboard-screen">
      <Navbar />

      <div className="wrap">
        <button 
          onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/admin/dashboard')} 
          style={{ 
            marginTop: '20px',
            marginBottom: '10px', 
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
        <div className="dash-header">
          <div className="eyebrow">Course Management</div>
          <h1>Create New Course</h1>
          <p>Build comprehensive courses with modules, quizzes, assignments, and learning resources for your students.</p>
        </div>

        {/* Section Navigation */}
        <div style={{ marginBottom: '32px' }}>
          {sections.map(section => (
            <div
              key={section.id}
              onClick={(e) => handleSectionClick(e, section.id)}
              style={{
                background: '#ffffff',
                border: '1px solid #E5E7EB',
                borderRadius: '12px',
                marginBottom: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '24px' }}>{section.icon}</span>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', margin: 0 }}>
                    {section.title}
                  </h3>
                </div>
                <span style={{ fontSize: '20px', color: '#6B7280' }}>
                  {activeSection === section.id ? '▼' : '▶'}
                </span>
              </div>

              {activeSection === section.id && (
                <div onClick={(e) => e.stopPropagation()} style={{ padding: '0 24px 24px', borderTop: '1px solid #E5E7EB' }}>
                  {section.id === 'basic' && (
                    <div style={{ paddingTop: '24px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#4B5563', marginBottom: '8px' }}>
                            Course Title *
                          </label>
                          <input
                            type="text"
                            name="title"
                            value={basicInfo.title}
                            onChange={handleBasicInfoChange}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Enter course title"
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: '1px solid #E5E7EB',
                              borderRadius: '8px',
                              fontSize: '14px',
                              fontFamily: 'Poppins, sans-serif'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#4B5563', marginBottom: '8px' }}>
                            Category *
                          </label>
                          <select
                            name="category"
                            value={basicInfo.category}
                            onChange={handleBasicInfoChange}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            autoFocus={false}
                            tabIndex={-1}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: '1px solid #E5E7EB',
                              borderRadius: '8px',
                              fontSize: '14px',
                              fontFamily: 'Poppins, sans-serif'
                            }}
                          >
                            <option value="">Select category</option>
                            <option value="Programming">Programming</option>
                            <option value="Data Science">Data Science</option>
                            <option value="Design">Design</option>
                            <option value="Business">Business</option>
                            <option value="Marketing">Marketing</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#4B5563', marginBottom: '8px' }}>
                            Difficulty Level *
                          </label>
                          <select
                            name="difficulty"
                            value={basicInfo.difficulty}
                            onChange={handleBasicInfoChange}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            autoFocus={false}
                            tabIndex={-1}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: '1px solid #E5E7EB',
                              borderRadius: '8px',
                              fontSize: '14px',
                              fontFamily: 'Poppins, sans-serif'
                            }}
                          >
                            <option value="Beginner">Beginner</option>
                            <option value="Intermediate">Intermediate</option>
                            <option value="Advanced">Advanced</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#4B5563', marginBottom: '8px' }}>
                            Instructor Name *
                          </label>
                          <input
                            type="text"
                            name="instructor"
                            value={basicInfo.instructor}
                            onChange={handleBasicInfoChange}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Enter instructor name"
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: '1px solid #E5E7EB',
                              borderRadius: '8px',
                              fontSize: '14px',
                              fontFamily: 'Poppins, sans-serif'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#4B5563', marginBottom: '8px' }}>
                            Course Duration *
                          </label>
                          <input
                            type="text"
                            name="duration"
                            value={basicInfo.duration}
                            onChange={handleBasicInfoChange}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="e.g., 8 weeks, 40 hours"
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: '1px solid #E5E7EB',
                              borderRadius: '8px',
                              fontSize: '14px',
                              fontFamily: 'Poppins, sans-serif'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#4B5563', marginBottom: '8px' }}>
                            Language *
                          </label>
                          <select
                            name="language"
                            value={basicInfo.language}
                            onChange={handleBasicInfoChange}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            autoFocus={false}
                            tabIndex={-1}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: '1px solid #E5E7EB',
                              borderRadius: '8px',
                              fontSize: '14px',
                              fontFamily: 'Poppins, sans-serif'
                            }}
                          >
                            <option value="English">English</option>
                            <option value="Spanish">Spanish</option>
                            <option value="French">French</option>
                            <option value="German">German</option>
                            <option value="Chinese">Chinese</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ marginTop: '20px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#4B5563', marginBottom: '8px' }}>
                          Course Description *
                        </label>
                        <textarea
                          name="description"
                          value={basicInfo.description}
                          onChange={handleBasicInfoChange}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Enter detailed course description"
                          rows={4}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: '1px solid #E5E7EB',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontFamily: 'Poppins, sans-serif',
                            resize: 'vertical'
                          }}
                        />
                      </div>
                      <div style={{ marginTop: '20px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#4B5563', marginBottom: '8px' }}>
                          Prerequisites
                        </label>
                        <textarea
                          name="prerequisites"
                          value={basicInfo.prerequisites}
                          onChange={handleBasicInfoChange}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Enter course prerequisites (if any)"
                          rows={2}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: '1px solid #E5E7EB',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontFamily: 'Poppins, sans-serif',
                            resize: 'vertical'
                          }}
                        />
                      </div>
                      <div style={{ marginTop: '20px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#4B5563', marginBottom: '8px' }}>
                          Course Thumbnail
                        </label>
                        <div style={{
                          border: '2px dashed #E5E7EB',
                          borderRadius: '12px',
                          padding: '40px',
                          textAlign: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#0F172A'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
                        >
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleThumbnailUpload}
                            style={{ display: 'none' }}
                            id="thumbnail-upload"
                          />
                          <label htmlFor="thumbnail-upload" style={{ cursor: 'pointer' }}>
                            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📷</div>
                            <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '4px' }}>
                              {basicInfo.thumbnail ? basicInfo.thumbnail.name : 'Click to upload or drag and drop'}
                            </div>
                            <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
                              PNG, JPG, GIF up to 10MB
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Course PDF Resource Files Upload Section */}
                      <div style={{ marginTop: '24px', borderTop: '1px solid #E5E7EB', paddingTop: '20px' }}>
                        <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
                          📚 Course Resource Documents (PDF Uploads)
                        </h4>
                        <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px' }}>
                          Upload official PDF materials for students (Syllabus, Reference Materials, and Practice Exercises).
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                          {/* Syllabus PDF */}
                          <div style={{ border: '1px solid #CBD5E1', borderRadius: '10px', padding: '16px', background: '#F8FAFC' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1E293B', marginBottom: '6px' }}>
                              📄 Course Syllabus PDF
                            </label>
                            <input
                              type="file"
                              accept=".pdf,application/pdf"
                              onChange={(e) => {
                                if (e.target.files[0]) {
                                  const f = e.target.files[0];
                                  setBasicInfo(prev => ({ ...prev, syllabus_pdf: f }));
                                }
                              }}
                              style={{ fontSize: '12px', width: '100%' }}
                            />
                            {basicInfo.syllabus_pdf && (
                              <div style={{ fontSize: '12px', color: '#047857', marginTop: '8px', fontWeight: '500' }}>
                                ✓ {basicInfo.syllabus_pdf instanceof File ? basicInfo.syllabus_pdf.name : basicInfo.syllabus_pdf.split('/').pop()}
                              </div>
                            )}
                          </div>

                          {/* Reference Materials PDF */}
                          <div style={{ border: '1px solid #CBD5E1', borderRadius: '10px', padding: '16px', background: '#F8FAFC' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1E293B', marginBottom: '6px' }}>
                              📚 Reference Materials PDF
                            </label>
                            <input
                              type="file"
                              accept=".pdf,application/pdf"
                              onChange={(e) => {
                                if (e.target.files[0]) {
                                  const f = e.target.files[0];
                                  setBasicInfo(prev => ({ ...prev, reference_materials_pdf: f }));
                                }
                              }}
                              style={{ fontSize: '12px', width: '100%' }}
                            />
                            {basicInfo.reference_materials_pdf && (
                              <div style={{ fontSize: '12px', color: '#047857', marginTop: '8px', fontWeight: '500' }}>
                                ✓ {basicInfo.reference_materials_pdf instanceof File ? basicInfo.reference_materials_pdf.name : basicInfo.reference_materials_pdf.split('/').pop()}
                              </div>
                            )}
                          </div>

                          {/* Practice Exercises PDF */}
                          <div style={{ border: '1px solid #CBD5E1', borderRadius: '10px', padding: '16px', background: '#F8FAFC' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1E293B', marginBottom: '6px' }}>
                              ✍️ Practice Exercises PDF
                            </label>
                            <input
                              type="file"
                              accept=".pdf,application/pdf"
                              onChange={(e) => {
                                if (e.target.files[0]) {
                                  const f = e.target.files[0];
                                  setBasicInfo(prev => ({ ...prev, practice_exercises_pdf: f }));
                                }
                              }}
                              style={{ fontSize: '12px', width: '100%' }}
                            />
                            {basicInfo.practice_exercises_pdf && (
                              <div style={{ fontSize: '12px', color: '#047857', marginTop: '8px', fontWeight: '500' }}>
                                ✓ {basicInfo.practice_exercises_pdf instanceof File ? basicInfo.practice_exercises_pdf.name : basicInfo.practice_exercises_pdf.split('/').pop()}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {section.id === 'modules' && (
                    <div style={{ paddingTop: '24px' }}>
                      {modules.map((module, moduleIndex) => (
                        <div key={module.id} style={{
                          background: '#F8FAFC',
                          border: '1px solid #E5E7EB',
                          borderRadius: '12px',
                          padding: '24px',
                          marginBottom: '20px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', margin: 0 }}>
                              Module {moduleIndex + 1}
                            </h4>
                            {modules.length > 1 && (
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => deleteModule(module.id)}
                                style={{ color: '#EF4444' }}
                              >
                                Delete Module
                              </button>
                            )}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#4B5563', marginBottom: '8px' }}>
                                Module Title *
                              </label>
                              <input
                                type="text"
                                value={module.title}
                                onChange={(e) => handleModuleChange(e, module.id, 'title')}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="Enter module title"
                                style={{
                                  width: '100%',
                                  padding: '12px 16px',
                                  border: '1px solid #E5E7EB',
                                  borderRadius: '8px',
                                  fontSize: '14px',
                                  fontFamily: 'Poppins, sans-serif'
                                }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#4B5563', marginBottom: '8px' }}>
                                Module Description
                              </label>
                              <input
                                type="text"
                                value={module.description}
                                onChange={(e) => handleModuleChange(e, module.id, 'description')}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="Enter module description"
                                style={{
                                  width: '100%',
                                  padding: '12px 16px',
                                  border: '1px solid #E5E7EB',
                                  borderRadius: '8px',
                                  fontSize: '14px',
                                  fontFamily: 'Poppins, sans-serif'
                                }}
                              />
                            </div>
                          </div>

                          {/* Learning Resources */}
                          <div style={{ marginBottom: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                              <h5 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: 0 }}>
                                Learning Resources
                              </h5>
                              <button
                                className="btn btn-gold btn-sm"
                                onClick={() => addResource(module.id)}
                              >
                                + Add Resource
                              </button>
                            </div>
                            {module.resources.map((resource, resourceIndex) => (
                              <div key={resource.id} style={{
                                background: '#ffffff',
                                border: '1px solid #E5E7EB',
                                borderRadius: '8px',
                                padding: '16px',
                                marginBottom: '12px'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#111827' }}>
                                    Resource {resourceIndex + 1}
                                  </span>
                                  <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => deleteResource(module.id, resource.id)}
                                    style={{ color: '#EF4444', padding: '4px 8px' }}
                                  >
                                    Remove
                                  </button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' }}>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4B5563', marginBottom: '6px' }}>
                                      Type
                                    </label>
                                    <select
                                      value={resource.type}
                                      onChange={(e) => handleResourceChange(e, module.id, resource.id, 'type')}
                                      onClick={(e) => e.stopPropagation()}
                                      onMouseDown={(e) => e.stopPropagation()}
                                      autoFocus={false}
                                      tabIndex={-1}
                                      style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '1px solid #E5E7EB',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        fontFamily: 'Poppins, sans-serif'
                                      }}
                                    >
                                      <option value="video">Video Lecture</option>
                                      <option value="pdf">PDF Notes</option>
                                      <option value="ppt">PPT Slides</option>
                                      <option value="link">Reference Link</option>
                                      <option value="code">Coding Example</option>
                                      <option value="download">Downloadable Resource</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4B5563', marginBottom: '6px' }}>
                                      Title
                                    </label>
                                    <input
                                      type="text"
                                      value={resource.title}
                                      onChange={(e) => handleResourceChange(e, module.id, resource.id, 'title')}
                                      onClick={(e) => e.stopPropagation()}
                                      placeholder="Resource title"
                                      style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '1px solid #E5E7EB',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        fontFamily: 'Poppins, sans-serif'
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4B5563', marginBottom: '6px' }}>
                                      Duration/Size
                                    </label>
                                    <input
                                      type="text"
                                      value={resource.duration}
                                      onChange={(e) => handleResourceChange(e, module.id, resource.id, 'duration')}
                                      onClick={(e) => e.stopPropagation()}
                                      placeholder="e.g., 15 min, 2MB"
                                      style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '1px solid #E5E7EB',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        fontFamily: 'Poppins, sans-serif'
                                      }}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4B5563', marginBottom: '6px' }}>
                                    URL / File Path
                                  </label>
                                  <input
                                    type="text"
                                    value={resource.url}
                                    onChange={(e) => handleResourceChange(e, module.id, resource.id, 'url')}
                                    onClick={(e) => e.stopPropagation()}
                                    placeholder="Enter URL or file path"
                                    style={{
                                      width: '100%',
                                      padding: '8px 12px',
                                      border: '1px solid #E5E7EB',
                                      borderRadius: '6px',
                                      fontSize: '13px',
                                      fontFamily: 'Poppins, sans-serif'
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Quizzes */}
                          <div style={{ marginBottom: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                              <h5 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: 0 }}>
                                Quizzes
                              </h5>
                              <button
                                className="btn btn-gold btn-sm"
                                onClick={() => addQuiz(module.id)}
                              >
                                + Add Quiz
                              </button>
                            </div>
                            {module.quizzes.map((quiz, quizIndex) => (
                              <div key={quiz.id} style={{
                                background: '#ffffff',
                                border: '1px solid #E5E7EB',
                                borderRadius: '8px',
                                padding: '16px',
                                marginBottom: '12px'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#111827' }}>
                                    Quiz {quizIndex + 1}
                                  </span>
                                  <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => deleteQuiz(module.id, quiz.id)}
                                    style={{ color: '#EF4444', padding: '4px 8px' }}
                                  >
                                    Remove
                                  </button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4B5563', marginBottom: '6px' }}>
                                      Quiz Title
                                    </label>
                                    <input
                                      type="text"
                                      value={quiz.title}
                                      onChange={(e) => handleQuizChange(e, module.id, quiz.id, 'title')}
                                      onClick={(e) => e.stopPropagation()}
                                      placeholder="Quiz title"
                                      style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '1px solid #E5E7EB',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        fontFamily: 'Poppins, sans-serif'
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4B5563', marginBottom: '6px' }}>
                                      Time Limit (min)
                                    </label>
                                    <input
                                      type="number"
                                      value={quiz.timeLimit}
                                      onChange={(e) => handleQuizChange(e, module.id, quiz.id, 'timeLimit')}
                                      onClick={(e) => e.stopPropagation()}
                                      placeholder="30"
                                      style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '1px solid #E5E7EB',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        fontFamily: 'Poppins, sans-serif'
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4B5563', marginBottom: '6px' }}>
                                      Passing Marks (%)
                                    </label>
                                    <input
                                      type="number"
                                      value={quiz.passingMarks}
                                      onChange={(e) => handleQuizChange(e, module.id, quiz.id, 'passingMarks')}
                                      onClick={(e) => e.stopPropagation()}
                                      placeholder="70"
                                      style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '1px solid #E5E7EB',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        fontFamily: 'Poppins, sans-serif'
                                      }}
                                    />
                                  </div>
                                </div>
                                {quiz.questions.map((question, questionIndex) => (
                                  <div key={question.id} style={{
                                    background: '#F8FAFC',
                                    border: '1px solid #E5E7EB',
                                    borderRadius: '6px',
                                    padding: '12px',
                                    marginBottom: '12px'
                                  }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                      <span style={{ fontSize: '12px', fontWeight: '500', color: '#111827' }}>
                                        Question {questionIndex + 1}
                                      </span>
                                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <span style={{ fontSize: '12px', color: '#6B7280' }}>Marks:</span>
                                        <input
                                          type="number"
                                          value={question.marks}
                                          onChange={(e) => handleQuestionChange(e, module.id, quiz.id, question.id, 'marks')}
                                          onClick={(e) => e.stopPropagation()}
                                          style={{
                                            width: '50px',
                                            padding: '4px 8px',
                                            border: '1px solid #E5E7EB',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            fontFamily: 'Poppins, sans-serif'
                                          }}
                                        />
                                      </div>
                                    </div>
                                    <div style={{ marginBottom: '12px' }}>
                                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#4B5563', marginBottom: '4px' }}>
                                        Question
                                      </label>
                                      <textarea
                                        value={question.question}
                                        onChange={(e) => handleQuestionChange(e, module.id, quiz.id, question.id, 'question')}
                                        onClick={(e) => e.stopPropagation()}
                                        placeholder="Enter question"
                                        rows={2}
                                        style={{
                                          width: '100%',
                                          padding: '8px 12px',
                                          border: '1px solid #E5E7EB',
                                          borderRadius: '6px',
                                          fontSize: '13px',
                                          fontFamily: 'Poppins, sans-serif',
                                          resize: 'vertical'
                                        }}
                                      />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                                      {question.options.map((option, optionIndex) => (
                                        <div key={optionIndex} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <input
                                            type="radio"
                                            name={`correct-${quiz.id}-${question.id}`}
                                            checked={question.correctAnswer === optionIndex}
                                            onChange={() => updateQuestion(module.id, quiz.id, question.id, 'correctAnswer', optionIndex)}
                                            style={{ cursor: 'pointer' }}
                                          />
                                          <input
                                            type="text"
                                            value={option}
                                            onChange={(e) => {
                                              e.stopPropagation();
                                              updateQuestionOption(module.id, quiz.id, question.id, optionIndex, e.target.value);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            placeholder={`Option ${optionIndex + 1}`}
                                            style={{
                                              flex: 1,
                                              padding: '6px 10px',
                                              border: '1px solid #E5E7EB',
                                              borderRadius: '4px',
                                              fontSize: '12px',
                                              fontFamily: 'Poppins, sans-serif'
                                            }}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => addQuestion(module.id, quiz.id)}
                                  style={{ marginTop: '8px' }}
                                >
                                  + Add Question
                                </button>
                              </div>
                            ))}
                          </div>

                          {/* Assignments */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                              <h5 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: 0 }}>
                                Assignments
                              </h5>
                              <button
                                className="btn btn-gold btn-sm"
                                onClick={() => addAssignment(module.id)}
                              >
                                + Add Assignment
                              </button>
                            </div>
                            {module.assignments.map((assignment, assignmentIndex) => (
                              <div key={assignment.id} style={{
                                background: '#ffffff',
                                border: '1px solid #E5E7EB',
                                borderRadius: '8px',
                                padding: '16px',
                                marginBottom: '12px'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#111827' }}>
                                    Assignment {assignmentIndex + 1}
                                  </span>
                                  <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => deleteAssignment(module.id, assignment.id)}
                                    style={{ color: '#EF4444', padding: '4px 8px' }}
                                  >
                                    Remove
                                  </button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '12px' }}>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4B5563', marginBottom: '6px' }}>
                                      Assignment Title
                                    </label>
                                    <input
                                      type="text"
                                      value={assignment.title}
                                      onChange={(e) => handleAssignmentChange(e, module.id, assignment.id, 'title')}
                                      onClick={(e) => e.stopPropagation()}
                                      placeholder="Assignment title"
                                      style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '1px solid #E5E7EB',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        fontFamily: 'Poppins, sans-serif'
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4B5563', marginBottom: '6px' }}>
                                      Due Date
                                    </label>
                                    <input
                                      type="date"
                                      value={assignment.dueDate}
                                      onChange={(e) => handleAssignmentChange(e, module.id, assignment.id, 'dueDate')}
                                      onClick={(e) => e.stopPropagation()}
                                      style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '1px solid #E5E7EB',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        fontFamily: 'Poppins, sans-serif'
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4B5563', marginBottom: '6px' }}>
                                      Maximum Marks
                                    </label>
                                    <input
                                      type="number"
                                      value={assignment.maxMarks}
                                      onChange={(e) => handleAssignmentChange(e, module.id, assignment.id, 'maxMarks')}
                                      onClick={(e) => e.stopPropagation()}
                                      placeholder="100"
                                      style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '1px solid #E5E7EB',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        fontFamily: 'Poppins, sans-serif'
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4B5563', marginBottom: '6px' }}>
                                      Submission Type
                                    </label>
                                    <select
                                      value={assignment.submissionType}
                                      onChange={(e) => handleAssignmentChange(e, module.id, assignment.id, 'submissionType')}
                                      onClick={(e) => e.stopPropagation()}
                                      onMouseDown={(e) => e.stopPropagation()}
                                      autoFocus={false}
                                      tabIndex={-1}
                                      style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '1px solid #E5E7EB',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        fontFamily: 'Poppins, sans-serif'
                                      }}
                                    >
                                      <option value="text">Text</option>
                                      <option value="pdf">PDF</option>
                                      <option value="doc">DOC</option>
                                    </select>
                                  </div>
                                </div>
                                <div style={{ marginBottom: '12px' }}>
                                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4B5563', marginBottom: '6px' }}>
                                    Description
                                  </label>
                                  <textarea
                                    value={assignment.description}
                                    onChange={(e) => handleAssignmentChange(e, module.id, assignment.id, 'description')}
                                    onClick={(e) => e.stopPropagation()}
                                    placeholder="Assignment description"
                                    rows={3}
                                    style={{
                                      width: '100%',
                                      padding: '8px 12px',
                                      border: '1px solid #E5E7EB',
                                      borderRadius: '6px',
                                      fontSize: '13px',
                                      fontFamily: 'Poppins, sans-serif',
                                      resize: 'vertical'
                                    }}
                                  />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <input
                                    type="checkbox"
                                    id={`file-upload-${assignment.id}`}
                                    checked={assignment.fileUpload}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      updateAssignment(module.id, assignment.id, 'fileUpload', e.target.checked);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ cursor: 'pointer' }}
                                  />
                                  <label htmlFor={`file-upload-${assignment.id}`} style={{ fontSize: '13px', color: '#4B5563', cursor: 'pointer' }}>
                                    Allow file upload
                                  </label>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      <button
                        className="btn btn-gold"
                        onClick={addModule}
                        style={{ width: '100%' }}
                      >
                        + Add Module
                      </button>
                    </div>
                  )}

                  {section.id === 'completion' && (
                    <div style={{ paddingTop: '24px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#4B5563', marginBottom: '8px' }}>
                            Minimum Quiz Score (%)
                          </label>
                          <input
                            type="number"
                            value={completionCriteria.minQuizScore}
                            onChange={(e) => {
                              e.stopPropagation();
                              setCompletionCriteria(prev => ({ ...prev, minQuizScore: parseInt(e.target.value) }));
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: '1px solid #E5E7EB',
                              borderRadius: '8px',
                              fontSize: '14px',
                              fontFamily: 'Poppins, sans-serif'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#4B5563', marginBottom: '8px' }}>
                            Assignment Completion (%)
                          </label>
                          <input
                            type="number"
                            value={completionCriteria.assignmentCompletion}
                            onChange={(e) => {
                              e.stopPropagation();
                              setCompletionCriteria(prev => ({ ...prev, assignmentCompletion: parseInt(e.target.value) }));
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: '1px solid #E5E7EB',
                              borderRadius: '8px',
                              fontSize: '14px',
                              fontFamily: 'Poppins, sans-serif'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#4B5563', marginBottom: '8px' }}>
                            Minimum Video Watch Percentage (%)
                          </label>
                          <input
                            type="number"
                            value={completionCriteria.minVideoWatchPercentage}
                            onChange={(e) => {
                              e.stopPropagation();
                              setCompletionCriteria(prev => ({ ...prev, minVideoWatchPercentage: parseInt(e.target.value) }));
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: '1px solid #E5E7EB',
                              borderRadius: '8px',
                              fontSize: '14px',
                              fontFamily: 'Poppins, sans-serif'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#4B5563', marginBottom: '8px' }}>
                            Minimum Overall Course Progress (%)
                          </label>
                          <input
                            type="number"
                            value={completionCriteria.minOverallProgress}
                            onChange={(e) => {
                              e.stopPropagation();
                              setCompletionCriteria(prev => ({ ...prev, minOverallProgress: parseInt(e.target.value) }));
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: '1px solid #E5E7EB',
                              borderRadius: '8px',
                              fontSize: '14px',
                              fontFamily: 'Poppins, sans-serif'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {section.id === 'learning' && (
                    <div style={{ paddingTop: '24px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#4B5563', marginBottom: '8px' }}>
                            Estimated Study Time (per module)
                          </label>
                          <input
                            type="text"
                            value={learningConfig.estimatedStudyTime}
                            onChange={(e) => {
                              e.stopPropagation();
                              setLearningConfig(prev => ({ ...prev, estimatedStudyTime: e.target.value }));
                            }}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="e.g., 4 hours"
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: '1px solid #E5E7EB',
                              borderRadius: '8px',
                              fontSize: '14px',
                              fontFamily: 'Poppins, sans-serif'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#4B5563', marginBottom: '8px' }}>
                            Module Unlock Rules
                          </label>
                          <select
                            value={learningConfig.unlockRules}
                            onChange={(e) => {
                              e.stopPropagation();
                              setLearningConfig(prev => ({ ...prev, unlockRules: e.target.value }));
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            autoFocus={false}
                            tabIndex={-1}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: '1px solid #E5E7EB',
                              borderRadius: '8px',
                              fontSize: '14px',
                              fontFamily: 'Poppins, sans-serif'
                            }}
                          >
                            <option value="Sequential">Sequential</option>
                            <option value="Free Access">Free Access</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#4B5563', marginBottom: '8px' }}>
                            Reminder Schedule
                          </label>
                          <select
                            value={learningConfig.reminderSchedule}
                            onChange={(e) => {
                              e.stopPropagation();
                              setLearningConfig(prev => ({ ...prev, reminderSchedule: e.target.value }));
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            autoFocus={false}
                            tabIndex={-1}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: '1px solid #E5E7EB',
                              borderRadius: '8px',
                              fontSize: '14px',
                              fontFamily: 'Poppins, sans-serif'
                            }}
                          >
                            <option value="Daily">Daily</option>
                            <option value="Weekly">Weekly</option>
                            <option value="Monthly">Monthly</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#4B5563', marginBottom: '8px' }}>
                            Module Weightage
                          </label>
                          <select
                            value={learningConfig.moduleWeightage}
                            onChange={(e) => {
                              e.stopPropagation();
                              setLearningConfig(prev => ({ ...prev, moduleWeightage: e.target.value }));
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            autoFocus={false}
                            tabIndex={-1}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: '1px solid #E5E7EB',
                              borderRadius: '8px',
                              fontSize: '14px',
                              fontFamily: 'Poppins, sans-serif'
                            }}
                          >
                            <option value="Equal">Equal</option>
                            <option value="Custom">Custom</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ marginTop: '20px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#4B5563', marginBottom: '8px' }}>
                          Learning Objectives
                        </label>
                        <textarea
                          value={learningConfig.learningObjectives}
                          onChange={(e) => {
                            e.stopPropagation();
                            setLearningConfig(prev => ({ ...prev, learningObjectives: e.target.value }));
                          }}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Enter learning objectives for this course"
                          rows={4}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: '1px solid #E5E7EB',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontFamily: 'Poppins, sans-serif',
                            resize: 'vertical'
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {section.id === 'discussion' && (
                    <div style={{ paddingTop: '24px' }}>
                      <div style={{ marginBottom: '16px' }}>
                        <button
                          className="btn btn-gold btn-sm"
                          onClick={addDiscussionTopic}
                        >
                          + Add Discussion Topic
                        </button>
                      </div>
                      {discussionTopics.map((topic, index) => (
                        <div key={topic.id} style={{
                          background: '#F8FAFC',
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px',
                          padding: '16px',
                          marginBottom: '12px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '500', color: '#111827' }}>
                              Topic {index + 1}
                            </span>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => deleteDiscussionTopic(topic.id)}
                              style={{ color: '#EF4444', padding: '4px 8px' }}
                            >
                              Remove
                            </button>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4B5563', marginBottom: '6px' }}>
                                Topic Title
                              </label>
                              <input
                                type="text"
                                value={topic.title}
                                onChange={(e) => handleDiscussionTopicChange(e, topic.id, 'title')}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="Discussion topic title"
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: '1px solid #E5E7EB',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  fontFamily: 'Poppins, sans-serif'
                                }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4B5563', marginBottom: '6px' }}>
                                Topic Type
                              </label>
                              <select
                                value={topic.type}
                                onChange={(e) => handleDiscussionTopicChange(e, topic.id, 'type')}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                autoFocus={false}
                                tabIndex={-1}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: '1px solid #E5E7EB',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  fontFamily: 'Poppins, sans-serif'
                                }}
                              >
                                <option value="general">General Discussion</option>
                                <option value="assignment">Assignment Discussion</option>
                                <option value="doubt">Doubt Discussion</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Publish Settings */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #E5E7EB',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '32px'
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '20px' }}>
            Publish Settings
          </h3>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              className="btn btn-ghost"
              onClick={() => navigate('/admin/dashboard')}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="btn btn-gold"
              onClick={handleSaveAsDraft}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save as Draft'}
            </button>
            <button
              className="btn btn-gold"
              onClick={handlePublish}
              disabled={saving}
              style={{ backgroundColor: '#10B981' }}
            >
              {saving ? 'Publishing...' : 'Publish Course'}
            </button>
          </div>
        </div>

        <footer className="dash-footer">E-LEARNING MANAGEMENT SYSTEM — ADMIN DASHBOARD</footer>
      </div>

      <Toast message={toastMessage} />
    </div>
  );
};

export default CourseCreator;
