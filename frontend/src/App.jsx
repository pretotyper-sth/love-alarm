import { useEffect, useState, useCallback, useRef } from 'react';
import { BrowserRouter, MemoryRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@toss/tds-mobile';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { IntroPage } from './pages/IntroPage';
import { AlarmListPage } from './pages/AlarmListPage';
import { AddAlarmPage } from './pages/AddAlarmPage';
import { AbuseWarningPage } from './pages/AbuseWarningPage';
import { MatchSuccessPage } from './pages/MatchSuccessPage';
import { SettingsPage } from './pages/SettingsPage';
import { NotificationSettingsPage } from './pages/NotificationSettingsPage';
import { RewardsPage } from './pages/RewardsPage';
import { FeedbackPage } from './pages/FeedbackPage';
import { ErrorPage } from './pages/ErrorPage';
import { MessagesPage } from './pages/MessagesPage';
import { BottomNav } from './components/BottomNav';
import { storage } from './utils/storage';
import { api } from './utils/api';
import './App.css';
import { insideToss, isExitRoot, backDismissStack, useBackDismiss, useBackDismissCount, subscribeNativeBack } from './utils/backNavigation';

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
  const dialog = useRef(null);
  const cancel = useRef(null);
  useBackDismiss(true, onClose);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancel.current?.focus({ preventScroll: true });
    const blockScroll = event => { if (!dialog.current?.contains(event.target)) event.preventDefault(); };
    document.addEventListener('touchmove', blockScroll, { passive: false });
    document.addEventListener('wheel', blockScroll, { passive: false });
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('touchmove', blockScroll);
      document.removeEventListener('wheel', blockScroll);
      previous?.focus?.({ preventScroll: true });
    };
  }, []);
  return (
    <>
      <div className="exit-modal-overlay show" onClick={onClose} />
      <div ref={dialog} className="exit-modal-container show" role="dialog" aria-modal="true" aria-labelledby="exit-modal-title" onClick={(e) => e.stopPropagation()} onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
        if (event.key === 'Tab') {
          const buttons = dialog.current.querySelectorAll('button');
          if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[1].focus(); }
          else if (!event.shiftKey && document.activeElement === buttons[1]) { event.preventDefault(); buttons[0].focus(); }
        }
      }}>
        <div className="exit-modal-header">
          <h3 id="exit-modal-title" className="exit-modal-title">좋아하면 울리는을 종료할까요?</h3>
        </div>
        
        <div className="exit-modal-cta-double">
          <Button
            size="large"
            color="dark"
            variant="weak"
            ref={cancel}
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
  if (insideToss()) return;
  if (sessionStorage.getItem('history_guard_set')) return;
  sessionStorage.setItem('history_guard_set', 'true');
  
  // 현재 상태를 가드로 설정하고, 새 상태 추가
  // [가드] → [현재페이지]
  window.history.replaceState({ isExitGuard: true, index: 0 }, '');
  window.history.pushState({ index: 1 }, '');
}

const TAB_PATHS = ['/alarms', '/rewards', '/more'];

// 네비게이션 추적 컴포넌트 (히스토리 가드 설정)
function NavigationTracker() {
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setupHistoryGuard();
    }
  }, []);

  return null;
}

// Memory routes keep Toss at its native root, including after returning from a child page.
function AppRouter({ children }) {
  return insideToss()
    ? <MemoryRouter initialEntries={[window.location.pathname + window.location.search]}>{children}</MemoryRouter>
    : <BrowserRouter>{children}</BrowserRouter>;
}

function NativeBackNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const hasOverlay = useBackDismissCount() > 0;
  useEffect(() => {
    if (!insideToss() || (isExitRoot(location.pathname) && !hasOverlay)) return;
    let disposed = false;
    let off = () => {};
    void import('@apps-in-toss/web-framework').then(({ graniteEvent }) => {
      if (disposed) return;
      off = subscribeNativeBack({ graniteEvent, path: location.pathname, hasOverlay, onBack: () => {
        if (backDismissStack.dismiss()) return;
        if (TAB_PATHS.includes(location.pathname) || location.key === 'default') navigate('/alarms', { replace: true });
        else navigate(-1);
      } });
    }).catch(() => {});
    return () => { disposed = true; off(); };
  }, [location.pathname, location.key, navigate, hasOverlay]);
  return null;
}

// 탭 레이아웃: 하단 네비 조건부 표시
function TabLayout({ children }) {
  const location = useLocation();
  const showNav = TAB_PATHS.includes(location.pathname);
  return (
    <>
      {children}
      {showNav && <BottomNav />}
    </>
  );
}

// 라우팅 컴포넌트 (AuthProvider 안에서 useAuth 사용 가능)
function AppRoutes() {
  const { user, logout } = useAuth();
  useEffect(() => {
    if (!user) return;
    const checkin = () => { if (document.visibilityState === 'visible') void api.checkinMessagePass().catch(() => {}); };
    checkin();
    document.addEventListener('visibilitychange', checkin);
    return () => document.removeEventListener('visibilitychange', checkin);
  }, [user]);
  
  // 첫 방문 여부 - 초기값은 스토리지에서 바로 읽음 (빈 화면 방지)
  const [hasVisited, setHasVisited] = useState(() => storage.get('has_visited_intro'));
  
  // 종료 확인 다이얼로그 상태
  const [showExitModal, setShowExitModal] = useState(false);

  // 온보딩 완료 처리 (IntroPage에서 호출)
  const markAsVisited = useCallback(() => {
    storage.set('has_visited_intro', true);
    setHasVisited(true);
  }, []);

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

  useEffect(() => {
    if (insideToss()) return;
    const handlePopState = event => {
      if (!event.state?.isExitGuard) return;
      if (!backDismissStack.dismiss()) setShowExitModal(true);
      window.history.forward();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <>
      {api.isPreview && <div className="preview-status"><span>로컬 미리보기 · {user ? '로그인됨' : '로그인 없이 둘러보기'}</span>
        {user && <button onClick={logout}>가상 로그아웃</button>}</div>}
      <AppRouter>
        <NavigationTracker />
        <NativeBackNavigation />
        <TabLayout>
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
              element={hasVisited ? <AlarmListPage key={user?.id || 'guest'} /> : <Navigate to="/" replace />}
            />
            <Route 
              path="/rewards" 
              element={hasVisited ? <RewardsPage key={user?.id || 'guest'} /> : <Navigate to="/" replace />}
            />
            <Route 
              path="/more" 
              element={hasVisited ? <SettingsPage /> : <Navigate to="/" replace />} 
            />
            <Route 
              path="/settings" 
              element={<Navigate to="/more" replace />} 
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
              path="/notification-settings" 
              element={hasVisited ? <NotificationSettingsPage /> : <Navigate to="/" replace />} 
            />
            <Route 
              path="/feedback" 
              element={hasVisited ? <FeedbackPage /> : <Navigate to="/" replace />} 
            />
            <Route 
              path="/messages" 
              element={hasVisited ? <MessagesPage key={user?.id || 'guest'} /> : <Navigate to="/" replace />}
            />
            <Route path="/error" element={<ErrorPage />} />
          </Routes>
        </TabLayout>
      </AppRouter>
      
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
