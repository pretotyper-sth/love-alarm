import { useEffect, useRef } from 'react';
import './Confetti.css';

export function Confetti() {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 컨페티 파티클 생성
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];
    const heartColors = ['#FF6B6B', '#FF4757', '#FF69B4', '#FF1493', '#E91E63'];
    const particleCount = 50;
    const heartCount = 15; // 하트 개수

    // 일반 컨페티 파티클 생성
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'confetti-particle';
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      particle.style.animationDelay = `${Math.random() * 2}s`;
      particle.style.animationDuration = `${2 + Math.random() * 2}s`;
      
      // 랜덤 크기
      const size = 8 + Math.random() * 8;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      
      container.appendChild(particle);
    }

    // 하트 컨페티 파티클 생성
    for (let i = 0; i < heartCount; i++) {
      const heart = document.createElement('div');
      heart.className = 'confetti-heart';
      heart.style.left = `${Math.random() * 100}%`;
      heart.style.setProperty('--heart-color', heartColors[Math.floor(Math.random() * heartColors.length)]);
      heart.style.animationDelay = `${Math.random() * 2}s`;
      heart.style.animationDuration = `${2.5 + Math.random() * 2}s`;
      
      // 랜덤 크기
      const size = 12 + Math.random() * 10;
      heart.style.setProperty('--heart-size', `${size}px`);
      
      container.appendChild(heart);
    }

    return () => {
      // cleanup
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, []);

  return <div ref={containerRef} className="confetti-container" />;
}




