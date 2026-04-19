import { Asset } from '@toss/tds-mobile';
import { useNavigate, useLocation } from 'react-router-dom';
import './BottomNav.css';

const TABS = [
  { path: '/alarms', label: '홈', iconName: 'icon-home-mono' },
  { path: '/ai-date', label: 'AI 클론', iconName: 'custom-twinkle' },
  { path: '/rewards', label: '보상', iconName: 'icon-gift-mono' },
  { path: '/more', label: '더보기', iconName: 'custom-grid' },
];

function TwinkleIcon({ color }) {
  return (
    <svg width="24" height="24" viewBox="0 0 40 40" fill="none" aria-hidden="true" className="bottom-nav-svg-icon">
      <path
        d="m37.8005 15.834-5.21-1.167c-.7002-.2313-1.3159-.6653-1.7691-1.2469-.4533-.5816-.7237-1.2847-.7769-2.0201l-.938-6.487c-.0263-.17806-.1156-.34076-.2519-.45839-.1362-.11763-.3102-.18236-.4901-.18236-.18 0-.354.06473-.4902.18236s-.2256.28033-.2518.45839l-.937 6.487c-.0529.7358-.3231 1.4393-.7764 2.0213s-1.0692 1.0163-1.7696 1.2477l-5.207 1.167c-.1665.0371-.3153.1299-.4219.263-.1067.133-.1648.2985-.1648.469s.0581.336.1648.469c.1066.1331.2554.2259.4219.263l5.206 1.168c.7006.2309 1.3169.6648 1.7704 1.2467s.7238 1.2855.7766 2.0213l.937 6.488c.0262.1781.1156.3408.2518.4584s.3102.1823.4902.1823c.1799 0 .3539-.0647.4901-.1823.1363-.1176.2256-.2803.2519-.4584l.938-6.488c.0526-.7357.3228-1.4392.7761-2.0211.4533-.5818 1.0694-1.0159 1.7699-1.2469l5.21-1.168c.1664-.0371.3152-.1299.4219-.263.1066-.133.1647-.2985.1647-.469s-.0581-.336-.1647-.469c-.1067-.1331-.2555-.2259-.4219-.263zm-16.247 12.03-3.641-.817c-.4455-.152-.8358-.4326-1.1219-.8064-.286-.3738-.4548-.8239-.4851-1.2936l-.656-4.537c-.0263-.1781-.1156-.3408-.2519-.4584-.1362-.1176-.3102-.1823-.4901-.1823-.18 0-.354.0647-.4902.1823s-.2256.2803-.2518.4584l-.656 4.537c-.0303.4696-.199.9196-.4848 1.2934-.2858.3737-.676.6544-1.1212.8066l-3.64204.817c-.16644.0371-.31525.1299-.4219.263-.10665.133-.16477.2985-.16477.469s.05812.336.16477.469c.10665.1331.25546.2259.4219.263l3.64104.816c.4454.152.8358.4326 1.1218.8064s.4548.8239.4852 1.2936l.656 4.537c.0262.1781.1156.3408.2518.4584s.3102.1824.4902.1824c.1799 0 .3539-.0648.4901-.1824.1363-.1176.2256-.2803.2519-.4584l.656-4.537c.0303-.4697.1991-.9198.4851-1.2936.2861-.3738.6764-.6544 1.1219-.8064l3.641-.816c.1664-.0371.3152-.1299.4219-.263.1066-.133.1647-.2985.1647-.469s-.0581-.336-.1647-.469c-.1067-.1331-.2555-.2259-.4219-.263zm-12.70404-8.906c.18023.0002.35447-.0647.49076-.1826s.2255-.281.25124-.4594l.52504-3.63c.0203-.3453.1422-.6769.3504-.9532.2081-.2763.4933-.485.8196-.5998l2.913-.654c.1659-.0376.3142-.1304.4204-.2633.1062-.133.164-.2981.164-.4682s-.0578-.3352-.164-.4682c-.1062-.1329-.2545-.2257-.4204-.2633l-2.913-.654c-.3263-.1147-.6113-.3231-.8195-.59924-.2082-.27612-.3301-.60757-.3505-.95276l-.52504-3.63c-.02622-.17806-.11559-.34076-.25181-.45839s-.31021-.18236-.49019-.18236-.35396.06473-.49018.18236-.2256.28033-.25182.45839l-.524 3.63c-.02082.34507-.14291.67635-.35102.95239-.2081.27601-.49297.48461-.81898.59961l-2.913.654c-.16594.0376-.31419.1304-.42039.2633-.1062.133-.16405.2981-.16405.4682s.05785.3352.16405.4682c.1062.1329.25445.2257.42039.2633l2.913.654c.32624.1152.61125.3241.81936.6006.20811.2764.33008.608.35064.9534l.524 3.629c.02575.1784.11495.3415.25124.4594s.31054.1828.49076.1826z"
        fill={color}
      />
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

  if (iconName === 'custom-twinkle') {
    return (
      <span className="bottom-nav-icon-wrap" aria-hidden="true">
        <TwinkleIcon color={color} />
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
