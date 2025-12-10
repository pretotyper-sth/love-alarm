// API 클라이언트
import { io } from 'socket.io-client';

// 환경 변수에서 API URL을 가져오거나, 없으면 로컬 개발용 URL 사용
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080') + '/api';
const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// 현재 사용자 정보 (로그인 후 저장)
let currentUser = null;

// WebSocket 연결
let socket = null;

export const api = {
  // ==================== 인증 ====================
  
  /**
   * 토스 계정으로 로그인 (Mock: tossUserId를 직접 전달)
   * 실제 연동 시 토스 SDK에서 받아온 ID 사용
   */
  login: async (tossUserId) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tossUserId }),
    });
    
    if (!response.ok) {
      throw new Error('로그인 실패');
    }
    
    const data = await response.json();
    currentUser = data.user;
    
    // localStorage에 사용자 정보 저장 (앱 재시작 시 복원용)
    localStorage.setItem('love_alarm_user', JSON.stringify(currentUser));
    
    return data;
  },

  /**
   * 현재 로그인된 사용자 가져오기
   */
  getCurrentUser: () => {
    if (currentUser) return currentUser;
    
    // localStorage에서 복원 시도
    const stored = localStorage.getItem('love_alarm_user');
    if (stored) {
      currentUser = JSON.parse(stored);
      return currentUser;
    }
    
    return null;
  },

  /**
   * 로그아웃
   */
  logout: () => {
    currentUser = null;
    localStorage.removeItem('love_alarm_user');
    // 소켓 연결 해제
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },

  // ==================== WebSocket ====================

  /**
   * WebSocket 연결
   */
  connectSocket: () => {
    if (socket) return socket; // 이미 연결됨

    socket = io(SOCKET_URL);

    socket.on('connect', () => {
      console.log('🔌 WebSocket 연결됨:', socket.id);
      // 사용자 등록
      const user = api.getCurrentUser();
      if (user) {
        socket.emit('register', user.id);
      }
    });

    socket.on('disconnect', () => {
      console.log('🔌 WebSocket 연결 해제됨');
    });

    return socket;
  },

  /**
   * WebSocket 연결 해제
   */
  disconnectSocket: () => {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },

  /**
   * 소켓 인스턴스 가져오기
   */
  getSocket: () => socket,

  /**
   * 매칭 이벤트 리스너 등록
   */
  onMatched: (callback) => {
    if (!socket) api.connectSocket();
    socket.on('matched', callback);
  },

  /**
   * 매칭 해제 이벤트 리스너 등록
   */
  onMatchCanceled: (callback) => {
    if (!socket) api.connectSocket();
    socket.on('matchCanceled', callback);
  },

  /**
   * 이벤트 리스너 제거
   */
  offMatched: () => {
    if (socket) socket.off('matched');
  },

  offMatchCanceled: () => {
    if (socket) socket.off('matchCanceled');
  },

  // ==================== 사용자 ====================

  /**
   * 인스타그램 ID 등록/수정
   */
  updateInstagramId: async (instagramId) => {
    const user = api.getCurrentUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    const response = await fetch(`${API_BASE_URL}/users/${user.id}/instagram`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instagramId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '인스타그램 ID 수정 실패');
    }

    const data = await response.json();
    currentUser = data.user;
    localStorage.setItem('love_alarm_user', JSON.stringify(currentUser));
    
    return data;
  },

  // ==================== 알람 ====================

  /**
   * 알람 목록 조회
   */
  getAlarms: async () => {
    const user = api.getCurrentUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    const response = await fetch(`${API_BASE_URL}/alarms?userId=${user.id}`);
    
    if (!response.ok) {
      throw new Error('알람 조회 실패');
    }

    const data = await response.json();
    return data.alarms;
  },

  /**
   * 알람 생성
   */
  createAlarm: async (fromInstagramId, targetInstagramId) => {
    const user = api.getCurrentUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    const response = await fetch(`${API_BASE_URL}/alarms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        fromInstagramId,
        targetInstagramId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '알람 생성 실패');
    }

    return await response.json();
  },

  /**
   * 알람 삭제
   */
  deleteAlarm: async (alarmId) => {
    const response = await fetch(`${API_BASE_URL}/alarms/${alarmId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('알람 삭제 실패');
    }

    return await response.json();
  },

  // ==================== 헬스체크 ====================

  /**
   * 서버 상태 확인
   */
  healthCheck: async () => {
    try {
      const response = await fetch('http://localhost:8080/health');
      return response.ok;
    } catch {
      return false;
    }
  },
};

export default api;

