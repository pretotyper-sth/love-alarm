import { Asset } from '@toss/tds-mobile';
import { useNavigate, useLocation } from 'react-router-dom';
import './BottomNav.css';

const TABS = [
  { path: '/alarms', label: '홈', iconName: 'icon-home-mono' },
  { path: '/ai-date', label: 'AI 클론', iconName: 'custom-ai-clone' },
  { path: '/rewards', label: '보상', iconName: 'icon-gift-mono' },
  { path: '/more', label: '더보기', iconName: 'custom-grid' },
];

function MoreGridIcon({ color }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="bottom-nav-svg-icon"
    >
      <rect x="2.5" y="2.5" width="6.2" height="6.2" rx="1.7" fill={color} />
      <rect x="11.3" y="2.5" width="6.2" height="6.2" rx="1.7" fill={color} />
      <rect x="2.5" y="11.3" width="6.2" height="6.2" rx="1.7" fill={color} />
      <rect x="11.3" y="11.3" width="6.2" height="6.2" rx="1.7" fill={color} />
    </svg>
  );
}

function AiCloneIcon({ color }) {
  // 사람 실루엣 + 디지털 복제(클론) 표현: 원본(solid) + 클론(점선/투명)
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="bottom-nav-svg-icon">
      {/* 원본 캐릭터 (왼쪽 앞) */}
      <circle cx="7.5" cy="5.5" r="2.8" fill={color} />
      <path d="M3,15 Q3,10.5 7.5,10.5 Q12,10.5 12,15" fill={color} />
      {/* 클론 (오른쪽 뒤, 페이드) */}
      <circle cx="12" cy="6.5" r="2.4" fill={color} opacity="0.35" />
      <path d="M7.5,16.5 Q7.5,12 12,12 Q16.5,12 16.5,16.5" fill={color} opacity="0.35" />
      {/* 연결 스파크 (AI 표시) */}
      <circle cx="10" cy="9" r="0.8" fill={color} opacity="0.7" />
      <line x1="9" y1="9" x2="8" y2="8.2" stroke={color} strokeWidth="0.8" opacity="0.6" />
      <line x1="11" y1="9" x2="12" y2="8.2" stroke={color} strokeWidth="0.8" opacity="0.6" />
    </svg>
  );
}

function AiDateIcon({ color }) {
  return <AiCloneIcon color={color} />;
}

function BottomNavIcon({ iconName, active }) {
  const color = active ? '#3182f6' : '#8b95a1';

  if (iconName === 'custom-ai-date' || iconName === 'custom-ai-clone') {
    return (
      <span className="bottom-nav-icon-wrap" aria-hidden="true">
        <AiCloneIcon color={color} />
      </span>
    );
  }

  if (iconName === 'custom-grid') {
    return (
      <span className="bottom-nav-icon-wrap" aria-hidden="true">
        <MoreGridIcon color={color} />
      </span>
    );
  }

  return (
    <span className="bottom-nav-icon-wrap" aria-hidden="true">
      <Asset.Icon
        frameShape={Asset.frameShape.CleanW20}
        backgroundColor="transparent"
        name={iconName}
        color={color}
        aria-hidden={true}
        ratio="1/1"
      />
    </span>
  );
}

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="bottom-nav">
      {TABS.map(({ path, label, iconName }) => {
        const active = location.pathname === path;
        return (
          <button
            key={path}
            className={`bottom-nav-tab${active ? ' active' : ''}`}
            onClick={() => navigate(path)}
            aria-label={label}
          >
            <BottomNavIcon iconName={iconName} active={active} />
            <span className="bottom-nav-label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
