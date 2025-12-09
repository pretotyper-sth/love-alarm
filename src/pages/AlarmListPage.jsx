import { useState, useEffect } from 'react';
import { Button } from '@toss/tds-mobile';
import { useNavigate } from 'react-router-dom';
import { alarmService } from '../utils/alarm';
import './AlarmListPage.css';

export function AlarmListPage() {
  const navigate = useNavigate();
  const [alarms, setAlarms] = useState([]);

  useEffect(() => {
    loadAlarms();
    // 매칭 확인
    const hasNewMatch = alarmService.checkAllMatchings();
    if (hasNewMatch) {
      loadAlarms();
      // 매칭 성공 화면으로 이동
      navigate('/match-success');
    }
  }, [navigate]);

  const loadAlarms = () => {
    const allAlarms = alarmService.getAllAlarms();
    setAlarms(allAlarms);
  };

  const handleAddAlarm = () => {
    navigate('/add-alarm');
  };

  const handleRemoveAlarm = (id) => {
    alarmService.removeAlarm(id);
    loadAlarms();
  };

  return (
    <div className="alarm-list-page">
      <div className="alarm-list-header">
        <h1 className="alarm-list-title">알람 목록 {alarms.length}</h1>
      </div>

      <div className="alarm-list-content">
        <Button onClick={handleAddAlarm} className="add-button">
          + 추가하기
        </Button>

        <div className="alarm-list">
          {alarms.length === 0 ? (
            <div className="empty-state">
              <p>등록된 알람이 없어요.</p>
              <p className="empty-hint">알람을 추가해보세요!</p>
            </div>
          ) : (
            alarms.map((alarm) => (
              <div key={alarm.id} className="alarm-item">
                <div className="alarm-icon">
                  {alarm.matched ? '❤️' : '🔔'}
                </div>
                <div className="alarm-info">
                  <div className="alarm-target">@{alarm.targetId}</div>
                  <div className="alarm-from">From: @{alarm.myId}</div>
                </div>
                <Button
                  onClick={() => handleRemoveAlarm(alarm.id)}
                  className="remove-button"
                >
                  제거
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

