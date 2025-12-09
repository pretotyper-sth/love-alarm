import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { IntroPage } from './pages/IntroPage';
import { AlarmListPage } from './pages/AlarmListPage';
import { AddAlarmPage } from './pages/AddAlarmPage';
import { MatchSuccessPage } from './pages/MatchSuccessPage';
import { storage } from './utils/storage';
import './App.css';

function App() {
  // 첫 방문 여부 확인
  const hasVisited = storage.get('has_visited_intro');

  return (
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
        <Route path="/add-alarm" element={<AddAlarmPage />} />
        <Route path="/match-success" element={<MatchSuccessPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
