import { createContext, useContext, useState, useEffect } from 'react';
import { appLogin } from '@apps-in-toss/web-framework';
import { api } from '../utils/api';
import { storage } from '../utils/storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 토스 로그인 수행 (내부 함수)
  const performTossLoginInternal = async () => {
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

  useEffect(() => {
    // 앱 시작 시 인증 초기화
    const initAuth = async () => {
      try {
        // 1. 저장된 사용자 확인
        const currentUser = api.getCurrentUser();
        
        if (currentUser) {
          setUser(currentUser);
          api.connectSocket();
          console.log('✅ 저장된 사용자 복원 완료');
        } else {
          // 2. 저장된 사용자가 없는 경우
          const hasVisited = storage.get('has_visited_intro');
          
          if (hasVisited) {
            // 온보딩은 완료했지만 사용자 정보가 없는 경우 (세션 만료, 앱 재설치 등)
            // → 토스 로그인 자동 시도 (토스가 기존 사용자 인식)
            console.log('ℹ️ 재방문 사용자 - 자동 로그인 시도');
            try {
              const newUser = await performTossLoginInternal();
              setUser(newUser);
              api.connectSocket();
              console.log('✅ 자동 로그인 완료');
            } catch (loginError) {
              // 자동 로그인 실패 시 온보딩 리셋 (IntroPage로 유도)
              console.error('자동 로그인 실패 - 온보딩 리셋:', loginError);
              storage.remove('has_visited_intro');
            }
          } else {
            console.log('ℹ️ 첫 방문 사용자 - IntroPage에서 로그인 필요');
          }
        }
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

  // 재로그인 (토스 로그인 다시 수행)
  const relogin = async () => {
    setLoading(true);
    try {
      const newUser = await performTossLoginInternal();
      setUser(newUser);
      api.connectSocket();
      return newUser;
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
