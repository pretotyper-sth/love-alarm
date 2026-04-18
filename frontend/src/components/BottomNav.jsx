import { Asset } from '@toss/tds-mobile';
import { useNavigate, useLocation } from 'react-router-dom';
import './BottomNav.css';

const TABS = [
  { path: '/alarms', label: '홈', iconName: 'icon-home-mono' },
  { path: '/ai-date', label: 'AI 소개팅', iconName: 'custom-ai-date' },
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

function AiDateIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="bottom-nav-svg-icon">
      {/* 왼쪽 캐릭터 */}
      <circle cx="6" cy="5" r="2.2" fill={color} opacity="0.85" />
      <rect x="4.2" y="8" width="3.6" height="4.5" rx="1.4" fill={color} opacity="0.85" />
      {/* 오른쪽 캐릭터 */}
      <circle cx="14" cy="5" r="2.2" fill={color} />
      <rect x="12.2" y="8" width="3.6" height="4.5" rx="1.4" fill={color} />
      {/* 하트 */}
      <path d="M10 16 C9.5 15.2 7.5 13.5 7.5 12.2 C7.5 11.2 8.3 10.5 9.2 10.8 C9.6 11 9.9 11.3 10 11.6 C10.1 11.3 10.4 11 10.8 10.8 C11.7 10.5 12.5 11.2 12.5 12.2 C12.5 13.5 10.5 15.2 10 16Z" fill={color === '#3182f6' ? '#ff6b9d' : '#c8d6e0'} />
    </svg>
  );
}

function BottomNavIcon({ iconName, active }) {
  const color = active ? '#3182f6' : '#8b95a1';

  if (iconName === 'custom-ai-date') {
    return (
      <span className="bottom-nav-icon-wrap" aria-hidden="true">
        <AiDateIcon color={color} />
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
