import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Top,
  ListRow,
  Spacing,
  Button,
  Skeleton,
} from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { hasConfirmedAbuseWarning } from '../utils/abuseWarning';
import {
  countUnreadReceivedMessages,
  loadUnreadMessageBadgeEnabled,
} from '../utils/messages';
import { PaymentModal } from '../components/PaymentModal';
import { LikeCountSheet } from '../components/LikeCountSheet';
import { logScreen, logClick, logImpression } from '../utils/analytics';
import './AlarmListPage.css';

const LIKE_COUNT_TARGET_KEY = 'love_alarm_like_count_target';
const LIKE_COUNT_RESULT_KEY = 'love_alarm_like_count_result';
const LIKE_COUNT_CHECKED_AT_KEY = 'love_alarm_like_count_checked_at';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12시간
const IG_VERIFIED_KEY = 'love_alarm_instagram_verified_username';
const MSG_BADGE_COUNT_KEY = 'love_alarm_msg_badge_count';
const ALARM_LIST_TOAST_BOTTOM_PX = 50;

function getLikeCountCache() {
  const target = localStorage.getItem(LIKE_COUNT_TARGET_KEY);
  const result = localStorage.getItem(LIKE_COUNT_RESULT_KEY);
  const checkedAt = localStorage.getItem(LIKE_COUNT_CHECKED_AT_KEY);
  if (!target || result === null || !checkedAt) return { target: target || null, count: null };
  const isValid = Date.now() - new Date(checkedAt).getTime() < CACHE_TTL_MS;
  return { target, count: isValid ? parseInt(result, 10) : null };
}

// 바에 표시할 ID — 최대 13자, 초과 시 말줄임
function truncateId(id, max = 13) {
  if (!id) return '?';
  return id.length > max ? id.slice(0, max) + '…' : id;
}

// 한국어 조사 자동 판별 (을/를, 이/가, 은/는 등)
function getParticle(text, withBatchim, withoutBatchim) {
  if (!text) return withoutBatchim;
  const cleaned = text.replace(/[^a-zA-Z0-9가-힣]/g, '');
  if (!cleaned) return withBatchim;
  const last = cleaned[cleaned.length - 1];
  const code = last.charCodeAt(0);
  if (code >= 0xAC00 && code <= 0xD7A3) {
    return (code - 0xAC00) % 28 !== 0 ? withBatchim : withoutBatchim;
  }
  if (/[0-9]/.test(last)) {
    return '013678'.includes(last) ? withBatchim : withoutBatchim;
  }
  return 'lmnr'.includes(last.toLowerCase()) ? withBatchim : withoutBatchim;
}

// 알람 아이템 컴포넌트
function AlarmItem({ alarm, onRemove, onMatchedClick, listRowRef }) {
  // 매칭 여부에 따른 색상 (백엔드: status = 'waiting' | 'matched')
  const isMatched = alarm.status === 'matched';
  const matchedColor = '#f04452'; // 빨간색
  const normalTopColor = '#4e5968';
  const normalBottomColor = '#6b7684';

  // 아이콘 URL
  const matchedIconUrl = 'https://static.toss.im/icons/png/4x/icon-letter-heart.png';
  const normalIconUrl = 'https://static.toss.im/icons/png/4x/icon-clock-heart-blue.png';

  // 매칭된 경우에만 클릭 핸들러 설정
  const handleClick = isMatched ? () => onMatchedClick(alarm) : undefined;

  return (
    <ListRow
      ref={listRowRef}
      onClick={handleClick}
      left={
        <ListRow.AssetIcon
          shape="squircle"
          size="medium"
          url={isMatched ? matchedIconUrl : normalIconUrl}
          backgroundColor={isMatched ? "rgba(2, 32, 71, 0.05)" : "#f2f4f6"}
        />
      }
      contents={
        <ListRow.Texts
          type="2RowTypeB"
          top={`@${alarm.targetInstagramId}`}
          topProps={{ 
            color: isMatched ? matchedColor : normalTopColor, 
            fontWeight: 'bold' 
          }}
          bottom={alarm.fromInstagramId ? `From: @${alarm.fromInstagramId}` : ''}
          bottomProps={{ 
            color: isMatched ? matchedColor : normalBottomColor 
          }}
        />
      }
      right={
        <div className="alarm-button-group">
          <button
            className="alarm-remove-button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(alarm.id);
            }}
          >
            제거
          </button>
          {isMatched && (
            <button
              className="alarm-confirm-button"
              onClick={(e) => {
                e.stopPropagation();
                onMatchedClick(alarm);
              }}
            >
              확인
            </button>
          )}
        </div>
      }
      verticalPadding="large"
      horizontalPadding="medium"
    />
  );
}

