import React, { useEffect, useState } from 'react';
import './Toast.css';

const Toast = ({ message, duration = 2200 }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (message) {
      setShow(true);
      const timer = setTimeout(() => {
        setShow(false);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [message, duration]);

  if (!message) return null;

  return (
    <div className={`toast ${show ? 'show' : ''}`}>
      <span className="dot"></span>
      <span>{message}</span>
    </div>
  );
};
export default Toast;