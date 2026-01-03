import { createContext, useContext, useState, useEffect } from 'react';
import { appLogin } from '@apps-in-toss/web-framework';
import { api } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 앱 시작 시 저장된 사용자 복원만 수행
    // 토스 로그인은 IntroPage에서 명시적으로 호출
    const initAuth = async () => {
      try {
        // 저장된 사용자 확인
        const currentUser = api.getCurrentUser();
        
        if (currentUser) {
          setUser(currentUser);
          // WebSocket 연결
          api.connectSocket();
          console.log('✅ 저장된 사용자 복원 완료');
        } else {
          console.log('ℹ️ 저장된 사용자 없음 - 로그인 필요');
        }
      } catch (error) {
        console.error('Auth init error:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // 토스 로그인 수행
  const performTossLogin = async () => {
    try {
      // 1. 토스 SDK에서 인가 코드 받기
      const { authorizationCode, referrer } = await appLogin();
      console.log('✅ 토스 인가 코드 발급 완료');

      // 2. 서버로 전송하여 로그인 처리
      const result = await api.tossLogin(authorizationCode, referrer);
      console.log('✅ 토스 로그인 완료:', result.isNewUser ? '새 사용자' : '기존 사용자');

      return result.user;
    } catch (error) {
      console.error('토스 로그인 실패:', error);
      throw error;
    }
  };

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

  // 재로그인 (토스 로그인 다시 수행)
  const relogin = async () => {
    setLoading(true);
    try {
      const currentUser = await performTossLogin();
      setUser(currentUser);
      api.connectSocket();
      return currentUser;
    } catch (error) {
      console.error('Relogin error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, updateInstagramId, logout, relogin }}>
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
