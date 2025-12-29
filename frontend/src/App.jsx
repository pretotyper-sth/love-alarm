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
import { ApiTestPage } from './pages/ApiTestPage';
import { storage } from './utils/storage';
import './App.css';

function App() {
  // 첫 방문 여부 확인
  const hasVisited = storage.get('has_visited_intro');

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
          <Route path="/alarms" element={<AlarmListPage />} />
          <Route path="/abuse-warning" element={<AbuseWarningPage />} />
          <Route path="/add-alarm" element={<AddAlarmPage />} />
          <Route path="/match-success" element={<MatchSuccessPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/error" element={<ErrorPage />} />
          <Route path="/api-test" element={<ApiTestPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
