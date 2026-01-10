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

// 네비게이션 깊이 추적 컴포넌트
function NavigationTracker() {
  const location = useLocation();
  const prevLocationRef = useRef(location);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // 첫 렌더링 시 깊이 초기화
    if (isFirstRender.current) {
      isFirstRender.current = false;
      sessionStorage.setItem('nav_depth', '0');
      return;
    }

    // location.key가 바뀌면 새 페이지로 이동한 것
    if (prevLocationRef.current.key !== location.key) {
      const currentDepth = parseInt(sessionStorage.getItem('nav_depth') || '0');
      sessionStorage.setItem('nav_depth', String(currentDepth + 1));
    }
    prevLocationRef.current = location;
  }, [location]);

  return null;
}

// 라우팅 컴포넌트 (AuthProvider 안에서 useAuth 사용 가능)
function AppRoutes() {
  const { loading } = useAuth();
  
  // 첫 방문 여부 - loading 완료 전까지는 null (판단 보류)
  const [hasVisited, setHasVisited] = useState(null);
  
  // 종료 확인 다이얼로그 상태
  const [showExitModal, setShowExitModal] = useState(false);

  // 온보딩 완료 처리 (IntroPage에서 호출)
  const markAsVisited = useCallback(() => {
    storage.set('has_visited_intro', true);
    setHasVisited(true);
  }, []);

  // 🔑 핵심: loading이 완료된 후에 스토리지를 체크
  // AuthContext에서 연결 해제 시 storage.remove가 호출된 후 체크됨
  useEffect(() => {
    if (!loading) {
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

  // 백버튼 이벤트: 첫 페이지면 종료 확인 다이얼로그, 아니면 뒤로가기
  useEffect(() => {
    let cleanup = () => {};
    
    const setupBackEvent = async () => {
      try {
        const { graniteEvent } = await import('@apps-in-toss/web-framework');
        
        cleanup = graniteEvent.addEventListener('backEvent', {
          onEvent: () => {
            const currentDepth = parseInt(sessionStorage.getItem('nav_depth') || '0');
            
            if (currentDepth <= 0) {
              // 첫 페이지에서 백버튼 → 종료 확인 다이얼로그 표시
              setShowExitModal(true);
            } else {
              // 다른 페이지에서는 뒤로가기
              sessionStorage.setItem('nav_depth', String(currentDepth - 1));
              window.history.back();
            }
          },
          onError: () => {
            // 에러 무시
          },
        });
      } catch {
        // SDK 미지원 환경 (브라우저) - 무시
      }
    };
    
    setupBackEvent();
    
    return () => cleanup();
  }, []);

  // 로딩 중이거나 hasVisited 판단 전에는 빈 화면
  if (loading || hasVisited === null) {
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
