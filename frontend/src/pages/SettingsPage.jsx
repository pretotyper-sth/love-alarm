import { useState, useEffect, useRef } from 'react';
import {
  Text,
  Top,
  List,
  ListRow,
  Switch,
  Spacing,
} from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { InstagramAuthSheet } from '../components/InstagramAuthSheet';
import './SettingsPage.css';

const IG_VERIFIED_KEY = 'love_alarm_instagram_verified_username';
const IS_DEV = import.meta.env.DEV;
const LIKE_COUNT_TARGET_KEY = 'love_alarm_like_count_target';
const LIKE_COUNT_RESULT_KEY = 'love_alarm_like_count_result';
const LIKE_COUNT_CHECKED_AT_KEY = 'love_alarm_like_count_checked_at';

// 공유 기능 (getTossShareLink + OG 이미지)
const handleShareApp = async () => {
  try {
    const { getTossShareLink, share } = await import('@apps-in-toss/web-framework');
    
    // getTossShareLink로 공유 링크 생성 (OG 이미지 포함)
    const tossLink = await getTossShareLink(
      'intoss://love-alarm',
      'https://love-alarm.vercel.app/og-image.jpg'
    );
    
    const shareMessage = `짝사랑 확인하기 | 좋아하면 울리는
${tossLink}`;

    await share({ message: shareMessage });
  } catch (error) {
    console.error('[공유] 에러:', error);
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
  const [showAuthSheet, setShowAuthSheet] = useState(false);
  const [verifiedUsername, setVerifiedUsername] = useState(
    () => localStorage.getItem(IG_VERIFIED_KEY) || ''
  );
  
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
        setPushEnabled(userData.pushEnabled ?? false);
        setTossAppEnabled(userData.tossAppEnabled ?? false);
      } catch (error) {
        console.error('Failed to sync settings:', error);
      }
    };

    // 컴포넌트 마운트 시 백그라운드 동기화
    syncSettings();
  }, []);

  // Dev bypass: 인스타그램 인증 상태 강제 토글
  const handleDevAuthToggle = () => {
    if (verifiedUsername) {
      localStorage.removeItem(IG_VERIFIED_KEY);
      setVerifiedUsername('');
    } else {
      const mockId = 'dev_bypass';
      localStorage.setItem(IG_VERIFIED_KEY, mockId);
      setVerifiedUsername(mockId);
    }
  };

  // Dev bypass: 좋아하는 사람 수 캐시 초기화
  const handleDevClearLikeCount = () => {
    localStorage.removeItem(LIKE_COUNT_TARGET_KEY);
    localStorage.removeItem(LIKE_COUNT_RESULT_KEY);
    localStorage.removeItem(LIKE_COUNT_CHECKED_AT_KEY);
  };

  // Dev bypass: 현재 캐시 정보 표시
  const likeCountTarget = localStorage.getItem(LIKE_COUNT_TARGET_KEY) || null;
  const likeCountResult = localStorage.getItem(LIKE_COUNT_RESULT_KEY);
  const likeCountCheckedAt = localStorage.getItem(LIKE_COUNT_CHECKED_AT_KEY);
  const likeCountCacheStatus = likeCountTarget
    ? `@${likeCountTarget} = ${likeCountResult ?? '?'}명 (${likeCountCheckedAt ? new Date(likeCountCheckedAt).toLocaleTimeString('ko-KR') : '-'})`
    : '없음';

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
              더보기
            </Top.TitleParagraph>
          }
        />
      </div>

      <Spacing size={24} />

      {/* 인스타그램 인증 섹션 */}
      <List>
        <ListRow
          contents={
            <Text color="#4e5968" typography="t5" fontWeight="semibold">
              인스타그램 인증
            </Text>
          }
          right={
            verifiedUsername ? (
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#3182f6' }}>
                @{verifiedUsername} ✓
              </span>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '14px', color: '#8b95a1' }}>인증하기</span>
                <img
                  src="https://static.toss.im/icons/png/4x/icon-arrow-right-mono.png"
                  alt=""
                  style={{ width: '20px', height: '20px', opacity: 0.6 }}
                />
              </div>
            )
          }
          verticalPadding="large"
          horizontalPadding="medium"
          onClick={() => setShowAuthSheet(true)}
        />
      </List>

      <Spacing size={12} />
      <div style={{ width: '100%', height: '8px', backgroundColor: '#f9fafb' }} />
      <Spacing size={12} />

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

      {/* 인스타그램 인증 바텀시트 */}
      <InstagramAuthSheet
        open={showAuthSheet}
        onClose={() => setShowAuthSheet(false)}
        alreadyVerified={!!verifiedUsername}
        onSuccess={(username) => {
          setVerifiedUsername(username);
          setShowAuthSheet(false);
          setSuccessToast({ show: true, message: '인증이 완료됐어요' });
          setTimeout(() => {
            setSuccessToast(prev => ({ ...prev, show: false }));
            setTimeout(() => setSuccessToast({ show: false, message: '' }), 300);
          }, 3000);
        }}
      />

      {/* DEV ONLY: 인스타그램 인증 bypass */}
      {IS_DEV && (
        <div style={{
          margin: '24px 20px 16px',
          padding: '12px 14px',
          background: '#fffbe6',
          border: '1px solid #ffe066',
          borderRadius: '10px',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#7c5c00', marginBottom: '10px', letterSpacing: '0.03em' }}>
            🛠 DEV BYPASS
          </div>

          {/* 인스타그램 인증 */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '10px', color: '#7c5c00', marginBottom: '5px', fontWeight: 600 }}>
              인스타그램 인증
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={handleDevAuthToggle}
                style={{
                  fontSize: '13px',
                  padding: '5px 12px',
                  background: verifiedUsername ? '#e53e3e' : '#2f855a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {verifiedUsername ? '인증 해제' : '인증하기'}
              </button>
              <span style={{ fontSize: '12px', color: '#7c5c00' }}>
                {verifiedUsername ? `@${verifiedUsername}` : '미인증'}
              </span>
            </div>
          </div>

          {/* 좋아하는 사람 수 캐시 */}
          <div style={{ borderTop: '1px solid #ffe066', paddingTop: '10px' }}>
            <div style={{ fontSize: '10px', color: '#7c5c00', marginBottom: '5px', fontWeight: 600 }}>
              좋아하는 사람 캐시
            </div>
            <div style={{ fontSize: '11px', color: '#7c5c00', marginBottom: '6px' }}>
              {likeCountCacheStatus}
            </div>
            <button
              onClick={handleDevClearLikeCount}
              style={{
                fontSize: '12px',
                padding: '4px 10px',
                background: '#718096',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              캐시 초기화
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
