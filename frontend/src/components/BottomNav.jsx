import { Asset } from '@toss/tds-mobile';
import { useNavigate, useLocation } from 'react-router-dom';
import './BottomNav.css';

const TABS = [
  { path: '/alarms', label: '홈', iconName: 'icon-home-mono' },
  { path: '/ai-date', label: 'AI 클론', iconName: 'custom-ai-clone' },
  { path: '/rewards', label: '보상', iconName: 'icon-gift-mono' },
  { path: '/more', label: '더보기', iconName: 'custom-grid' },
];

function AiCloneIcon({ color }) {
  // 원본 사람(solid) + 클론(페이드) + 스파크 — 24×24 꽉 채움
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="bottom-nav-svg-icon">
      {/* 원본 사람 머리 */}
      <circle cx="8" cy="6.5" r="3.5" fill={color} />
      {/* 원본 사람 몸 */}
      <path d="M2 19.5C2 15.4 4.7 12.5 8 12.5C11.3 12.5 14 15.4 14 19.5" fill={color} />
      {/* 클론 사람 머리 (뒤, 페이드) */}
      <circle cx="16" cy="7.5" r="3" fill={color} opacity="0.28" />
      {/* 클론 사람 몸 (뒤, 페이드) */}
      <path d="M10 21C10 17.4 12.3 14.8 16 14.8C19.7 14.8 22 17.4 22 21" fill={color} opacity="0.28" />
      {/* AI 스파크 (우상단) */}
      <path d="M19 2L19.7 4L22 4.7L19.7 5.4L19 7.4L18.3 5.4L16 4.7L18.3 4L19 2Z" fill={color} />
    </svg>
  );
}

function MoreGridIcon({ color }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="bottom-nav-svg-icon"
    >
      <rect x="3" y="3" width="7" height="7" rx="2" fill={color} />
      <rect x="14" y="3" width="7" height="7" rx="2" fill={color} />
      <rect x="3" y="14" width="7" height="7" rx="2" fill={color} />
      <rect x="14" y="14" width="7" height="7" rx="2" fill={color} />
    </svg>
  );
}


function BottomNavIcon({ iconName, active }) {
  const color = active ? '#3182f6' : '#8b95a1';

  if (iconName === 'custom-ai-clone') {
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
        frameShape={Asset.frameShape.CleanW24}
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
