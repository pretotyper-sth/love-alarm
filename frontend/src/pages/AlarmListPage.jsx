import { useState, useEffect, useRef } from 'react';
import {
  Asset,
  Text,
  Top,
  ListRow,
  Spacing,
  Button,
} from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
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

export function AlarmListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [alarms, setAlarms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState([]); // 토스트 스택
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [maxSlots, setMaxSlots] = useState(2); // 기본 슬롯 2개
  const [isPurchasing, setIsPurchasing] = useState(false);
  const alarmRefsRef = useRef([]);
  const toastIdRef = useRef(0);

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

  // 알람 목록 로드
  useEffect(() => {
    loadAlarms();
  }, []);

  // WebSocket 이벤트 리스너 (실시간 업데이트)
  useEffect(() => {
    // 매칭 성공 이벤트
    api.onMatched((data) => {
      console.log('🎉 실시간 매칭 알림:', data);
      loadAlarms(); // 목록 새로고침 (아이콘으로 구별)
    });

    // 연결 해제 이벤트
    api.onMatchCanceled((data) => {
      console.log('💔 실시간 연결 해제:', data);
      addToast({
        type: 'remove',
        message: '상대와의 연결이 끊겼어요.',
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

  // 알람 추가 후 Toast 표시
  const toastShownRef = useRef(false);
  
  useEffect(() => {
    if (location.state?.showAddedToast && !toastShownRef.current) {
      toastShownRef.current = true;
      addToast({
        type: 'success',
        message: '알람을 추가했어요.',
        duration: 3000,
      });
      window.history.replaceState({}, document.title);
    }
  }, []);

  const loadAlarms = async () => {
    try {
      setIsLoading(true);
      // 알람 목록과 사용자 정보(maxSlots) 동시 로드
      const [fetchedAlarms, userData] = await Promise.all([
        api.getAlarms(),
        api.getUser(),
      ]);
      setAlarms(fetchedAlarms);
      setMaxSlots(userData.maxSlots || 2);
      // ref 배열 초기화
      alarmRefsRef.current = [];
    } catch (error) {
      console.warn('백엔드 연결 실패, localStorage 사용:', error.message);
      // 백엔드 실패 시 localStorage에서 로드 (테스트용)
      const localAlarms = JSON.parse(localStorage.getItem('love_alarm_alarms') || '[]');
      const localMaxSlots = parseInt(localStorage.getItem('love_alarm_max_slots') || '2');
      setAlarms(localAlarms);
      setMaxSlots(localMaxSlots);
      alarmRefsRef.current = [];
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAlarm = () => {
    // 현재 알람 수가 최대 슬롯에 도달하면 결제 팝업 표시
    if (alarms.length >= maxSlots) {
      setShowPaymentSheet(true);
      return;
    }
    navigate('/add-alarm');
  };

  // 슬롯 구매 처리
  const handlePurchaseSlot = async () => {
    // TODO: 실제 결제 연동 시 api.purchaseSlot() 호출
    // 현재는 테스트용으로 바로 슬롯 증가
    const newMaxSlots = maxSlots + 1;
    setMaxSlots(newMaxSlots);
    localStorage.setItem('love_alarm_max_slots', String(newMaxSlots));
    setShowPaymentSheet(false);
    navigate('/add-alarm');
  };

  const handleMatchedClick = (alarm) => {
    navigate('/match-success', { state: { alarmId: alarm.id, targetInstagramId: alarm.targetInstagramId } });
  };

  const handleRemoveAlarm = async (id) => {
    // 삭제 전에 알람과 위치 저장 (되돌리기용)
    const alarmIndex = alarms.findIndex(alarm => alarm.id === id);
    const alarmToRemove = alarms[alarmIndex];
    
    // UI 업데이트
    const newAlarms = alarms.filter(alarm => alarm.id !== id);
    setAlarms(newAlarms);
    // localStorage 업데이트
    localStorage.setItem('love_alarm_alarms', JSON.stringify(newAlarms));
    
    // 제거 Toast 표시 (되돌리기 버튼 포함)
    const toastId = addToast({
      type: 'remove',
      message: '알람을 제거했어요.',
      duration: 5000,
      undoAction: () => {
        removeToast(toastId);
        // 되돌리기: 원래 위치에 삽입
        setAlarms(prev => {
          const restored = [...prev];
          restored.splice(alarmIndex, 0, alarmToRemove);
          localStorage.setItem('love_alarm_alarms', JSON.stringify(restored));
          return restored;
        });
      },
    });
    
    // 백엔드 삭제 시도 (실패해도 무시 - 로컬 테스트용)
    try {
      await api.deleteAlarm(id);
    } catch (error) {
      console.warn('백엔드 삭제 실패 (무시):', error.message);
    }
  };

  return (
    <div className="alarm-list-page-container">
      {/* Quick_Navigation - 상단 네비게이션 바 */}
      <div className="quick-navigation">
        {/* Left Container */}
        <div className="nav-left-container">
          {/* Back Button */}
          <button
            className="nav-back-button"
            onClick={() => navigate(-1)}
            aria-label="뒤로가기"
          >
            <Asset.Icon
              frameShape={Asset.frameShape.CleanW24}
              backgroundColor="transparent"
              name="icon-arrow-back-ios-mono"
              color={adaptive.grey900}
              aria-hidden={true}
              ratio="1/1"
            />
          </button>
          {/* Title Area */}
          <div className="nav-title-area">
            <div className="nav-title-content">
              <Asset.Image
                frameShape={Asset.frameShape.CleanW16}
                backgroundColor="transparent"
                src="https://static.toss.im/appsintoss/9737/f6aa6697-d258-40c2-a59f-91f8e8bab8be.png"
                aria-hidden={true}
                style={{ aspectRatio: '1/1' }}
              />
              <Text color={adaptive.grey900} typography="t6" fontWeight="semibold">
                좋아하면 울리는
              </Text>
            </div>
          </div>
        </div>
        {/* Right Container */}
        <div className="nav-right-container">
          {/* Dynamic Icon Area */}
          <div className="nav-dynamic-icon-area">
            <button className="nav-icon-button" aria-label="하트">
              <Asset.Icon
                frameShape={Asset.frameShape.CleanW20}
                backgroundColor="transparent"
                name="icon-heart-mono"
                color={adaptive.greyOpacity600}
                aria-hidden={true}
                ratio="1/1"
              />
            </button>
          </div>
          {/* Fixed Icon Area */}
          <div className="nav-fixed-icon-area">
            <button className="nav-icon-button" aria-label="더보기">
              <Asset.Icon
                frameShape={Asset.frameShape.CleanW20}
                backgroundColor="transparent"
                name="icon-dots-mono"
                color={adaptive.greyOpacity600}
                aria-hidden={true}
                ratio="1/1"
              />
            </button>
            <div className="nav-divider"></div>
            <button className="nav-icon-button" aria-label="닫기">
              <Asset.Icon
                frameShape={Asset.frameShape.CleanW20}
                backgroundColor="transparent"
                name="icon-x-mono"
                color={adaptive.greyOpacity600}
                aria-hidden={true}
                ratio="1/1"
              />
            </button>
          </div>
        </div>
      </div>

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

        {/* 알람 목록 - 로딩 완료 후에만 표시 (알람 없으면 빈 상태) */}
        {!isLoading && alarms.map((alarm, index) => (
          <AlarmItem 
            key={alarm.id} 
            alarm={alarm}
            onRemove={handleRemoveAlarm}
            onMatchedClick={handleMatchedClick}
            listRowRef={(el) => { alarmRefsRef.current[index] = el; }}
          />
        ))}
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

      {/* 알람 슬롯 결제 BottomSheet */}
      {showPaymentSheet && (
        <>
          <div className="payment-sheet-overlay" onClick={() => setShowPaymentSheet(false)} />
          <div className="payment-sheet-container">
            <div className="payment-sheet-handle" />
            <div className="payment-sheet-content">
              <h3 className="payment-sheet-title">결제하기</h3>
              <p className="payment-sheet-description">
                소중한 인연을 놓치지 않도록,<br />
                알람 슬롯을 하나 더 추가해보세요.<br />
                구매한 슬롯은 영구적으로 누적돼요.
              </p>
            </div>
            <div className="payment-sheet-cta">
              <Button
                size="xlarge"
                display="block"
                onClick={handlePurchaseSlot}
                disabled={isPurchasing}
                loading={isPurchasing}
              >
                알람 슬롯 추가하기 (1,000원)
              </Button>
              <Spacing size={8} />
              <Button
                size="xlarge"
                display="block"
                color="dark"
                variant="weak"
                onClick={() => setShowPaymentSheet(false)}
                disabled={isPurchasing}
                style={{
                  '--button-background-color': '#f2f4f6',
                  '--button-color': '#6b7684',
                }}
              >
                나중에 하기
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

