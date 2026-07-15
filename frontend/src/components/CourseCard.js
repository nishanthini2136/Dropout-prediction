import React from 'react';
import './CourseCard.css';

const CourseCard = ({ course, isEnrolled, onEnroll, onDrop, seatsLeft, full }) => {
  return (
    <div className="course-card">
      {isEnrolled && <div className="badge-enrolled">Enrolled</div>}
      <div className="code">{course.code} · {course.category}</div>
      <h3>{course.title}</h3>
      <div className="desc">{course.description}</div>
      <div className="meta">
        <span>{course.instructor}</span>
        <span className={`seats-tag ${seatsLeft <= 3 ? 'low' : ''}`}>
          {full ? 'Full' : `${seatsLeft} seats left`}
        </span>
      </div>
      <div className="actions">
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
