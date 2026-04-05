import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  Spacing,
  Button,
} from '@toss/tds-mobile';
import { storage, STORAGE_KEYS } from '../utils/storage';
import './MatchSuccessPage.css';

function createConfettiPieces() {
  const colors = ['#f04452', '#3182f6', '#ffd700', '#22c55e', '#a855f7', '#ec4899', '#ff6b6b', '#4ecdc4', '#ffe66d'];
  const heartColors = ['#f04452', '#FF69B4', '#FF1493', '#ec4899', '#ff6b6b'];

  return {
    confetti: Array.from({ length: 250 }, (_, index) => ({
      id: `confetti-${index}`,
      left: `${Math.random() * 100}%`,
      drift: `${(Math.random() - 0.5) * 100}px`,
      rotation: `${Math.random() * 720 - 360}deg`,
      animationDelay: `${Math.random() * 1.5}s`,
      animationDuration: `${2 + Math.random() * 1.5}s`,
      backgroundColor: colors[Math.floor(Math.random() * colors.length)],
    })),
    hearts: Array.from({ length: 50 }, (_, index) => ({
      id: `heart-${index}`,
      left: `${Math.random() * 100}%`,
      drift: `${(Math.random() - 0.5) * 100}px`,
      rotation: `${Math.random() * 360 - 180}deg`,
      animationDelay: `${Math.random() * 1.5}s`,
      animationDuration: `${2.5 + Math.random() * 1.5}s`,
      size: 16 + Math.random() * 12,
      color: heartColors[Math.floor(Math.random() * heartColors.length)],
    })),
  };
}

export function MatchSuccessPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiFading, setConfettiFading] = useState(false);
  const [confettiPieces, setConfettiPieces] = useState({ confetti: [], hearts: [] });
  const [copyToast, setCopyToast] = useState({ show: false, message: '' });

  const fromInstagramId = location.state?.fromInstagramId;
  const targetInstagramId = location.state?.targetInstagramId;

  useEffect(() => {
    let startTimer;
    let fadeTimer;
    let hideTimer;

    // targetInstagramId로 컨페티 표시 여부 저장 (되돌리기해도 같은 대상이면 컨페티 안 뜸)
    if (targetInstagramId) {
      // 이미 컨페티를 본 대상인지 확인
      const shownConfettiTargets = storage.get(STORAGE_KEYS.CONFETTI_SHOWN) || [];
      
      if (!shownConfettiTargets.includes(targetInstagramId)) {
        startTimer = window.setTimeout(() => {
          setConfettiPieces(createConfettiPieces());
          setShowConfetti(true);
        }, 0);
        
        // localStorage에 저장 (targetInstagramId 기준)
        storage.set(STORAGE_KEYS.CONFETTI_SHOWN, [...shownConfettiTargets, targetInstagramId]);
        
        // 5초 후 컨페티 페이드아웃 시작
        fadeTimer = window.setTimeout(() => {
          setConfettiFading(true);
        }, 5000);
        
        // 6초 후 컨페티 완전히 제거
        hideTimer = window.setTimeout(() => {
          setShowConfetti(false);
          setConfettiFading(false);
        }, 6000);
      }
    }

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [targetInstagramId]);

  const handleConfirm = () => {
    navigate('/alarms', { replace: true });
  };

  const handleCopyTargetId = async () => {
    if (!targetInstagramId) return;
    try {
      await navigator.clipboard.writeText(targetInstagramId);
    } catch {
      const el = document.createElement('textarea');
      el.value = targetInstagramId;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopyToast({ show: true, message: `ID ${targetInstagramId}를 복사했어요` });
    setTimeout(() => {
      setCopyToast(prev => ({ ...prev, show: false }));
      setTimeout(() => setCopyToast({ show: false, message: '' }), 350);
    }, 3000);
  };

  return (
    <div className="match-success-page-container">
      {/* 컨페티 애니메이션 - 위에서 아래로 */}
      {showConfetti && (
        <div className={`confetti-container ${confettiFading ? 'confetti-fading' : ''}`}>
          {/* 일반 컨페티 */}
          {confettiPieces.confetti.map((piece) => (
              <div
                key={piece.id}
                className="confetti"
                style={{
                  left: piece.left,
                  '--drift': piece.drift,
                  '--rotation': piece.rotation,
                  animationDelay: piece.animationDelay,
                  animationDuration: piece.animationDuration,
                  backgroundColor: piece.backgroundColor,
                }}
              />
            ))}
          {/* 하트 컨페티 */}
          {confettiPieces.hearts.map((heart) => (
              <div
                key={heart.id}
                className="confetti-heart"
                style={{
                  left: heart.left,
                  '--drift': heart.drift,
                  '--rotation': heart.rotation,
                  animationDelay: heart.animationDelay,
                  animationDuration: heart.animationDuration,
                }}
              >
                <svg width={heart.size} height={heart.size} viewBox="0 0 24 24" fill={heart.color}>
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
              </div>
            ))}
        </div>
      )}
      <Spacing size={30} />

      {/* 박수 이모지 */}
      <div className="match-content-section">
        <img 
          src="https://static.toss.im/3d-emojis/u1F44F-apng.png" 
          alt="박수"
          className="match-emoji-image"
        />

        {/* 타이틀 */}
        <h1 className="match-title">서로의 마음을 확인했어요</h1>
        
        {/* 서브타이틀 */}
        <p className="match-subtitle">
          이 화면을 핑계로 연락해 보세요.<br />
          망설일 필요 없어요!
        </p>
        <Spacing size={48} />

        {/* 프로필 한 줄 */}
        {(fromInstagramId || targetInstagramId) && (
          <div className="match-users-inline">
            <span className="match-inline-label">from</span>
            <span className="match-inline-handle">{fromInstagramId ?? '—'}</span>
            <img
              src="https://static.toss.im/3d-emojis/u2764-apng.png"
              className="match-inline-heart"
              alt="❤️"
            />
            <span className="match-inline-label">to</span>
            <span
              className="match-inline-handle match-inline-handle--copy"
              onClick={handleCopyTargetId}
              role="button"
              tabIndex={0}
            >
              {targetInstagramId ?? '—'}
            </span>
          </div>
        )}

        {/* 복사 토스트 */}
        <div className={`single-toast ${copyToast.show ? 'show' : ''}`}>
          <div className="custom-toast-content">
            <span className="custom-toast-icon">✓</span>
            <span className="custom-toast-text">{copyToast.message}</span>
          </div>
        </div>
      </div>

      {/* 하단 고정 버튼 */}
      <div className="match-fixed-bottom-cta">
        <Button
          size="xlarge"
          display="block"
          onClick={handleConfirm}
        >
          확인했어요
        </Button>
      </div>
    </div>
  );
}
