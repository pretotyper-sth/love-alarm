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

function AiCloneIcon({ color }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="bottom-nav-svg-icon"
    >
      {/* 원본 사람 (왼쪽) */}
      <circle cx="8.5" cy="7" r="3.2" fill={color} />
      <path d="M3 18.5C3 14.9 5.5 12.5 8.5 12.5C11.5 12.5 14 14.9 14 18.5" fill={color} />
      {/* 클론 사람 (오른쪽, 페이드) */}
      <circle cx="15.5" cy="8" r="2.8" fill={color} opacity="0.3" />
      <path d="M10 20C10 16.7 12.2 14.5 15.5 14.5C18.8 14.5 21 16.7 21 20" fill={color} opacity="0.3" />
      {/* AI 스파크 */}
      <path d="M13 5.5L13.6 7L15 7.6L13.6 8.2L13 9.7L12.4 8.2L11 7.6L12.4 7L13 5.5Z" fill={color} />
    </svg>
  );
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
