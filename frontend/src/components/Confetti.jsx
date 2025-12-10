import { useEffect, useRef } from 'react';
import './Confetti.css';

export function Confetti() {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const colors = ['#FF6B6B', '#FFE66D', '#4ECDC4', '#FF8B94', '#FF69B4'];
    const heartCount = 12;

    for (let i = 0; i < heartCount; i++) {
      const heart = document.createElement('div');
      heart.className = 'confetti-burst';
      
      const size = 18 + Math.random() * 10;
      const angle = ((360 / heartCount) * i) * (Math.PI / 180); // 라디안 변환
      const distance = 80 + Math.random() * 60;
      
      // JS로 미리 계산
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      
      heart.style.cssText = `
        font-size: ${size}px;
        color: ${colors[Math.floor(Math.random() * colors.length)]};
        --x: ${x}px;
        --y: ${y}px;
      `;
      heart.textContent = '♥';
      
      container.appendChild(heart);
    }

    // 1초 후 전체 제거
    const timer = setTimeout(() => {
      container.innerHTML = '';
    }, 1000);

    return () => {
      clearTimeout(timer);
      container.innerHTML = '';
    };
  }, []);

  return <div ref={containerRef} className="confetti-container" />;
}

