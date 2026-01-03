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
    console.log('🔐 [performTossLogin] appLogin() 호출 시작...');
    try {
      // 1. 토스 SDK에서 인가 코드 받기
      // 여기서 토스 동의 화면이 표시되어야 함!
      const { authorizationCode, referrer } = await appLogin();
      console.log('🔐 [performTossLogin] appLogin() 완료 - 인가 코드 발급됨');

      // 2. 서버로 전송하여 로그인 처리
      console.log('🔐 [performTossLogin] 서버에 토스 로그인 요청...');
      const result = await api.tossLogin(authorizationCode, referrer);
      console.log('🔐 [performTossLogin] 서버 로그인 완료:', result.isNewUser ? '새 사용자' : '기존 사용자');

      return result.user;
    } catch (error) {
      console.error('🔐 [performTossLogin] 오류:', error);
      throw error;
    }
  };

  useEffect(() => {
    // 앱 시작 시 인증 초기화
    // 자동 로그인 없이, 저장된 사용자만 복원
    // 토스 로그인은 IntroPage에서 사용자가 "확인했어요" 클릭 시에만 수행
    const initAuth = async () => {
      console.log('🔐 [AuthContext] initAuth 시작');
      try {
        // 저장된 사용자 확인
        const currentUser = api.getCurrentUser();
        console.log('🔐 [AuthContext] 저장된 사용자:', currentUser ? '있음' : '없음');
        
        if (currentUser) {
          setUser(currentUser);
          api.connectSocket();
          console.log('🔐 [AuthContext] 저장된 사용자 복원 완료');
        } else {
          // 저장된 사용자 없음 - IntroPage에서 로그인 필요
          console.log('🔐 [AuthContext] 저장된 사용자 없음 - 로그인 대기');
        }
      } catch (error) {
        console.error('🔐 [AuthContext] Auth init error:', error);
      } finally {
        setLoading(false);
        console.log('🔐 [AuthContext] initAuth 완료');
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
