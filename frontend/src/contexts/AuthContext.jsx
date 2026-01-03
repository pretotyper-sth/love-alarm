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
      let loginResult;
      try {
        loginResult = await appLogin();
      } catch (appLoginError) {
        throw new Error(`토스 인증 실패: ${appLoginError.message}`);
      }
      
      const { authorizationCode, referrer } = loginResult;

      // 2. 서버로 전송하여 로그인 처리
      const result = await api.tossLogin(authorizationCode, referrer);

      return result.user;
    } catch (error) {
      throw error;
    }
  };

  useEffect(() => {
    // 앱 시작 시 인증 초기화
    const initAuth = async () => {
      try {
        // 저장된 사용자 확인
        const currentUser = api.getCurrentUser();
        const hasVisitedIntro = storage.get('has_visited_intro');
        
        if (currentUser) {
          // 이미 로그인된 사용자 - 복원
          setUser(currentUser);
          api.connectSocket();
        } else if (hasVisitedIntro) {
          // 온보딩은 완료했지만 사용자 정보가 없음
          // → 토스 앱에서 복귀 후 앱이 재시작된 경우
          // → 자동으로 토스 로그인 시도
          try {
            const newUser = await performTossLoginInternal();
            setUser(newUser);
            api.connectSocket();
          } catch (loginError) {
            // 실패해도 IntroPage를 다시 보여주지 않음 (무한 루프 방지)
          }
        }
      } catch (error) {
        // Auth init error - 무시
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
