import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import './ApiTestPage.css';

/**
 * API 테스트 페이지
 * 백엔드 API가 잘 동작하는지 테스트할 수 있습니다.
 */
export function ApiTestPage() {
  const [serverStatus, setServerStatus] = useState('확인 중...');
  const [user, setUser] = useState(() => api.getCurrentUser());
  const [alarms, setAlarms] = useState([]);
  const [logs, setLogs] = useState([]);

  // Input states
  const [tossUserId, setTossUserId] = useState('test-user-1');
  const [instagramId, setInstagramId] = useState('my_instagram');
  const [targetInstagramId, setTargetInstagramId] = useState('target_instagram');

  const addLog = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
  }, []);

  const checkServer = useCallback(async () => {
    const isHealthy = await api.healthCheck();
    setServerStatus(isHealthy ? '✅ 연결됨' : '❌ 연결 안됨');
    addLog(`서버 상태: ${isHealthy ? '정상' : '오프라인'}`, isHealthy ? 'success' : 'error');
  }, [addLog]);

  const handleGetAlarms = useCallback(async () => {
    try {
      addLog('알람 목록 조회 중...');
      const result = await api.getAlarms();
      setAlarms(result);
      addLog(`알람 ${result.length}개 조회됨`, 'success');
    } catch (error) {
      addLog(`알람 조회 실패: ${error.message}`, 'error');
    }
  }, [addLog]);

  // 서버 상태 확인 & WebSocket 연결
  useEffect(() => {
    const timer = window.setTimeout(() => {
      checkServer();
    }, 0);

    let restoreLogTimer;
    if (user) {
      restoreLogTimer = window.setTimeout(() => {
        addLog(`저장된 사용자 복원: ${user.tossUserId}`, 'success');
      }, 0);
      api.connectSocket();
    }

    // 컴포넌트 언마운트 시 정리
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(restoreLogTimer);
      api.offMatched();
      api.offMatchCanceled();
    };
  }, [addLog, checkServer, user]);

  // WebSocket 이벤트 리스너 설정
  useEffect(() => {
    if (user) {
      // 매칭 성공 이벤트
      api.onMatched((data) => {
        addLog(`🎉 실시간 알림: ${data.message} (from @${data.matchedWith})`, 'success');
        handleGetAlarms(); // 목록 새로고침
      });

      // 매칭 해제 이벤트
      api.onMatchCanceled((data) => {
        addLog(`💔 실시간 알림: ${data.message} (@${data.canceledBy}가 삭제함)`, 'error');
        handleGetAlarms(); // 목록 새로고침
      });
    }
  }, [addLog, handleGetAlarms, user]);

  // 로그인
  const handleLogin = async () => {
    try {
      addLog(`로그인 시도: ${tossUserId}`);
      const result = await api.login(tossUserId);
      setUser(result.user);
      addLog(`로그인 성공! ${result.isNewUser ? '(신규 사용자)' : '(기존 사용자)'}`, 'success');
      addLog(`User ID: ${result.user.id}`);
      // WebSocket 연결
      api.connectSocket();
      addLog(`🔌 WebSocket 연결됨`, 'success');
    } catch (error) {
      addLog(`로그인 실패: ${error.message}`, 'error');
    }
  };

  // 로그아웃
  const handleLogout = () => {
    api.logout();
    setUser(null);
    setAlarms([]);
    addLog('로그아웃 완료', 'info');
  };

  // 인스타그램 ID 등록
  const handleUpdateInstagram = async () => {
    try {
      addLog(`인스타그램 ID 등록: @${instagramId}`);
      const result = await api.updateInstagramId(instagramId);
      setUser(result.user);
      addLog(`인스타그램 ID 등록 성공!`, 'success');
    } catch (error) {
      addLog(`인스타그램 ID 등록 실패: ${error.message}`, 'error');
    }
  };

  // 알람 생성
  const handleCreateAlarm = async () => {
    try {
      addLog(`알람 생성: @${targetInstagramId}`);
      const result = await api.createAlarm(targetInstagramId);
      addLog(`알람 생성 성공!`, 'success');
      if (result.matched) {
        addLog(`🎉 매칭 성공!!!`, 'success');
      }
      handleGetAlarms(); // 목록 새로고침
    } catch (error) {
      addLog(`알람 생성 실패: ${error.message}`, 'error');
    }
  };

  // 알람 삭제
  const handleDeleteAlarm = async (alarmId) => {
    try {
      addLog(`알람 삭제: ${alarmId}`);
      await api.deleteAlarm(alarmId);
      addLog(`알람 삭제 성공!`, 'success');
      handleGetAlarms(); // 목록 새로고침
    } catch (error) {
      addLog(`알람 삭제 실패: ${error.message}`, 'error');
    }
  };

  // 로그 지우기
  const clearLogs = () => setLogs([]);

  return (
    <div className="api-test-page">
      <h1>🔧 API 테스트 페이지</h1>
      <p className="server-status">서버 상태: {serverStatus}</p>

      {/* 로그인 섹션 */}
      <section className="test-section">
        <h2>1. 로그인 (Mock 토스 계정)</h2>
        <div className="input-group">
          <input
            type="text"
            value={tossUserId}
            onChange={(e) => setTossUserId(e.target.value)}
            placeholder="토스 사용자 ID (테스트용)"
          />
          <button onClick={handleLogin}>로그인</button>
          {user && <button onClick={handleLogout} className="secondary">로그아웃</button>}
        </div>
        {user && (
          <div className="user-info">
            <p><strong>로그인됨:</strong> {user.tossUserId}</p>
            <p><strong>User ID:</strong> {user.id}</p>
            <p><strong>인스타그램:</strong> {user.instagramId || '(미등록)'}</p>
          </div>
        )}
      </section>

      {/* 인스타그램 ID 등록 */}
      {user && (
        <section className="test-section">
          <h2>2. 내 인스타그램 ID 등록</h2>
          <div className="input-group">
            <input
              type="text"
              value={instagramId}
              onChange={(e) => setInstagramId(e.target.value)}
              placeholder="내 인스타그램 ID"
            />
            <button onClick={handleUpdateInstagram}>등록/수정</button>
          </div>
        </section>
      )}

      {/* 알람 관리 */}
      {user && user.instagramId && (
        <section className="test-section">
          <h2>3. 알람 관리</h2>
          <div className="input-group">
            <input
              type="text"
              value={targetInstagramId}
              onChange={(e) => setTargetInstagramId(e.target.value)}
              placeholder="좋아하는 사람의 인스타 ID"
            />
            <button onClick={handleCreateAlarm}>알람 추가</button>
            <button onClick={handleGetAlarms} className="secondary">목록 새로고침</button>
          </div>

          {/* 알람 목록 */}
          <div className="alarm-list">
            <h3>내 알람 목록 ({alarms.length}개)</h3>
            {alarms.length === 0 ? (
              <p className="empty">알람이 없습니다.</p>
            ) : (
              <ul>
                {alarms.map((alarm) => (
                  <li key={alarm.id} className={alarm.status === 'matched' ? 'matched' : ''}>
                    <span>@{alarm.targetInstagramId}</span>
                    <span className="status">{alarm.status === 'matched' ? '💕 매칭!' : '⏳ 대기중'}</span>
                    <button onClick={() => handleDeleteAlarm(alarm.id)} className="delete">삭제</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* 매칭 테스트 가이드 */}
      <section className="test-section guide">
        <h2>📋 매칭 테스트 방법</h2>
        <ol>
          <li><strong>사용자 A</strong>: test-user-1로 로그인 → 인스타 @user_a 등록 → @user_b에게 알람</li>
          <li><strong>사용자 B</strong>: test-user-2로 로그인 → 인스타 @user_b 등록 → @user_a에게 알람</li>
          <li>양쪽 모두 알람이 <strong>💕 매칭!</strong>으로 바뀌면 성공!</li>
        </ol>
      </section>

      {/* 로그 */}
      <section className="test-section logs">
        <h2>📝 로그 <button onClick={clearLogs} className="small">지우기</button></h2>
        <div className="log-list">
          {logs.map((log, i) => (
            <div key={i} className={`log ${log.type}`}>
              <span className="time">{log.timestamp}</span>
              <span className="msg">{log.message}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

