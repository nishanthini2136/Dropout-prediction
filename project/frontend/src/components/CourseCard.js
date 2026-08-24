import React from 'react';
import { useNavigate } from 'react-router-dom';
import './CourseCard.css'; 



const CourseCard = ({ course, isEnrolled, onEnroll, onDrop, seatsLeft, full }) => {
  const navigate = useNavigate();
  const fallbackImage = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300"><rect width="100%" height="100%" fill="#1e293b"/><text x="50%" y="50%" fill="#94a3b8" font-family="sans-serif" font-size="20" text-anchor="middle" dy=".3em">Course Learning Material</text></svg>')}`;

  const capacity = course?.capacity !== undefined ? course.capacity : 30;
  const actualSeatsLeft = seatsLeft !== undefined 
    ? seatsLeft 
    : (course?.seats_left !== undefined ? course.seats_left : Math.max(0, capacity - (course?.enrolled_count || 0)));
  const isFull = full !== undefined ? full : actualSeatsLeft <= 0;

  const handleCardClick = () => {
    navigate(`/course/${course._id}`);
  };

  const getThumbnailUrl = (thumb) => {
    if (!thumb) return fallbackImage;
    if (thumb.startsWith('http://') || thumb.startsWith('https://')) return thumb;
    return `http://localhost:5000${thumb}`;
  };

  return (
    <div className="course-card" onClick={handleCardClick} style={{ cursor: 'pointer' }}>
      <div className="thumbnail-wrapper" style={{ height: '140px', width: '100%', borderRadius: '10px', overflow: 'hidden', marginBottom: '16px', position: 'relative' }}>
        {isEnrolled && <div className="badge-enrolled">Enrolled</div>}
        <img
          src={getThumbnailUrl(course.thumbnail)}
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
        <span className={`seats-tag ${actualSeatsLeft <= 3 ? 'low' : ''}`}>
          {isFull ? 'Full' : `${actualSeatsLeft} seats left`}
        </span>
      </div>
      <div className="actions" onClick={(e) => e.stopPropagation()}>
        {isEnrolled ? (
          <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={onDrop}>
            Drop Course
          </button>
        ) : (
          <button
            className={`btn ${isFull ? 'btn-ghost' : 'btn-teal'} btn-sm`}
            style={{ width: '100%' }}
            disabled={isFull}
            onClick={onEnroll}
          >
            {isFull ? 'No seats available' : 'Enroll Now'}
          </button>
        )}
      </div>
    </div>
  );
};

export default CourseCard;
