import React from 'react';
import { useNavigate } from 'react-router-dom';
import './CourseCard.css'; 



const CourseCard = ({ course, isEnrolled, onEnroll, onDrop, seatsLeft, full }) => {
  const navigate = useNavigate()
  const fallbackImage = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600&auto=format&fit=crop';

  const handleCardClick = () => {
    navigate(`/course/${course._id}`);
  };

  return (
    <div className="course-card" onClick={handleCardClick} style={{ cursor: 'pointer' }}>
      {isEnrolled && <div className="badge-enrolled">Enrolled</div>}
      <div className="thumbnail-wrapper" style={{ height: '140px', width: '100%', borderRadius: '10px', overflow: 'hidden', marginBottom: '16px' }}>
        <img
          src={course.thumbnail || fallbackImage}
          alt={course.title}
          style={{ height: '100%', width: '100%', objectFit: 'cover' }}
          onError={(e) => {
            e.target.src = fallbackImage;
          }}
        />
      </div>
      <div className="code">{course.code} · {course.category}</div>
      <h3>{course.title}</h3>
      <div className="desc">{course.description}</div>
      <div className="meta">
        <span>{course.instructor}</span>
        <span className={`seats-tag ${seatsLeft <= 3 ? 'low' : ''}`}>
          {full ? 'Full' : `${seatsLeft} seats left`}
        </span>
      </div>
      <div className="actions" onClick={(e) => e.stopPropagation()}>
        {isEnrolled ? (
          <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={onDrop}>
            Drop Course
          </button>
        ) : (
          <button
            className={`btn ${full ? 'btn-ghost' : 'btn-teal'} btn-sm`}
            style={{ width: '100%' }}
            disabled={full}
            onClick={onEnroll}
          >
            {full ? 'No seats available' : 'Enroll Now'}
          </button>
        )}
      </div>
    </div>
  );
};

export default CourseCard;
