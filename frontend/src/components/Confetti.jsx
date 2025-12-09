import { useEffect, useRef } from 'react';
import './Confetti.css';

export function Confetti() {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 테스트용: 색상 변경해서 적용 확인
    const colors = ['#00FF00', '#0000FF', '#FFFF00']; // 초록, 파랑, 노랑으로 변경!
    const heartColors = ['#FF0000']; // 빨간색 하트만
    const particleCount = 30;
    const heartCount = 30; // 하트 많이!

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

    // 하트 컨페티 파티클 생성 (SVG 사용) - 크게!
    for (let i = 0; i < heartCount; i++) {
      const heart = document.createElement('div');
      heart.className = 'confetti-heart';
      heart.style.left = `${Math.random() * 100}%`;
      heart.style.animationDelay = `${Math.random() * 2}s`;
      heart.style.animationDuration = `${2.5 + Math.random() * 2}s`;
      
      // 큰 크기로!
      const size = 30 + Math.random() * 20;
      const color = heartColors[Math.floor(Math.random() * heartColors.length)];
      
      heart.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
      </svg>`;
      
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

