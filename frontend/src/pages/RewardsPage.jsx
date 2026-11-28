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
import { InstagramAuthSheet } from '../components/InstagramAuthSheet';
import { ALARM_REWARDS } from '../../../backend/src/config/alarmRewards.js';
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
  const [toast, setToast] = useState({ show: false, message: '' });
  const [reward, setReward] = useState(null);
  const [rewardBusy, setRewardBusy] = useState(false);
  const [showRewardAuth, setShowRewardAuth] = useState(false);
  const rewardLock = useRef(false);
  const currentReward = reward?.userId === user?.id ? reward : null;
  const [checkin, setCheckin] = useState(null);
  const [checkinBusy, setCheckinBusy] = useState(false);
  const checkinLock = useRef(false);
  const currentCheckin = checkin?.userId === user?.id ? checkin : null;
  const [alarmRewards, setAlarmRewards] = useState(null);
  const [alarmRewardBusy, setAlarmRewardBusy] = useState(null);
  const alarmRewardLock = useRef(false);
  const currentAlarmRewards = alarmRewards?.userId === user?.id ? alarmRewards : null;

  useEffect(() => {
    if (!user) return;
    let active = true;
    api.getAlarmRewards().then(result => { if (active) setAlarmRewards({ ...result, userId: user.id }); })
      .catch(() => { if (active) setAlarmRewards({ error: true, userId: user.id }); });
    return () => { active = false; };
  }, [user]);

  const handleClaimAlarmReward = async missionId => {
    if (alarmRewardLock.current) return;
    alarmRewardLock.current = true; setAlarmRewardBusy(missionId);
    try {
      const result = currentAlarmRewards?.error ? await api.getAlarmRewards() : await api.claimAlarmReward(missionId);
      setAlarmRewards({ ...result, userId: api.getCurrentUser().id });
      if ('alreadyGranted' in result) {
        logClick('rewards_claim_alarm_pass_success', { type: missionId, pass_balance: result.balance });
        showToast(result.alreadyGranted ? '이미 받은 보상이에요' : '메시지 열람권 1장을 받았어요');
      }
    } catch (error) { showToast(error.message || '보상을 받지 못했어요. 다시 시도해 주세요.'); }
    finally { alarmRewardLock.current = false; setAlarmRewardBusy(null); }
  };

  useEffect(() => {
    if (!user) return;
    let active = true;
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      api.checkinMessagePass().then(result => { if (active) setCheckin({ ...result, userId: user.id }); })
        .catch(() => { if (active) setCheckin({ error: true, userId: user.id }); });
    };
    refresh();
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; document.removeEventListener('visibilitychange', refresh); };
  }, [user]);

  const handleClaimCheckin = async () => {
    if (checkinLock.current) return;
    checkinLock.current = true; setCheckinBusy(true);
    try {
      const result = currentCheckin?.error ? await api.checkinMessagePass() : await api.claimCheckinPass();
      setCheckin({ ...result, userId: api.getCurrentUser().id });
      if (result.granted) {
        logClick('rewards_claim_checkin_pass_success', { pass_balance: result.balance, day_count: result.days });
        showToast('메시지 열람권 1장을 받았어요');
      }
    } catch (error) { showToast(error.message || '보상을 받지 못했어요. 다시 시도해 주세요.'); }
    finally { checkinLock.current = false; setCheckinBusy(false); }
  };

  useEffect(() => {
    if (!user) return;
    let active = true;
    api.getInstagramReward().then(result => { if (active) setReward({ ...result, userId: user.id }); }).catch(() => {});
    return () => { active = false; };
  }, [user]);

  const handleClaimPass = async () => {
    if (rewardLock.current) return;
    rewardLock.current = true;
    setRewardBusy(true);
    try {
      if (!await requireLogin('보상을 받으려면 로그인이 필요해요')) return;
      const status = await api.getInstagramReward();
      if (!status.claimed && !status.verified) { setShowRewardAuth(true); return; }
      logClick('rewards_claim_pass_start');
      const result = await api.claimInstagramReward();
      setReward({ ...result, userId: api.getCurrentUser().id });
      logClick('rewards_claim_pass_success', { pass_balance: result.balance });
      showToast(result.alreadyGranted ? '이미 받은 보상이에요' : '메시지 열람권 1장을 받았어요');
    } catch (error) {
      logClick('rewards_claim_pass_fail');
      showToast(error.message || '보상을 받지 못했어요. 다시 시도해 주세요.');
    } finally { rewardLock.current = false; setRewardBusy(false); }
  };

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
    if (!canClaim30 || !await requireLogin('보상을 받으려면 로그인이 필요해요')) return;
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
    if (!canClaim10 || !await requireLogin('보상을 받으려면 로그인이 필요해요')) return;
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
        <ListRow
          left={<ListRow.AssetIcon shape="squircle" size="medium" url="https://static.toss.im/3d-emojis/u1F381-apng.png" backgroundColor="#f2f4f6" />}
          contents={
            <div className="checkin-contents">
              <p className="checkin-title">메시지 열람권 1장</p>
              <p className="checkin-sub">인스타그램 첫 인증 완료 시</p>
              <span className="checkin-badge">토스 계정당 1회</span>
            </div>
          }
          right={
            <Button size="small" disabled={!!currentReward?.claimed || rewardBusy} loading={rewardBusy} onClick={handleClaimPass}>
              {currentReward?.claimed ? '완료' : currentReward?.verified ? '받기' : '인증하고 받기'}
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
            right={<Button size="small" disabled={alarmRewardBusy !== null || (!status?.canClaim && !currentAlarmRewards?.error)} loading={alarmRewardBusy === mission.id} onClick={() => handleClaimAlarmReward(mission.id)}>{currentAlarmRewards?.error ? '다시 시도' : status?.claimed ? '완료' : '받기'}</Button>}
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
          right={<Button size="small" disabled={checkinBusy || (!currentCheckin?.canClaim && !currentCheckin?.error)} loading={checkinBusy} onClick={handleClaimCheckin}>{currentCheckin?.error ? '다시 시도' : '받기'}</Button>}
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

      <InstagramAuthSheet open={showRewardAuth} onClose={() => setShowRewardAuth(false)} onSuccess={() => {
        setShowRewardAuth(false);
        void handleClaimPass();
      }} />

      {/* 토스트 */}
      <div className={`single-toast ${toast.show ? 'show' : ''}`}>
        <div className="custom-toast-content">
          <span className="custom-toast-icon">✓</span>
          <span className="custom-toast-text">{toast.message}</span>
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
