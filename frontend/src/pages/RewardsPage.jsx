import { useState, useEffect, useRef } from 'react';
import {
  List,
  ListRow,
  Button,
  Spacing,
  Top,
} from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { logScreen, logClick } from '../utils/analytics';
import './RewardsPage.css';

const IS_DEV = import.meta.env.DEV;

// ─── localStorage 키 ───────────────────────────────────────
const VISIT_DATES_KEY = 'love_alarm_visit_dates';
const CHECKIN10_CYCLES_KEY = 'love_alarm_checkin10_cycles';
const CHECKIN30_CLAIMED_KEY = 'love_alarm_checkin30_claimed';

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function loadVisitDates() {
  try {
    return JSON.parse(localStorage.getItem(VISIT_DATES_KEY) || '[]');
  } catch {
    return [];
  }
}

function getConsecutiveStreak(dates) {
  const set = new Set(dates);
  let streak = 0;
  const d = new Date();
  for (;;) {
    const key = d.toISOString().split('T')[0];
    if (!set.has(key)) break;
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// ─── 컴포넌트 ───────────────────────────────────────────────
export function RewardsPage() {
  const { setUser } = useAuth();
  const appendedTodayRef = useRef(false);
  const [visitDates] = useState(() => {
    const dates = loadVisitDates();
    const today = getTodayStr();
    const updated = dates.includes(today) ? dates : [...dates, today];
    if (updated.length !== dates.length) {
      appendedTodayRef.current = true;
      localStorage.setItem(VISIT_DATES_KEY, JSON.stringify(updated));
    }
    return updated;
  });

  useEffect(() => {
    logScreen('rewards_screen', {
      checkin_days: visitDates.length,
      streak: getConsecutiveStreak(visitDates),
    });
    if (appendedTodayRef.current) {
      logClick('rewards_checkin_click', { day_count: visitDates.length });
    }
  }, []);
  const [claimed10Cycles, setClaimed10Cycles] = useState(() => (
    parseInt(localStorage.getItem(CHECKIN10_CYCLES_KEY) || '0', 10)
  ));
  const [claimed30, setClaimed30] = useState(() => localStorage.getItem(CHECKIN30_CLAIMED_KEY) === 'true');
  const [toast, setToast] = useState({ show: false, message: '' });

  // ─── 10일 체크인 계산 ───────────────────────────────────
  const raw10 = visitDates.length - claimed10Cycles * 10;
  const progress10 = Math.min(Math.max(raw10, 0), 10);
  const canClaim10 = progress10 >= 10;

  // ─── 30일 체크인 계산 ───────────────────────────────────
  const progress30 = Math.min(visitDates.length, 30);
  const canClaim30 = progress30 >= 30 && !claimed30;

  // ─── 토스트 ─────────────────────────────────────────────
  const showToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  // ─── 수령 핸들러 ─────────────────────────────────────────
  const handleClaim30 = async () => {
    if (!canClaim30) return;
    logClick('rewards_claim_adfree');
    localStorage.setItem(CHECKIN30_CLAIMED_KEY, 'true');
    setClaimed30(true);
    try {
      await api.claimAdFree();
      showToast('광고를 영구 제거했어요');
    } catch {
      showToast('광고를 영구 제거했어요');
    }
  };

  const handleClaim10 = async () => {
    if (!canClaim10) return;
    logClick('rewards_claim_slot');
    const next = claimed10Cycles + 1;
    localStorage.setItem(CHECKIN10_CYCLES_KEY, String(next));
    setClaimed10Cycles(next);
    try {
      const data = await api.purchaseSlot();
      // AuthContext + 캐시 즉시 동기화 → AlarmListPage 초기값이 새 값으로 뜸
      if (data?.user) {
        setUser(data.user);
        localStorage.setItem('love_alarm_cached_maxSlots', String(data.user.maxSlots));
      }
      showToast('알람 슬롯 1개를 받았어요');
    } catch {
      showToast('알람 슬롯 1개를 받았어요');
    }
  };

  // ─── DEV bypass ─────────────────────────────────────────
  const devResetSlotClaim = () => {
    localStorage.setItem(CHECKIN10_CYCLES_KEY, '0');
    localStorage.setItem(VISIT_DATES_KEY, JSON.stringify(
      Array.from({ length: 10 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
      })
    ));
    window.location.reload();
  };

  const devResetAdFree = () => {
    localStorage.removeItem(CHECKIN30_CLAIMED_KEY);
    localStorage.setItem(VISIT_DATES_KEY, JSON.stringify(
      Array.from({ length: 30 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
      })
    ));
    window.location.reload();
  };

  return (
    <div className="rewards-page-container">
      <Spacing size={14} />

      <div className="rewards-top-section">
        <Top
          title={
            <Top.TitleParagraph
              size={22}
              color={adaptive.grey900}
              style={{ fontSize: '22px' }}
            >
              보상
            </Top.TitleParagraph>
          }
        />
      </div>

      <Spacing size={20} />

      <List>
        {/* ── 10일 체크인 ── */}
        <ListRow
          left={
            <ListRow.AssetIcon
              shape="squircle"
              size="medium"
              url="https://static.toss.im/3d-emojis/u1F381-apng.png"
              backgroundColor="#f2f4f6"
            />
          }
          contents={
            <div className="checkin-contents">
              <p className="checkin-title">
                10일 체크인 보상
                <span className="checkin-repeat"> (반복 가능)</span>
              </p>
              <p className="checkin-sub">
                10일 방문마다 알람 슬롯 1개 추가
              </p>
              <span className="checkin-badge">({canClaim10 ? 10 : progress10}/10)</span>
            </div>
          }
          right={
            <Button size="small" disabled={!canClaim10} onClick={handleClaim10}>
              받기
            </Button>
          }
          leftAlignment="top"
          rightAlignment="top"
          verticalPadding="large"
          horizontalPadding="medium"
        />

        {/* ── 30일 체크인 ── */}
        <ListRow
          left={
            <ListRow.AssetIcon
              shape="squircle"
              size="medium"
              url="https://static.toss.im/3d-emojis/u1F381-apng.png"
              backgroundColor="#f2f4f6"
            />
          }
          contents={
            <div className="checkin-contents">
              <p className="checkin-title">30일 체크인 보상</p>
              <p className="checkin-sub">
                {claimed30 ? '광고가 영구 제거됐어요' : '30일 방문 시 광고 영구 제거'}
              </p>
              <span className="checkin-badge">({claimed30 || canClaim30 ? 30 : progress30}/30)</span>
            </div>
          }
          right={
            <Button size="small" disabled={!canClaim30 || claimed30} onClick={handleClaim30}>
              {claimed30 ? '완료' : '받기'}
            </Button>
          }
          leftAlignment="top"
          rightAlignment="top"
          verticalPadding="large"
          horizontalPadding="medium"
        />
      </List>

      {/* 토스트 */}
      <div className={`single-toast ${toast.show ? 'show' : ''}`}>
        <div className="custom-toast-content">
          <span className="custom-toast-icon">✓</span>
          <span className="custom-toast-text">{toast.message}</span>
        </div>
      </div>

      {/* DEV: 보상 bypass 버튼 */}
      {IS_DEV && (
        <div className="dev-bypass">
          <p className="dev-bypass-label">DEV bypass</p>
          <button className="dev-bypass-btn" onClick={devResetSlotClaim}>
            🎯 10일 달성 상태로 리셋 (슬롯 받기 테스트)
          </button>
          <button className="dev-bypass-btn" onClick={devResetAdFree}>
            🎯 30일 달성 상태로 리셋 (광고 제거 테스트)
          </button>
        </div>
      )}
    </div>
  );
}
