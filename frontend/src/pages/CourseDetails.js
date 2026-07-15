import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Alert, Spinner, Row, Col } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const CourseDetails = () => {
  const { id } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);

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
        headers: { Authorization: `Bearer ${token}` }
      });
      const enrolled = response.data.enrollments.some(
        enrollment => enrollment.course._id === id
      );
      setIsEnrolled(enrolled);
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
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsEnrolled(true);
      navigate('/my-courses');
    } catch (error) {
      setError(error.response?.data?.error || 'Error enrolling in course');
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <Spinner animation="border" />
      </Container>
    );
  }

  if (!course) {
    return (
      <Container className="py-4">
        <Alert variant="danger">Course not found</Alert>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      {error && <Alert variant="danger">{error}</Alert>}
      
      <Card>
        {course.thumbnail && (
          <Card.Img
            variant="top"
            src={course.thumbnail}
            alt={course.title}
            style={{ height: '400px', objectFit: 'cover' }}
          />
        )}
        <Card.Body>
          <div className="mb-3">
            <span className="badge bg-primary me-2">{course.category}</span>
            <span className={`badge me-2 ${
              course.difficulty === 'Beginner' ? 'bg-success' :
              course.difficulty === 'Intermediate' ? 'bg-warning' : 'bg-danger'
            }`}>
              {course.difficulty}
            </span>
            {course.is_active ? (
              <span className="badge bg-success">Active</span>
            ) : (
              <span className="badge bg-danger">Inactive</span>
            )}
          </div>
          
          <Card.Title as="h1">{course.title}</Card.Title>
          <Card.Subtitle className="mb-3 text-muted h4">
            Instructor: {course.instructor}
          </Card.Subtitle>
          
          <Card.Text className="lead">{course.description}</Card.Text>
          
          <hr />
          
          <Row className="mb-4">
            <Col md={6}>
              <h5>Course Details</h5>
              <p><strong>Duration:</strong> {course.duration}</p>
              <p><strong>Difficulty Level:</strong> {course.difficulty}</p>
              <p><strong>Category:</strong> {course.category}</p>
            </Col>
            <Col md={6}>
              <h5>Enrollment Status</h5>
              {isEnrolled ? (
                <Alert variant="success">
                  <strong>You are enrolled in this course!</strong>
                  <br />
                  <Button 
                    variant="outline-success" 
                    className="mt-2"
                    onClick={() => navigate('/my-courses')}
                  >
                    Go to My Courses
                  </Button>
                </Alert>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleEnroll}
                  disabled={enrolling || !course.is_active}
                  className="w-100"
                >
                  {enrolling ? 'Enrolling...' : 'Enroll Now'}
                </Button>
              )}
              {!course.is_active && (
                <Alert variant="warning" className="mt-2">
                  This course is currently not available for enrollment.
                </Alert>
              )}
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default CourseDetails;
