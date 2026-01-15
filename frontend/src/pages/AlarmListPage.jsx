import { useState, useEffect, useRef } from 'react';
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
import { hasConfirmedAbuseWarning } from './AbuseWarningPage';
import { PaymentModal } from '../components/PaymentModal';
import './AlarmListPage.css';

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
  const alarmRefsRef = useRef([]);
  const addButtonRef = useRef(null); // 추가하기 버튼 ref
  const toastIdRef = useRef(0);
  const notificationSheetShownRef = useRef(false);
  // 토스트 추가 함수
  const addToast = (toast) => {
    const id = ++toastIdRef.current;
    const newToast = { ...toast, id, show: true };
    setToasts(prev => [...prev, newToast]);
    
    // 자동 삭제 타이머
    setTimeout(() => {
      removeToast(id);
    }, toast.duration || 3000);
    
    return id;
  };

  // 토스트 제거 함수
  const removeToast = (id) => {
    setToasts(prev => prev.map(t => 
      t.id === id ? { ...t, show: false } : t
    ));
    // 애니메이션 후 완전히 제거
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
  };

  // user가 있을 때 알람 목록 + maxSlots 동시 로드
  useEffect(() => {
    if (user) {
      // maxSlots 즉시 설정
      if (user.maxSlots) {
        setMaxSlots(user.maxSlots);
      }
      // 알람 목록 로드
      loadAlarms();
    }
  }, [user]);

  // WebSocket 이벤트 리스너 (실시간 업데이트)
  useEffect(() => {
    // 매칭 성공 이벤트
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
  }, []);

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
  }, []);

  // 알림 동의하기 클릭
  const handleNotificationAgree = async () => {
    try {
      // 알림 설정 켜기 (API 호출)
      const updatedUser = await api.updateSettings({ 
        pushEnabled: true, 
        tossAppEnabled: true 
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

  const loadAlarms = async (showLoading = true) => {
    try {
      // 캐시가 없을 때만 로딩 표시 (최초 방문)
      const hasCache = localStorage.getItem('love_alarm_cached_list') !== null;
      if (showLoading && !hasCache) {
        setIsLoading(true);
      }
      
      const fetchedAlarms = await api.getAlarms();
      setAlarms(fetchedAlarms);
      
      // 캐시 저장 (다음 방문 시 즉시 표시용)
      localStorage.setItem('love_alarm_cached_list', JSON.stringify(fetchedAlarms));
      localStorage.setItem('love_alarm_last_count', fetchedAlarms.length.toString());
      setLastAlarmCount(fetchedAlarms.length);
      
      // 서버에서 최신 user 정보 가져와서 maxSlots 업데이트
      try {
        const latestUser = await api.getUser();
        if (latestUser?.maxSlots) {
          setMaxSlots(latestUser.maxSlots);
          // maxSlots도 캐시
          localStorage.setItem('love_alarm_cached_maxSlots', latestUser.maxSlots.toString());
        }
      } catch (userError) {
        console.error('사용자 정보 조회 실패:', userError);
      }
      
      // ref 배열 초기화
      alarmRefsRef.current = [];
    } catch (error) {
      console.error('알람 목록 조회 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAlarm = () => {
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
    navigate('/match-success', { state: { alarmId: alarm.id, targetInstagramId: alarm.targetInstagramId } });
  };

  const handleRemoveAlarm = async (id) => {
    // 삭제 전에 알람과 위치 저장 (되돌리기용 & 롤백용)
    const alarmIndex = alarms.findIndex(alarm => alarm.id === id);
    const alarmToRemove = alarms[alarmIndex];
    const previousAlarms = [...alarms];
    
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
          const result = await api.createAlarm(alarmToRemove.fromInstagramId, alarmToRemove.targetInstagramId);
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
        message: '알람 삭제에 실패했어요',
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
        <div className="settings-button-wrapper">
          <Button color="dark" variant="fill" size="small" onClick={() => navigate('/settings')}>
            설정
          </Button>
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
              top={`추가하기 (${alarms.length}/${maxSlots})`}
              topProps={{ color: '#4e5968' }}
            />
          }
          verticalPadding="large"
          horizontalPadding="medium"
          onClick={handleAddAlarm}
        />

        {/* 초기 로딩 중 스켈레톤 - 이전 알람 개수만큼 표시 */}
        {isLoading && lastAlarmCount > 0 && (
          <Skeleton 
            custom={['listWithIcon']} 
            repeatLastItemCount={lastAlarmCount} 
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
      <div className="toast-stack">
        {toasts.map((toast, index) => (
          <div 
            key={toast.id} 
            className={`custom-toast ${toast.show ? 'show' : ''}`}
            style={{ 
              transform: `translateX(-50%) translateY(${toast.show ? -index * 60 : 20}px)`,
              zIndex: 9999 - index,
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

      {/* 알림 허용 BottomSheet */}
      <div className={`custom-bottom-sheet-overlay ${showNotificationSheet ? 'show' : ''}`} onClick={handleNotificationClose}>
        <div className={`custom-bottom-sheet ${showNotificationSheet ? 'show' : ''}`} onClick={(e) => e.stopPropagation()}>
          <div className="bottom-sheet-header">
            <h3 className="bottom-sheet-title">알림 받기</h3>
            <p className="bottom-sheet-description">알람이 추가됐어요.<br />상대 마음도 같다면 바로 알려드릴게요.</p>
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

