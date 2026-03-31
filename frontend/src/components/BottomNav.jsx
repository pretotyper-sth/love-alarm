import { Asset } from '@toss/tds-mobile';
import { useNavigate, useLocation } from 'react-router-dom';
import './BottomNav.css';

const TABS = [
  { path: '/alarms', label: '홈', iconName: 'icon-home-mono' },
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

function BottomNavIcon({ iconName, active }) {
  const color = active ? '#3182f6' : '#8b95a1';

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
