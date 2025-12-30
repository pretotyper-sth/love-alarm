import { useState, useEffect } from 'react';
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
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { share } from '@apps-in-toss/web-framework';
import './SettingsPage.css';

// 공유 기능 헬퍼 함수
const handleShare = async (message) => {
  try {
    // 1. 토스 앱인토스 share 함수 시도
    try {
      await share({ message });
      return;
    } catch (shareError) {
      // 사용자가 취소한 경우 조용히 종료
      if (shareError?.name === 'AbortError' || shareError?.message?.includes('cancel')) {
        console.log('사용자가 공유를 취소했습니다.');
        return;
      }
      
      // 2. Web Share API 폴백
      if (navigator.share) {
        try {
          await navigator.share({
            text: message,
          });
          return;
        } catch (webShareError) {
          // 사용자가 취소한 경우 조용히 종료
          if (webShareError?.name === 'AbortError' || webShareError?.message?.includes('cancel')) {
            console.log('사용자가 공유를 취소했습니다.');
            return;
          }
          throw webShareError;
        }
      }
      
      // 3. 클립보드 복사 폴백
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(message);
        alert('링크가 클립보드에 복사되었습니다!');
        return;
      }
      
      throw shareError;
    }
  } catch (error) {
    console.error('공유 오류:', error);
    alert('공유하기에 실패했습니다. 다시 시도해주세요.');
  }
};

// 앱 다시 시작용 (React Native 환경)
const restartApp = () => {
  // localStorage 클리어
  localStorage.removeItem('love_alarm_user');
  localStorage.removeItem('love_alarm_device_id');
  // 페이지 새로고침 시도
  if (typeof window !== 'undefined') {
    window.location.href = '/';
  }
};

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, setUser, relogin } = useAuth();
  
  // 즉시 캐시된 값으로 초기화 (스켈레톤 없이 바로 표시)
  const [pushEnabled, setPushEnabled] = useState(user?.pushEnabled ?? false);
  const [tossAppEnabled, setTossAppEnabled] = useState(user?.tossAppEnabled ?? false);
  const [isSaving, setIsSaving] = useState(false);

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

      {/* 구분선 16px */}
      <div style={{ width: '100%', height: '16px', backgroundColor: '#f9fafb' }} />

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
          onClick={() => {
            handleShare(
              '토스 앱 | 좋아하면 울리는\n' +
              '#토스 #앱인토스 #설치없이시작가능\n\n' +
              window.location.origin
            );
          }}
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

      {/* 개발용: userKey 표시 + 다시 로그인 */}
      <Spacing size={40} />
      <div style={{ padding: '0 16px' }}>
        {user?.tossUserId && (
          <Text color="#8b95a1" typography="t7">
            [개발용] userKey: {user.tossUserId}
          </Text>
        )}
        <Spacing size={16} />
        <button
          onClick={async () => {
            try {
              // localStorage 클리어
              localStorage.removeItem('love_alarm_user');
              localStorage.removeItem('love_alarm_device_id');
              // 토스 로그인 다시 수행
              const newUser = await relogin();
              alert('로그인 성공! userKey: ' + newUser.tossUserId);
            } catch (error) {
              alert('로그인 실패: ' + error.message);
            }
          }}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: '#3182f6',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          🔄 토스 로그인 다시하기
        </button>
      </div>

    </div>
  );
}
