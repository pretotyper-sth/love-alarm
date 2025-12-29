import { useState, useEffect } from 'react';
import {
  Text,
  Top,
  List,
  ListRow,
  Switch,
  Spacing,
  Skeleton,
  Asset,
} from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import './SettingsPage.css';

// 토스 앱인토스 공유 API (웹 프레임워크)
const handleShare = async () => {
  try {
    // @apps-in-toss/web-framework의 share API
    if (typeof window !== 'undefined' && window.AppsInToss) {
      const deepLink = 'intoss://love-alarm';
      const tossLink = await window.AppsInToss.getTossShareLink(deepLink);
      await window.AppsInToss.share({ message: tossLink });
    } else {
      // 개발 환경: Web Share API 또는 클립보드 복사
      if (navigator.share) {
        await navigator.share({
          title: '좋아하면 울리는 💙',
          text: '서로 좋아하면 알람이 울려요',
          url: 'https://love-alarm.vercel.app',
        });
      } else {
        await navigator.clipboard.writeText('https://love-alarm.vercel.app');
        alert('링크가 복사되었어요!');
      }
    }
  } catch (error) {
    console.error('공유 실패:', error);
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
  const location = useLocation();
  const { user, setUser, relogin } = useAuth();
  
  const [pushEnabled, setPushEnabled] = useState(false);
  const [tossAppEnabled, setTossAppEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successToast, setSuccessToast] = useState({ show: false, message: '' });

  // 피드백 제출 후 돌아왔을 때 토스트 표시
  useEffect(() => {
    if (location.state?.showFeedbackToast) {
      setSuccessToast({ show: true, message: '소중한 의견이 전달되었어요' });
      setTimeout(() => {
        setSuccessToast({ show: false, message: '' });
      }, 3000);
      // state 초기화 (뒤로가기 시 다시 안 뜨게)
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // 사용자 정보에서 알림 설정 로드
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // 최신 사용자 정보 가져오기
        const userData = await api.getUser();
        setPushEnabled(userData.pushEnabled ?? false);
        setTossAppEnabled(userData.tossAppEnabled ?? false);
      } catch (error) {
        console.error('Failed to load settings:', error);
        // 에러 시 로컬 user 정보 사용
        if (user) {
          setPushEnabled(user.pushEnabled ?? false);
          setTossAppEnabled(user.tossAppEnabled ?? false);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [user]);

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

      {isLoading ? (
        <Skeleton custom={['listWithIcon']} repeatLastItemCount={2} />
      ) : (
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
      )}

      {/* 구분선 */}
      <Spacing size={24} />
      <div className="settings-divider" />
      <Spacing size={8} />

      {/* 공유 및 피드백 섹션 */}
      <List>
        {/* 그 사람에게도 내 마음이 닿도록 소문내기 */}
        <ListRow
          contents={
            <Text color="#4e5968" typography="t5" fontWeight="semibold">
              그 사람에게도 내 마음이 닿도록 소문내기
            </Text>
          }
          onClick={handleShare}
          verticalPadding="large"
          horizontalPadding="medium"
        />

        {/* 의견 보내기 */}
        <ListRow
          contents={
            <Text color="#4e5968" typography="t5" fontWeight="semibold">
              의견 보내기
            </Text>
          }
          right={
            <Asset.Icon
              name="icon-chevron-right-mono"
              color={adaptive.grey400}
            />
          }
          onClick={() => navigate('/feedback')}
          verticalPadding="large"
          horizontalPadding="medium"
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

      {/* 성공 Toast */}
      <div className={`single-toast success ${successToast.show ? 'show' : ''}`}>
        <div className="custom-toast-content">
          <span className="custom-toast-success-icon">✓</span>
          <span className="custom-toast-text">{successToast.message}</span>
        </div>
      </div>

    </div>
  );
}
