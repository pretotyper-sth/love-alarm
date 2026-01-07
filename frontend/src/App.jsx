import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
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

function App() {
  // 첫 방문 여부 확인
  const hasVisited = storage.get('has_visited_intro');

  // 앱 종료 처리 (백버튼 시 바로 종료)
  const handleExitApp = async () => {
    try {
      const { closeView } = await import('@apps-in-toss/web-framework');
      await closeView();
    } catch {
      // SDK 미지원 환경
    }
  };

  // 앱 최초 진입 시 백버튼으로 앱 종료 처리 (검수 필수 요건)
  useEffect(() => {
    // 세션 내 한 번만 가드 추가
    if (sessionStorage.getItem('exit_guard_added')) return;
    sessionStorage.setItem('exit_guard_added', 'true');

    // 히스토리 가드 추가: [가드] -> [현재페이지]
    const guardState = { isExitGuard: true };
    window.history.replaceState(guardState, '');
    window.history.pushState({}, '');

    const handlePopState = (e) => {
      // 가드 상태로 돌아왔으면 바로 앱 종료
      if (e.state?.isExitGuard) {
        handleExitApp();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              hasVisited ? (
                <Navigate to="/alarms" replace />
              ) : (
                <IntroPage />
              )
            }
          />
          <Route 
            path="/alarms" 
            element={hasVisited ? <AlarmListPage /> : <Navigate to="/" replace />} 
          />
          <Route path="/abuse-warning" element={<AbuseWarningPage />} />
          <Route path="/add-alarm" element={<AddAlarmPage />} />
          <Route path="/match-success" element={<MatchSuccessPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/error" element={<ErrorPage />} />
        </Routes>
      </BrowserRouter>

    </AuthProvider>
  );
}

export default App;
