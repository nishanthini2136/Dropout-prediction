import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, ProgressBar, Button, Alert, Modal, Form } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const MyCourses = () => {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState(null);
  const [newProgress, setNewProgress] = useState(0);

  useEffect(() => {
    fetchMyEnrollments();
  }, []);

  const fetchMyEnrollments = async () => {
    try {
      const response = await axios.get('/api/enrollments/my-courses', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEnrollments(response.data.enrollments);
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
        navigate('/student/login');
      } else {
        setError('Error fetching enrolled courses');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProgress = async () => {
    try {
      await axios.put(`/api/enrollments/${selectedEnrollment._id}/progress`, 
        { progress: newProgress },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowProgressModal(false);
      fetchMyEnrollments();
    } catch (error) {
      setError('Error updating progress');
    }
  };

  const handleUnenroll = async (enrollmentId) => {
    if (!window.confirm('Are you sure you want to unenroll from this course?')) return;

    try {
      await axios.delete(`/api/enrollments/${enrollmentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchMyEnrollments();
    } catch (error) {
      setError('Error unenrolling from course');
    }
  };

  const openProgressModal = (enrollment) => {
    setSelectedEnrollment(enrollment);
    setNewProgress(enrollment.progress);
    setShowProgressModal(true);
  };

  const getProgressVariant = (progress) => {
    if (progress < 30) return 'danger';
    if (progress < 70) return 'warning';
    return 'success';
  };

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <div>Loading...</div>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <h2 className="mb-4">My Enrolled Courses</h2>
      
      {error && <Alert variant="danger">{error}</Alert>}

      {enrollments.length === 0 ? (
        <Alert variant="info">
          You haven't enrolled in any courses yet. 
          <Button variant="link" onClick={() => navigate('/student/dashboard')}>
            Browse available courses
          </Button>
        </Alert>
      ) : (
        <Row>
          {enrollments.map((item) => (
            <Col key={item.enrollment._id} md={4} className="mb-4">
              <Card className="h-100">
                {item.course.thumbnail && (
                  <Card.Img
                    variant="top"
                    src={item.course.thumbnail}
                    alt={item.course.title}
                    style={{ height: '200px', objectFit: 'cover' }}
                  />
                )}
                <Card.Body>
                  <Card.Title>{item.course.title}</Card.Title>
                  <Card.Subtitle className="mb-2 text-muted">
                    {item.course.instructor}
                  </Card.Subtitle>
                  <Card.Text className="text-truncate" style={{ maxHeight: '60px' }}>
                    {item.course.description}
                  </Card.Text>
                  
                  <div className="mb-3">
                    <div className="d-flex justify-content-between mb-1">
                      <span>Progress</span>
                      <span>{item.enrollment.progress}%</span>
                    </div>
                    <ProgressBar 
                      now={item.enrollment.progress} 
                      variant={getProgressVariant(item.enrollment.progress)}
                    />
                  </div>
                  
                  <Card.Text className="text-muted small">
                    Enrolled: {new Date(item.enrollment.enrolled_at).toLocaleDateString()}
                  </Card.Text>
                </Card.Body>
                <Card.Footer>
                  <Button
                    variant="outline-primary"
                    className="w-100 mb-2"
                    onClick={() => openProgressModal(item.enrollment)}
                  >
                    Update Progress
                  </Button>
                  <Button
                    variant="outline-danger"
                    className="w-100"
                    onClick={() => handleUnenroll(item.enrollment._id)}
                  >
                    Unenroll
                  </Button>
                </Card.Footer>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal show={showProgressModal} onHide={() => setShowProgressModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Update Progress</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Course: {selectedEnrollment?.course?.title}</Form.Label>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Progress (%)</Form.Label>
              <Form.Control
                type="range"
                min="0"
                max="100"
                value={newProgress}
                onChange={(e) => setNewProgress(parseInt(e.target.value))}
              />
              <div className="text-center mt-2">
                <strong>{newProgress}%</strong>
              </div>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowProgressModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleUpdateProgress}>
            Update
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default MyCourses;
