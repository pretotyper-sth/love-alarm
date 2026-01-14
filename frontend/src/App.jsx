import { useEffect, useState, useCallback, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Button } from '@toss/tds-mobile';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { IntroPage } from './pages/IntroPage';
import { AlarmListPage } from './pages/AlarmListPage';
import { AddAlarmPage } from './pages/AddAlarmPage';
import { AbuseWarningPage } from './pages/AbuseWarningPage';
import { MatchSuccessPage } from './pages/MatchSuccessPage';
import { SettingsPage } from './pages/SettingsPage';
import { FeedbackPage } from './pages/FeedbackPage';
import { ErrorPage } from './pages/ErrorPage';
import { storage } from './utils/storage';
import './App.css';

// 앱 종료 처리
const exitApp = async () => {
  try {
    const { closeView } = await import('@apps-in-toss/web-framework');
    await closeView();
  } catch {
    // SDK 미지원 환경
  }
};

// 종료 확인 다이얼로그 (알림 설정과 동일한 스타일 - 가로 2버튼)
function ExitConfirmModal({ onClose, onConfirm }) {
  return (
    <>
      <div className="exit-modal-overlay show" onClick={onClose} />
      <div className="exit-modal-container show" onClick={(e) => e.stopPropagation()}>
        <div className="exit-modal-header">
          <h3 className="exit-modal-title">좋아하면 울리는을 종료할까요?</h3>
        </div>
        
        <div className="exit-modal-cta-double">
          <Button
            size="large"
            color="dark"
            variant="weak"
            onClick={onClose}
            style={{
              flex: 1,
              '--button-background-color': '#f2f4f6',
              '--button-color': '#6b7684',
            }}
          >
            취소
          </Button>
          <Button
            size="large"
            onClick={onConfirm}
            style={{ flex: 1 }}
          >
            종료하기
          </Button>
        </div>
      </div>
    </>
  );
}

// 히스토리 가드 설정 (앱 시작 시 한 번만)
function setupHistoryGuard() {
  if (sessionStorage.getItem('history_guard_set')) return;
  sessionStorage.setItem('history_guard_set', 'true');
  
  // 현재 상태를 가드로 설정하고, 새 상태 추가
  // [가드] → [현재페이지]
  window.history.replaceState({ isExitGuard: true, index: 0 }, '');
  window.history.pushState({ index: 1 }, '');
}

// 네비게이션 추적 컴포넌트 (히스토리 가드 설정)
function NavigationTracker() {
  const location = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setupHistoryGuard();
    }
  }, []);

  return null;
}

// 라우팅 컴포넌트 (AuthProvider 안에서 useAuth 사용 가능)
function AppRoutes() {
  const { loading } = useAuth();
  
  // 첫 방문 여부 - 초기값은 스토리지에서 바로 읽음 (빈 화면 방지)
  const [hasVisited, setHasVisited] = useState(() => storage.get('has_visited_intro'));
  
  // 종료 확인 다이얼로그 상태
  const [showExitModal, setShowExitModal] = useState(false);

  // 온보딩 완료 처리 (IntroPage에서 호출)
  const markAsVisited = useCallback(() => {
    storage.set('has_visited_intro', true);
    setHasVisited(true);
  }, []);

  // 🔑 loading 완료 후 스토리지 다시 체크 (연결 해제 시 storage.remove 반영)
  useEffect(() => {
    if (!loading) {
      // loading 완료 후 스토리지 값 다시 확인 (AuthContext에서 변경되었을 수 있음)
      setHasVisited(storage.get('has_visited_intro'));
    }
  }, [loading]);

  // storage 변경 감지 (런타임 중 변경 시)
  useEffect(() => {
    const checkStorage = () => {
      const currentValue = storage.get('has_visited_intro');
      setHasVisited(currentValue);
    };
    
    // storage 이벤트 리스너 (다른 탭에서 변경 시)
    window.addEventListener('storage', checkStorage);
    
    // 주기적으로 체크 (같은 탭에서 변경 시)
    const interval = setInterval(checkStorage, 500);
    
    return () => {
      window.removeEventListener('storage', checkStorage);
      clearInterval(interval);
    };
  }, []);

  // 백버튼 이벤트: 토스 앱에서는 backEvent, 브라우저에서는 popstate
  useEffect(() => {
    let cleanup = () => {};
    
    // popstate 이벤트 핸들러 (가드 상태 감지)
    const handlePopState = (e) => {
      // 가드 상태에 도달 → 종료 모달 표시
      if (e.state?.isExitGuard) {
        setShowExitModal(true);
        // 가드에서 앞으로 다시 이동 (다이얼로그 닫으면 현재 페이지 유지)
        window.history.forward();
      }
      // 그 외의 경우는 정상 네비게이션 (종료 모달 X)
    };
    
    window.addEventListener('popstate', handlePopState);
    
    const setupBackEvent = async () => {
      try {
        const { graniteEvent } = await import('@apps-in-toss/web-framework');
        
        cleanup = graniteEvent.addEventListener('backEvent', {
          onEvent: () => {
            // /alarms 또는 / 에서 백버튼 → 바로 종료 모달
            const currentPath = window.location.pathname;
            if (currentPath === '/alarms' || currentPath === '/') {
              setShowExitModal(true);
            } else {
              // 다른 페이지에서는 뒤로가기 실행
              window.history.back();
            }
          },
          onError: () => {
            // 에러 무시
          },
        });
      } catch {
        // SDK 미지원 환경 (브라우저) - popstate로만 처리
      }
    };
    
    setupBackEvent();
    
    return () => {
      cleanup();
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // 로딩 중에는 빈 화면 (로그인 과정에서 알람 목록이 잠깐 보이는 문제 방지)
  if (loading) {
    return null;
  }

  return (
    <>
      <BrowserRouter>
        <NavigationTracker />
        <Routes>
          <Route
            path="/"
            element={
              hasVisited ? (
                <Navigate to="/alarms" replace />
              ) : (
                <IntroPage onComplete={markAsVisited} />
              )
            }
          />
          {/* 인트로 미완료 시 모든 페이지에서 인트로로 리다이렉트 */}
          <Route 
            path="/alarms" 
            element={hasVisited ? <AlarmListPage /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/abuse-warning" 
            element={hasVisited ? <AbuseWarningPage /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/add-alarm" 
            element={hasVisited ? <AddAlarmPage /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/match-success" 
            element={hasVisited ? <MatchSuccessPage /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/settings" 
            element={hasVisited ? <SettingsPage /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/feedback" 
            element={hasVisited ? <FeedbackPage /> : <Navigate to="/" replace />} 
          />
          <Route path="/error" element={<ErrorPage />} />
        </Routes>
      </BrowserRouter>
      
      {/* 종료 확인 다이얼로그 */}
      {showExitModal && (
        <ExitConfirmModal
          onClose={() => setShowExitModal(false)}
          onConfirm={exitApp}
        />
      )}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
