import { useState, useEffect, useRef } from 'react';
import {
  Text,
  Top,
  List,
  ListRow,
  Switch,
  Spacing,
  Border,
} from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import './SettingsPage.css';

// 공유 기능 헬퍼 함수 (토스 공유 링크 사용)
const handleShareApp = async () => {
  try {
    const { share, getTossShareLink } = await import('@apps-in-toss/web-framework');
    
    // intoss:// 스킴으로 공유 링크 생성 (검수 필수 요건)
    const tossLink = await getTossShareLink('intoss://love-alarm');
    
    const message = '토스 앱 | 좋아하면 울리는\n' +
      '#토스 #앱인토스 #설치없이시작가능\n\n' +
      tossLink;
    
    await share({ message });
  } catch (error) {
    // 사용자가 취소한 경우 조용히 종료
    if (error?.name === 'AbortError' || error?.message?.includes('cancel')) {
      return;
    }
    
    // Web Share API 폴백
    if (navigator.share) {
      try {
        await navigator.share({
          title: '좋아하면 울리는',
          text: '토스 앱 | 좋아하면 울리는\n#토스 #앱인토스 #설치없이시작가능',
        });
        return;
      } catch (webShareError) {
        if (webShareError?.name === 'AbortError') return;
      }
    }
    
    console.error('공유 오류:', error);
  }
};

export function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useAuth();
  
  // 즉시 캐시된 값으로 초기화 (스켈레톤 없이 바로 표시)
  const [pushEnabled, setPushEnabled] = useState(user?.pushEnabled ?? false);
  const [tossAppEnabled, setTossAppEnabled] = useState(user?.tossAppEnabled ?? false);
  const [isSaving, setIsSaving] = useState(false);
  
  // 성공 토스트 상태
  const [successToast, setSuccessToast] = useState({ show: false, message: '' });
  const toastShownRef = useRef(false);

  // 피드백 제출 성공 토스트 표시
  useEffect(() => {
    if (location.state?.showFeedbackSuccess && !toastShownRef.current) {
      toastShownRef.current = true;
      setSuccessToast({ show: true, message: '의견을 제출했어요' });
      
      // 3초 후 fade out 시작
      setTimeout(() => {
        setSuccessToast(prev => ({ ...prev, show: false }));
        
        // fade out 애니메이션 후 완전히 제거
        setTimeout(() => {
          setSuccessToast({ show: false, message: '' });
        }, 300);
      }, 3000);
      
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // 백그라운드에서 서버와 조용히 동기화
  useEffect(() => {
    const syncSettings = async () => {
      try {
        const userData = await api.getUser();
        // 서버 값과 다르면 조용히 업데이트
        if (userData.pushEnabled !== pushEnabled) {
          setPushEnabled(userData.pushEnabled ?? false);
        }
        if (userData.tossAppEnabled !== tossAppEnabled) {
          setTossAppEnabled(userData.tossAppEnabled ?? false);
        }
      } catch (error) {
        console.error('Failed to sync settings:', error);
      }
    };

    // 컴포넌트 마운트 시 백그라운드 동기화
    syncSettings();
  }, []);

  // 설정 변경 핸들러
  const handleSettingChange = async (field, value) => {
    // Optimistic UI
    if (field === 'pushEnabled') {
      setPushEnabled(value);
    } else {
      setTossAppEnabled(value);
    }

    setIsSaving(true);
    try {
      const updatedUser = await api.updateSettings({ [field]: value });
      setUser(updatedUser);
    } catch (error) {
      console.error('Failed to save settings:', error);
      // 롤백
      if (field === 'pushEnabled') {
        setPushEnabled(!value);
      } else {
        setTossAppEnabled(!value);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="settings-page-container">
      <Spacing size={14} />

      <div className="settings-top-section">
        <Top
          title={
            <Top.TitleParagraph 
              size={22} 
              color={adaptive.grey900}
              style={{ fontSize: '22px' }}
            >
              서비스 설정
            </Top.TitleParagraph>
          }
        />
      </div>

      <Spacing size={24} />

      {/* 알림 설정 섹션 - 즉시 표시 */}
      <List>
        {/* 연결 시 푸시 알림 */}
        <ListRow
          contents={
            <Text color="#4e5968" typography="t5" fontWeight="semibold">
              연결 시 푸시 알림
            </Text>
          }
          right={
            <Switch
              checked={pushEnabled}
              disabled={isSaving}
              onChange={() => handleSettingChange('pushEnabled', !pushEnabled)}
            />
          }
          verticalPadding="large"
          horizontalPadding="medium"
        />

        {/* 연결 시 토스 앱 알림 */}
        <ListRow
          contents={
            <Text color="#4e5968" typography="t5" fontWeight="semibold">
              연결 시 토스 앱 알림
            </Text>
          }
          right={
            <Switch
              checked={tossAppEnabled}
              disabled={isSaving}
              onChange={() => handleSettingChange('tossAppEnabled', !tossAppEnabled)}
            />
          }
          verticalPadding="large"
          horizontalPadding="medium"
        />
      </List>

      {/* 여백 12px */}
      <Spacing size={12} />

      {/* 구분선 8px */}
      <div style={{ width: '100%', height: '8px', backgroundColor: '#f9fafb' }} />

      {/* 여백 12px */}
      <Spacing size={12} />

      {/* 추가 메뉴 섹션 */}
      <List>
        <ListRow
          contents={
            <Text color="#4e5968" typography="t5" fontWeight="semibold">
              내 마음이 닿도록 앱 소문내기
            </Text>
          }
          right={
            <img 
              src="https://static.toss.im/icons/png/4x/icon-arrow-right-mono.png"
              alt="오른쪽 화살표"
              style={{ width: '20px', height: '20px', opacity: 0.6 }}
            />
          }
          verticalPadding="large"
          horizontalPadding="medium"
          onClick={handleShareApp}
        />
        <ListRow
          contents={
            <Text color="#4e5968" typography="t5" fontWeight="semibold">
              의견 보내기
            </Text>
          }
          right={
            <img 
              src="https://static.toss.im/icons/png/4x/icon-arrow-right-mono.png"
              alt="오른쪽 화살표"
              style={{ width: '20px', height: '20px', opacity: 0.6 }}
            />
          }
          verticalPadding="large"
          horizontalPadding="medium"
          onClick={() => {
            navigate('/feedback');
          }}
        />
      </List>

      {/* 성공 토스트 - 기존 구조와 동일 */}
      <div className="toast-stack">
        {successToast.message && (
          <div className={`custom-toast ${successToast.show ? 'show' : ''}`}>
            <div className="custom-toast-content">
              <span className="custom-toast-icon">✓</span>
              <span className="custom-toast-text">{successToast.message}</span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
