import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 앱 시작 시 저장된 사용자 복원 또는 자동 로그인
    const initAuth = async () => {
      try {
        // 저장된 사용자 확인
        let currentUser = api.getCurrentUser();
        
        if (!currentUser) {
          // 저장된 사용자가 없으면 기기 ID로 자동 로그인
          // 실제 토스 연동 시 토스 사용자 ID 사용
          const deviceId = getOrCreateDeviceId();
          const result = await api.login(deviceId);
          currentUser = result.user;
        }

        setUser(currentUser);
        
        // WebSocket 연결
        api.connectSocket();
      } catch (error) {
        console.error('Auth init error:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // 인스타그램 ID 업데이트
  const updateInstagramId = async (instagramId) => {
    try {
      const result = await api.updateInstagramId(instagramId);
      setUser(result.user);
      return result.user;
    } catch (error) {
      throw error;
    }
  };

  // 로그아웃
  const logout = () => {
    api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, updateInstagramId, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// 기기 고유 ID 생성/조회 (개발용 - 실제로는 토스 사용자 ID 사용)
function getOrCreateDeviceId() {
  let deviceId = localStorage.getItem('love_alarm_device_id');
  if (!deviceId) {
    deviceId = 'device_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('love_alarm_device_id', deviceId);
  }
  return deviceId;
}