// localStorage에서 캐시된 알람 목록 불러오기 (null = 캐시 없음)
const getCachedAlarms = () => {
  try {
    const cached = localStorage.getItem('love_alarm_cached_list');
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

// localStorage에서 캐시된 maxSlots 불러오기
const getCachedMaxSlots = () => {
  try {
    const cached = localStorage.getItem('love_alarm_cached_maxSlots');
    return cached ? parseInt(cached, 10) : 2;
  } catch {
    return 2;
  }
};

export function AlarmListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useAuth();
  const hasEverRegistered = localStorage.getItem('love_alarm_first_registered') === 'true';
  // 캐시된 알람 목록으로 초기화 (깜빡임 방지)
  const [alarms, setAlarms] = useState(() => getCachedAlarms() || []);
  // 캐시가 존재하면(빈 배열이어도) 로딩 표시 안 함, 캐시 없으면 로딩
  const [isLoading, setIsLoading] = useState(() => getCachedAlarms() === null);
  const [isRestoring, setIsRestoring] = useState(false); // 되돌리기 중 상태
  const [lastAlarmCount, setLastAlarmCount] = useState(() => {
    // 이전에 저장된 알람 개수 불러오기 (초기 로딩 스켈레톤용)
    const saved = localStorage.getItem('love_alarm_last_count');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [toasts, setToasts] = useState([]); // 토스트 스택
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showNotificationSheet, setShowNotificationSheet] = useState(false);
  // 캐시된 maxSlots 또는 user.maxSlots로 초기화
  const [maxSlots, setMaxSlots] = useState(() => user?.maxSlots || getCachedMaxSlots());

  // 좋아하는 사람 수 확인 상태
  const [showLikeCountSheet, setShowLikeCountSheet] = useState(false);
  const [likeCountCache, setLikeCountCache] = useState(() => getLikeCountCache());
  // 메시지 배지 카운트
  const [msgBadgeCount, setMsgBadgeCount] = useState(() => {
    const cached = localStorage.getItem(MSG_BADGE_COUNT_KEY);
    return cached ? parseInt(cached, 10) : 0;
  });
  const [unreadMessageBadgeEnabled, setUnreadMessageBadgeEnabled] = useState(() => loadUnreadMessageBadgeEnabled());
  const alarmRefsRef = useRef([]);
  const addButtonRef = useRef(null); // 추가하기 버튼 ref
  const toastIdRef = useRef(0);
  const notificationSheetShownRef = useRef(false);
  const alarmListScreenLoggedRef = useRef(false);

  // 토스트 제거 함수
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.map(t => 
      t.id === id ? { ...t, show: false } : t
    ));
    // 애니메이션 후 완전히 제거
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
  }, []);

  // 토스트 추가 함수
  const addToast = useCallback((toast) => {
    const id = ++toastIdRef.current;
    const newToast = { ...toast, id, show: true };
    setToasts(prev => [...prev, newToast]);
    
    setTimeout(() => {
      removeToast(id);
    }, toast.duration || 3000);
    
    return id;
  }, [removeToast]);

  // user가 있을 때 알람 목록 + maxSlots 동시 로드
  const loadAlarms = useCallback(async (showLoading = true) => {
    try {
      const hasCache = localStorage.getItem('love_alarm_cached_list') !== null;
      if (showLoading && !hasCache) {
        setIsLoading(true);
      }

      // ─── 목업 모드 (로컬 테스트용) ───────────────────────────
      if (localStorage.getItem('__mock_alarms__') === 'true') {
        const mock = JSON.parse(localStorage.getItem('love_alarm_cached_list') || '[]');
        setAlarms(mock);
        setIsLoading(false);
        return;
      }
      // ────────────────────────────────────────────────────────

      const userPromise = api.getUser()
        .then((latestUser) => {
          if (latestUser?.maxSlots) {
            setMaxSlots(latestUser.maxSlots);
            localStorage.setItem('love_alarm_cached_maxSlots', latestUser.maxSlots.toString());
          }
        })
        .catch((userError) => {
          console.error('사용자 정보 조회 실패:', userError);
        });

      const fetchedAlarms = await api.getAlarms();
      setAlarms(fetchedAlarms);
      localStorage.setItem('love_alarm_cached_list', JSON.stringify(fetchedAlarms));
      localStorage.setItem('love_alarm_last_count', fetchedAlarms.length.toString());
      setLastAlarmCount(fetchedAlarms.length);
      alarmRefsRef.current = [];
      void userPromise;
    } catch (error) {
      console.error('알람 목록 조회 실패:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      if (user.maxSlots) {
        setMaxSlots(user.maxSlots);
      }
      loadAlarms();
    }
  }, [loadAlarms, user]);

  useEffect(() => {
    if (alarmListScreenLoggedRef.current || isLoading || !user) return;
    alarmListScreenLoggedRef.current = true;
    logScreen('alarm_list_screen', { alarm_count: alarms.length });
  }, [isLoading, user, alarms.length]);

  // 포그라운드 복귀 시 12h 이내면 좋아하는 사람 수 조용한 재조회
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;
      const cache = getLikeCountCache();
      if (!cache.target || cache.count === null) return;
      try {
        const { count } = await api.getLikeCount(cache.target);
        localStorage.setItem(LIKE_COUNT_RESULT_KEY, String(count));
        localStorage.setItem(LIKE_COUNT_CHECKED_AT_KEY, new Date().toISOString());
        setLikeCountCache({ target: cache.target, count });
      } catch { /* 조용히 실패 */ }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const IS_DEV = import.meta.env.DEV;
  const MOCK_RECEIVED_FOR_BADGE = IS_DEV ? [
    { id: 'mock-r1', fromInstagramId: null, message: '항상 밝게 웃으시는 게 좋아서 알람 보내봐요 😊', createdAt: '2026-04-09T20:15:00Z', reactions: [] },
  ] : [];

  // 메시지 배지 카운트 로드 (인증된 경우, 페이지 복귀마다 재계산)
  useEffect(() => {
    if (!user) return;
    const loadMsgBadge = async () => {
      const badgeEnabled = loadUnreadMessageBadgeEnabled();
      setUnreadMessageBadgeEnabled(badgeEnabled);

      const vid = localStorage.getItem(IG_VERIFIED_KEY);
      if (!vid && !IS_DEV) {
        setMsgBadgeCount(0);
        localStorage.setItem(MSG_BADGE_COUNT_KEY, '0');
        return;
      }
      try {
        let messages = [];
        if (vid) {
          try {
            messages = await api.getReceivedMessages(vid);
          } catch {
            messages = [];
          }
        }
        const allMessages = [...messages, ...MOCK_RECEIVED_FOR_BADGE];
        const count = countUnreadReceivedMessages(allMessages);
        setMsgBadgeCount(count);
        localStorage.setItem(MSG_BADGE_COUNT_KEY, String(count));
      } catch { /* 캐시값 유지 */ }
    };
    loadMsgBadge();
  }, [user]);

  // WebSocket 이벤트 리스너 (실시간 업데이트)
  useEffect(() => {
    api.onMatched(() => {
      loadAlarms(); // 목록 새로고침 (아이콘으로 구별)
    });

    // 연결 해제 이벤트
    api.onMatchCanceled(() => {
      addToast({
        type: 'remove',
        message: '상대와의 연결이 끊겼어요',
        duration: 3000,
      });
      loadAlarms(); // 목록 새로고침
    });

    return () => {
      api.offMatched();
      api.offMatchCanceled();
    };
  }, [addToast, loadAlarms]);

  // 모든 알람에 동시에 shine 효과 적용 (retry 로직 포함)
  useEffect(() => {
    if (alarms.length > 0) {
      let retryCount = 0;
      const maxRetries = 5;
      
      const applyShine = () => {
        const refs = alarmRefsRef.current.filter(ref => ref !== null);
        
        // 모든 ref가 준비되었는지 확인
        if (refs.length < alarms.length && retryCount < maxRetries) {
          retryCount++;
          setTimeout(applyShine, 100);
          return;
        }
        
        // 모든 알람에 동시에 shine 적용
        refs.forEach((ref) => {
          if (ref && ref.shine) {
            ref.shine(Infinity);
          }
        });
      };
      
      // 초기 딜레이 후 shine 적용 시작
      const timer = setTimeout(applyShine, 150);
      
      // 페이지 클릭 시 shine 다시 적용 (클릭으로 멈춘 경우 복구)
      const handlePageClick = () => {
        setTimeout(applyShine, 100);
      };
      document.addEventListener('click', handlePageClick);
      
      return () => {
        clearTimeout(timer);
        document.removeEventListener('click', handlePageClick);
      };
    }
  }, [alarms]);

  // 알람이 0개일 때 "추가하기" 버튼에 shine 효과 적용
  useEffect(() => {
    if (alarms.length === 0 && !isLoading) {
      const applyAddButtonShine = () => {
        if (addButtonRef.current && addButtonRef.current.shine) {
          addButtonRef.current.shine(Infinity);
        }
      };
      
      // 초기 딜레이 후 shine 적용
      const timer = setTimeout(applyAddButtonShine, 300);
      
      // 페이지 클릭 시 shine 다시 적용
      const handlePageClick = () => {
        setTimeout(applyAddButtonShine, 100);
      };
      document.addEventListener('click', handlePageClick);
      
      return () => {
        clearTimeout(timer);
        document.removeEventListener('click', handlePageClick);
      };
    }
  }, [alarms.length, isLoading]);

  // 알람 추가 후 Toast 표시
  const toastShownRef = useRef(false);
  
  useEffect(() => {
    if (location.state?.showAddedToast && !toastShownRef.current) {
      toastShownRef.current = true;
      addToast({
        type: 'success',
        message: '알람을 추가했어요',
        duration: 3000,
      });
    }
    
    // 알람 추가 후 알림 팝업 표시 (최초 알람일 경우)
    if (location.state?.showNotificationSheet && !notificationSheetShownRef.current) {
      notificationSheetShownRef.current = true;
      // 토스트가 먼저 보이고 나서 팝업 표시
      setTimeout(() => {
        setShowNotificationSheet(true);
      }, 500);
    }
    
    // state 정리
    if (location.state) {
      window.history.replaceState({}, document.title);
    }
  }, [addToast, location.state]);

  useEffect(() => {
    if (!showNotificationSheet) return;
    logImpression('notification_sheet_impression');
  }, [showNotificationSheet]);

  // 알림 동의하기 클릭
  const handleNotificationAgree = async () => {
    logClick('notification_sheet_allow_click');
    try {
      const updatedUser = await api.updateSettings({ 
        pushEnabled: true, 
        tossAppEnabled: true,
        messagePushEnabled: true,
        messageTossAppEnabled: true,
      });
      setUser(updatedUser);
    } catch (error) {
      console.error('Failed to update notification settings:', error);
    }
    setShowNotificationSheet(false);
  };

  // 알림 닫기 클릭 (동의 안 함)
  const handleNotificationClose = () => {
    setShowNotificationSheet(false);
  };

  const handleAddAlarm = () => {
    logClick('alarm_add_button_click', { slot_used: alarms.length, slot_max: user?.maxSlots });
    // 최초 추가 시 비정상적 사용 방지 페이지 표시
    if (!hasConfirmedAbuseWarning()) {
      navigate('/abuse-warning');
      return;
    }
    // 현재 알람 수가 최대 슬롯에 도달하면 결제 팝업 표시
    if (alarms.length >= maxSlots) {
      setShowPaymentModal(true);
      return;
    }
    navigate('/add-alarm');
  };

  // 결제 성공 시 슬롯 증가 처리
  const handlePaymentSuccess = async () => {
    try {
      // 백엔드에 슬롯 구매 기록 및 증가 요청
      const result = await api.purchaseSlot();
      setMaxSlots(result.newMaxSlots);
      setShowPaymentModal(false);
      // 결제 성공 후 알람 추가 페이지로 이동
      navigate('/add-alarm');
    } catch (error) {
      console.error('슬롯 증가 실패:', error);
      addToast({
        type: 'error',
        message: '처리 중 오류가 발생했어요',
        duration: 3000,
      });
    }
  };

  const handleMatchedClick = (alarm) => {
    logClick('alarm_matched_click', { alarm_id: alarm.id });
    navigate('/match-success', { 
      state: { 
        alarmId: alarm.id, 
        fromInstagramId: alarm.fromInstagramId,
        targetInstagramId: alarm.targetInstagramId,
      } 
    });
  };

  const handleRemoveAlarm = async (id) => {
    // 삭제 전에 알람과 위치 저장 (되돌리기용 & 롤백용)
    const alarmIndex = alarms.findIndex(alarm => alarm.id === id);
    const alarmToRemove = alarms[alarmIndex];
    const previousAlarms = [...alarms];
    if (alarmToRemove) {
      logClick('alarm_remove_click', { alarm_id: alarmToRemove.id, status: alarmToRemove.status });
    }

    // ✨ Optimistic UI: 서버 응답 전에 UI 먼저 업데이트
    setAlarms(prev => prev.filter(alarm => alarm.id !== id));
    
    // 제거 Toast 표시 (되돌리기 버튼 포함)
    const toastId = addToast({
      type: 'remove',
      message: '알람을 제거했어요',
      duration: 5000,
      undoAction: async () => {
        // 버튼 클릭 즉시 토스트 제거 (중복 클릭 방지)
        removeToast(toastId);
        setIsRestoring(true); // 스켈레톤 표시
        try {
          // 새로 생성하고 결과로 받은 새 ID로 목록 갱신 (fromInstagramId 포함)
          const result = await api.createAlarm(
            alarmToRemove.fromInstagramId,
            alarmToRemove.targetInstagramId,
            alarmToRemove.message
          );
          // API 응답의 matched 여부를 알람 status에 반영
          const restoredAlarm = {
            ...result.alarm,
            status: result.matched ? 'matched' : result.alarm.status,
          };
          // 원래 위치에 삽입
          setAlarms(prev => {
            const newAlarms = [...prev];
            newAlarms.splice(alarmIndex, 0, restoredAlarm);
            return newAlarms;
          });
        } catch (error) {
          console.error('되돌리기 실패:', error);
        } finally {
          setIsRestoring(false); // 스켈레톤 숨김
        }
      },
    });
    
    try {
      await api.deleteAlarm(id);
      // ✅ 성공: Optimistic UI 유지 (깜빡임 방지)
    } catch (error) {
      console.error('알람 삭제 실패:', error);
      // ❌ 실패 시 롤백: 원래 상태로 되돌림
      setAlarms(previousAlarms);
      addToast({
        type: 'error',
        message: '알람을 삭제하지 못했어요',
        duration: 3000,
      });
    }
  };

  return (
    <div className="alarm-list-page-container">
      <Spacing size={14} />

      <div className="alarm-list-top-section">
        <Top
          title={
            <Top.TitleParagraph 
              size={22} 
              color={adaptive.grey900}
              style={{ fontSize: '22px' }}
            >
              알람 목록
            </Top.TitleParagraph>
          }
        />
        <div className="alarm-list-msg-wrapper">
          <button
            className="alarm-list-msg-btn"
            onClick={() => {
              logClick('message_icon_click', { badge_count: msgBadgeCount });
              navigate('/messages');
            }}
            aria-label="메시지 확인"
          >
            <img
              src="https://static.toss.im/2d-emojis/png/4x/u1F48C.png"
              alt=""
              className="alarm-list-msg-toss-icon"
              width={24}
              height={24}
              draggable={false}
            />
            {unreadMessageBadgeEnabled && msgBadgeCount > 0 && (
              <span className="alarm-list-msg-badge alarm-list-msg-badge--dot" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <Spacing size={16} />

      <div className="alarm-list-content">
        {/* 추가하기 ListRow */}
        <ListRow
          ref={addButtonRef}
          left={
            <ListRow.AssetIcon
              name="icon-plus-grey-fill"
              variant="fill"
            />
          }
          contents={
            <ListRow.Texts
              type="1RowTypeA"
              top={`알람 추가하기 (${alarms.length}/${maxSlots})`}
              topProps={{ color: '#4e5968' }}
            />
          }
          verticalPadding="large"
          horizontalPadding="medium"
          onClick={handleAddAlarm}
        />

        {/* 초기 사용 안내 힌트 — 한 번도 알람을 만든 적 없고 현재 알람 0개일 때만 노출 */}
        {!hasEverRegistered && !isLoading && alarms.length === 0 && (
          <p className="alarm-list-first-hint">
            좋아하는 사람의 ID를 추가해 보세요.<br />
            서로 좋아하면 알람이 울려요.
          </p>
        )}

        {/* 초기 로딩 중 스켈레톤 - 이전 알람 개수만큼 표시 */}
        {isLoading && lastAlarmCount > 0 && (
          <Skeleton 
            custom={['listWithIcon']} 
            repeatLastItemCount={lastAlarmCount} 
          />
        )}

        {isLoading && lastAlarmCount === 0 && (
          <Skeleton 
            custom={['listWithIcon']} 
            repeatLastItemCount={3} 
          />
        )}

        {/* 알람 목록 */}
        {!isLoading && alarms.map((alarm, index) => (
          <AlarmItem 
            key={alarm.id} 
            alarm={alarm}
            onRemove={handleRemoveAlarm}
            onMatchedClick={handleMatchedClick}
            listRowRef={(el) => { alarmRefsRef.current[index] = el; }}
          />
        ))}

        {/* 되돌리기 중 스켈레톤 - 1줄만 표시 */}
        {isRestoring && (
          <Skeleton 
            custom={['listWithIcon']} 
            repeatLastItemCount={1} 
          />
        )}

      </div>

      {/* 토스트 스택 */}
      <div className="toast-stack alarm-list-toast-stack">
        {toasts.map((toast, index) => (
          <div 
            key={toast.id} 
            className={`custom-toast ${toast.show ? 'show' : ''}`}
            style={{ 
              transform: `translateX(-50%) translateY(${toast.show ? -index * 60 : 20}px)`,
              zIndex: 9999 - index,
              bottom: `calc(${ALARM_LIST_TOAST_BOTTOM_PX + (toast.bottomOffset ?? 0)}px + env(safe-area-inset-bottom, 0px))`,
            }}
          >
            <div className="custom-toast-content">
              {toast.type === 'success' && (
                <span className="custom-toast-icon">✓</span>
              )}
              {toast.type === 'error' && (
                <span className="custom-toast-error-icon">!</span>
              )}
              <span className="custom-toast-text">{toast.message}</span>
              {toast.undoAction && (
                <button 
                  className="toast-undo-button" 
                  onClick={toast.undoAction}
                >
                  되돌리기
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 결제 모달 */}
      {showPaymentModal && (
        <PaymentModal
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* 좋아하는 사람 수 확인 고정 바 */}
      <div className="like-count-bar" onClick={() => {
        logClick('like_count_bar_click');
        setShowLikeCountSheet(true);
      }}>
        <span className="like-count-bar-text">
          지금{' '}
          <strong className="like-count-bar-highlight">
            {likeCountCache.target ? truncateId(likeCountCache.target) : '?'}
          </strong>
          {' '}{getParticle(likeCountCache.target, '을', '를')} 좋아하는 사람{' '}
          <strong className="like-count-bar-highlight">
            {likeCountCache.count !== null ? likeCountCache.count : '?'}
          </strong>
          {' '}명
        </span>
        <span className="like-count-bar-cta">
          <img
            src="https://static.toss.im/icons/png/4x/icon-arrow-right-mono.png"
            alt=""
            style={{ width: '20px', height: '20px', filter: 'invert(40%) sepia(98%) saturate(600%) hue-rotate(196deg) brightness(100%) contrast(95%)' }}
          />
        </span>
      </div>

      {/* 좋아하는 사람 수 확인 시트 */}
      <LikeCountSheet
        open={showLikeCountSheet}
        onClose={() => setShowLikeCountSheet(false)}
        onResult={({ targetId, count }) => {
          setLikeCountCache({ target: targetId, count });
          addToast({
            type: 'success',
            message: '결과를 불러왔어요 (12시간 노출 유지)',
            duration: 4000,
          });
        }}
      />

      {/* 알림 허용 BottomSheet */}
      <div className={`custom-bottom-sheet-overlay ${showNotificationSheet ? 'show' : ''}`} onClick={handleNotificationClose}>
        <div className={`custom-bottom-sheet ${showNotificationSheet ? 'show' : ''}`} onClick={(e) => e.stopPropagation()}>
          <div className="bottom-sheet-header">
            <h3 className="bottom-sheet-title">알림 받기</h3>
            <p className="bottom-sheet-description">알람이 추가됐어요.<br />연결 소식이나 메시지가 오면 바로 알려드릴게요.</p>
          </div>
          <div className="bottom-sheet-content">
            <img 
              src="https://static.toss.im/3d-emojis/u1F514-apng.png" 
              alt="알림" 
              className="bottom-sheet-image"
            />
          </div>
          <div className="bottom-sheet-cta bottom-sheet-cta-double">
            <Button
              size="large"
              display="block"
              color="dark"
              variant="weak"
              onClick={handleNotificationClose}
              style={{
                '--button-background-color': '#f2f4f6',
                '--button-color': '#6b7684',
                flex: 1,
              }}
            >
              나중에 하기
            </Button>
            <Button
              size="large"
              display="block"
              onClick={handleNotificationAgree}
              style={{ flex: 1 }}
            >
              동의하기
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

