import { PageHeader } from '../components/PageHeader';
import { useState, useEffect } from 'react';
import {
  List,
  ListRow,
  Button,
  Spacing,
} from '@toss/tds-mobile';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { logScreen, logClick } from '../utils/analytics';
import { InstagramAuthSheet } from '../components/InstagramAuthSheet';
import { ALARM_REWARDS } from '../../../backend/src/config/alarmRewards.js';
import './RewardsPage.css';
import { createRewardQueue } from '../utils/rewardQueue';
import { useAccountData } from '../utils/useAccountData';

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
  const { user, setUser, requireLogin } = useAuth();
  const [{ dates: visitDates, appendedToday }] = useState(() => {
    if (!user) return { dates: [], appendedToday: false };
    const dates = loadVisitDates();
    const today = getTodayStr();
    const appendedToday = !dates.includes(today);
    return { dates: appendedToday ? [...dates, today] : dates, appendedToday };
  });

  useEffect(() => {
    logScreen('rewards_screen', {
      checkin_days: visitDates.length,
      streak: getConsecutiveStreak(visitDates),
    });
    if (appendedToday) {
      localStorage.setItem(VISIT_DATES_KEY, JSON.stringify(visitDates));
      logClick('rewards_checkin_click', { day_count: visitDates.length });
    }
  }, [visitDates, appendedToday]);
  const [claimed10Cycles, setClaimed10Cycles] = useState(() => (
    user ? parseInt(localStorage.getItem(CHECKIN10_CYCLES_KEY) || '0', 10) : 0
  ));
  const [claimed30, setClaimed30] = useState(() => !!user && localStorage.getItem(CHECKIN30_CLAIMED_KEY) === 'true');
  const [toasts, setToasts] = useState([]);
  const toast = toasts[0];
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToasts(items => items.slice(1)), 2500);
    return () => clearTimeout(timer);
  }, [toast]);
  const [pendingClaims, setPendingClaims] = useState([]);
  const [rewardQueue] = useState(() => createRewardQueue(setPendingClaims));
  const enqueueClaim = (key, action) => {
    const owner = api.getCurrentUser()?.id;
    logClick('rewards_claim_queue', { source: key.replace(':', '_') });
    return rewardQueue.enqueue(key, async () => {
      if (owner && api.getCurrentUser()?.id !== owner) return;
      try { await action(); }
      catch (error) { logClick('rewards_claim_fail', { source: key.replace(':', '_') }); showToast(error.message || '보상을 받지 못했어요. 다시 시도해 주세요.', true); }
    });
  };
  const pending = key => pendingClaims.includes(key);
  const processing = key => pendingClaims[0] === key;
  const [showRewardAuth, setShowRewardAuth] = useState(false);
  const account = useAccountData();
  const snapshot = account?.userId === user?.id ? account : null;
  const currentReward = snapshot?.instagram || (snapshot?.error ? { error: true } : null);
  const currentCheckin = snapshot?.checkin || (snapshot?.error ? { error: true } : null);
  const currentAlarmRewards = snapshot?.alarms || (snapshot?.error ? { error: true } : null);

  useEffect(() => {
    if (!user?.id) return;
    const refresh = () => {
      if (document.visibilityState === 'visible') void api.getRewardSummary().catch(() => {});
    };
    refresh();
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, [user?.id]);

  const handleClaimAlarmReward = missionId => enqueueClaim(`alarm:${missionId}`, async () => {
    if (currentAlarmRewards?.error) { await api.getRewardSummary({ force: true }); return; }
    logClick('rewards_claim_alarm_pass_start', { type: missionId });
    const result = await api.claimAlarmReward(missionId);
    if ('alreadyGranted' in result) {
      logClick('rewards_claim_alarm_pass_success', { type: missionId, pass_balance: result.balance });
      showToast(result.alreadyGranted ? '이미 받은 보상이에요' : `${missionId === 'first_alarm' ? '첫 알람 보상' : '알람 3명 보상'} · 메시지 열람권 1장`);
    }
  });

  const handleClaimCheckin = () => enqueueClaim('checkin', async () => {
    if (currentCheckin?.error) { await api.getRewardSummary({ force: true }); return; }
    logClick('rewards_claim_checkin_pass_start');
    const result = await api.claimCheckinPass();
    if (result.granted) {
      logClick('rewards_claim_checkin_pass_success', { pass_balance: result.balance, day_count: result.days });
      showToast('출석 보상 · 메시지 열람권 1장');
    }
  });

  const handleClaimPass = verifiedNow => enqueueClaim('instagram', async () => {
    if (!await requireLogin('보상을 받으려면 로그인이 필요해요')) return;
    if (currentReward?.error) { await api.getRewardSummary({ force: true }); return; }
    const status = verifiedNow === true ? { verified: true } : currentReward || (await api.getRewardSummary())?.instagram;
    if (!status) throw new Error('보상 정보를 확인하지 못했어요. 다시 시도해 주세요.');
    if (!status.claimed && !status.verified) { setShowRewardAuth(true); return; }
    logClick('rewards_claim_pass_start');
    const result = await api.claimInstagramReward();
    logClick('rewards_claim_pass_success', { pass_balance: result.balance });
    showToast(result.alreadyGranted ? '이미 받은 보상이에요' : '인증 보상 · 메시지 열람권 1장');
  });

  // ─── 10일 체크인 계산 ───────────────────────────────────
  const raw10 = visitDates.length - claimed10Cycles * 10;
  const progress10 = Math.min(Math.max(raw10, 0), 10);
  const canClaim10 = progress10 >= 10;

  // ─── 30일 체크인 계산 ───────────────────────────────────
  const progress30 = Math.min(visitDates.length, 30);
  const canClaim30 = progress30 >= 30 && !claimed30;

  const showToast = (message, isError = false) => {
    setToasts(items => [...items, { id: crypto.randomUUID(), message, isError }]);
  };

  const handleClaim30 = () => enqueueClaim('adfree', async () => {
    if (!canClaim30 || !await requireLogin('보상을 받으려면 로그인이 필요해요')) return;
    logClick('rewards_claim_adfree');
    const result = await api.claimAdFree();
    localStorage.setItem(CHECKIN30_CLAIMED_KEY, 'true');
    setClaimed30(true);
    if (result?.user) setUser(result.user);
    showToast('광고를 영구 제거했어요');
  });

  const handleClaim10 = () => enqueueClaim('slot', async () => {
    if (!canClaim10 || !await requireLogin('보상을 받으려면 로그인이 필요해요')) return;
    logClick('rewards_claim_slot');
    const data = await api.purchaseSlot();
    const next = claimed10Cycles + 1;
    localStorage.setItem(CHECKIN10_CYCLES_KEY, String(next));
    setClaimed10Cycles(next);
    if (data?.user) {
      setUser(data.user);
      localStorage.setItem('love_alarm_cached_maxSlots', String(data.user.maxSlots));
    }
    showToast('알람 슬롯 1개를 받았어요');
  });

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
      <div className="rewards-top-section">
        <PageHeader title="보상" />
      </div>

      <Spacing size={20} />

      <List>
        <ListRow
          left={<ListRow.AssetIcon shape="squircle" size="medium" url="https://static.toss.im/3d-emojis/u1F381-apng.png" backgroundColor="#f2f4f6" />}
          contents={
            <div className="checkin-contents">
              <p className="checkin-title">메시지 열람권 1장</p>
              <p className="checkin-sub">인스타그램 첫 인증 완료 시</p>
              <span className="checkin-badge">계정당 1회</span>
            </div>
          }
          right={
            <Button size="small" disabled={!!currentReward?.claimed || pending('instagram') || (!!user && !currentReward)} loading={processing('instagram')} onClick={handleClaimPass}>
              {pending('instagram') && !processing('instagram') ? '대기 중' : user && !currentReward ? '확인 중' : currentReward?.error ? '다시 시도' : currentReward?.claimed ? '완료' : currentReward?.verified ? '받기' : '인증하고 받기'}
            </Button>
          }
          leftAlignment="top" rightAlignment="top" verticalPadding="large" horizontalPadding="medium"
        />
        {ALARM_REWARDS.map(mission => {
          const status = currentAlarmRewards?.rewards?.find(item => item.id === mission.id);
          return <ListRow key={mission.id}
            left={<ListRow.AssetIcon shape="squircle" size="medium" url="https://static.toss.im/3d-emojis/u1F381-apng.png" backgroundColor="#f2f4f6" />}
            contents={<div className="checkin-contents">
              <p className="checkin-title">{mission.title}</p>
              <p className="checkin-sub">{mission.goal === 1 ? '첫 알람 등록 시 메시지 열람권 1장' : '3명 등록 시 메시지 열람권 1장'}</p>
              <span className="checkin-badge">{currentAlarmRewards?.error ? '등록 횟수를 불러오지 못했어요' : user && !currentAlarmRewards ? '등록 확인 중' : `(${status?.progress || 0}/${mission.goal}) · 계정당 1회`}</span>
            </div>}
            right={<Button size="small" disabled={pending(`alarm:${mission.id}`) || (!status?.canClaim && !currentAlarmRewards?.error)} loading={processing(`alarm:${mission.id}`)} onClick={() => handleClaimAlarmReward(mission.id)}>{pending(`alarm:${mission.id}`) && !processing(`alarm:${mission.id}`) ? '대기 중' : currentAlarmRewards?.error ? '다시 시도' : status?.claimed ? '완료' : '받기'}</Button>}
            leftAlignment="top" rightAlignment="top" verticalPadding="large" horizontalPadding="medium"
          />;
        })}
        <ListRow
          left={<ListRow.AssetIcon shape="squircle" size="medium" url="https://static.toss.im/3d-emojis/u1F381-apng.png" backgroundColor="#f2f4f6" />}
          contents={
            <div className="checkin-contents">
              <p className="checkin-title">3일 출석 보상<span className="checkin-repeat"> (반복 가능)</span></p>
              <p className="checkin-sub">3일 방문마다 메시지 열람권 1장</p>
              <span className="checkin-badge">{currentCheckin?.error ? '출석을 불러오지 못했어요' : user && !currentCheckin ? '출석 확인 중' : `(${currentCheckin?.progress || 0}/3)`}</span>
            </div>
          }
          right={<Button size="small" disabled={pending('checkin') || (!currentCheckin?.canClaim && !currentCheckin?.error)} loading={processing('checkin')} onClick={handleClaimCheckin}>{pending('checkin') && !processing('checkin') ? '대기 중' : currentCheckin?.error ? '다시 시도' : '받기'}</Button>}
          leftAlignment="top" rightAlignment="top" verticalPadding="large" horizontalPadding="medium"
        />
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
            <Button size="small" disabled={!canClaim10 || pending('slot')} loading={processing('slot')} onClick={handleClaim10}>
              {pending('slot') && !processing('slot') ? '대기 중' : '받기'}
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
            <Button size="small" disabled={!canClaim30 || claimed30 || pending('adfree')} loading={processing('adfree')} onClick={handleClaim30}>
              {pending('adfree') && !processing('adfree') ? '대기 중' : claimed30 ? '완료' : '받기'}
            </Button>
          }
          leftAlignment="top"
          rightAlignment="top"
          verticalPadding="large"
          horizontalPadding="medium"
        />
      </List>

      <InstagramAuthSheet open={showRewardAuth} onClose={() => setShowRewardAuth(false)} onSuccess={() => {
        setShowRewardAuth(false);
        void handleClaimPass(true);
      }} />

      {/* 토스트 */}
      <div key={toast?.id} role="status" aria-live="polite" className={`single-toast ${toast ? 'show' : ''}`}>
        <div className="custom-toast-content">
          <span className="custom-toast-icon">{toast?.isError ? '!' : '✓'}</span>
          <span className="custom-toast-text">{toast?.message}</span>
        </div>
      </div>

      {/* DEV: 보상 bypass 버튼 */}
      {IS_DEV && !api.isPreview && (
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
