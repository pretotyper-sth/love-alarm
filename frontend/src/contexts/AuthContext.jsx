import { createContext, useContext, useState, useEffect } from 'react';
import { appLogin } from '@apps-in-toss/web-framework';
import { api } from '../utils/api';
import { storage } from '../utils/storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 브라우저 환경 감지 (토스 앱이 아닌 경우)
  const isBrowserEnv = () => {
    try {
      // ReactNativeWebView가 없으면 일반 브라우저
      return typeof window !== 'undefined' && !window.ReactNativeWebView;
    } catch {
      return true;
    }
  };

  // 토스 로그인 수행 (내부 함수)
  const performTossLoginInternal = async () => {
    try {
      // 브라우저 환경에서는 Mock 로그인 (개발용)
      if (isBrowserEnv()) {
        // Mock 사용자 ID로 서버 로그인
        const mockTossUserId = 'dev_browser_user_' + Date.now();
        const result = await api.login(mockTossUserId);
        return result.user;
      }

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
          // 로컬에 저장된 사용자가 있음 - 서버에서 유효성 검증
          try {
            const validUser = await api.getUser();
            setUser(validUser);
            api.connectSocket();
          } catch (userError) {
            // 서버에서 사용자를 찾을 수 없음 (연결 해제됨)
            // → 로컬 데이터 정리하고 IntroPage에서 다시 로그인하도록 함
            api.logout();
            storage.remove('has_visited_intro');
            // 자동 로그인 시도 안 함 - 사용자가 직접 버튼 클릭하도록
          }
        } else if (hasVisitedIntro) {
          // 온보딩은 완료했지만 사용자 정보가 없음
          // → 토스 앱에서 약관 동의 후 복귀한 경우
          // → 자동으로 토스 로그인 시도 (인가 코드만 받으면 됨)
          try {
            const newUser = await performTossLoginInternal();
            setUser(newUser);
            api.connectSocket();
          } catch (loginError) {
            // 실패 시 IntroPage에서 다시 시도하도록 has_visited_intro 제거
            storage.remove('has_visited_intro');
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
