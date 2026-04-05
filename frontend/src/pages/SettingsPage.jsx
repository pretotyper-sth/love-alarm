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
import {
  loadUnreadMessageBadgeEnabled,
  saveUnreadMessageBadgeEnabled,
} from '../utils/messages';
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
  const [unreadMessageBadgeEnabled, setUnreadMessageBadgeEnabled] = useState(() => loadUnreadMessageBadgeEnabled());
  const [isSaving, setIsSaving] = useState(false);
  const [showAuthSheet, setShowAuthSheet] = useState(false);
  const [showAuthManageSheet, setShowAuthManageSheet] = useState(false);
  const [authManageStep, setAuthManageStep] = useState('menu');
  const [isDisconnectingAuth, setIsDisconnectingAuth] = useState(false);
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

  const showSuccessToastMessage = (message) => {
    setSuccessToast({ show: true, message });
    setTimeout(() => {
      setSuccessToast(prev => ({ ...prev, show: false }));
      setTimeout(() => setSuccessToast({ show: false, message: '' }), 300);
    }, 3000);
  };

  const applyDisconnectedAuthState = () => {
    localStorage.removeItem(IG_VERIFIED_KEY);
    if (localStorage.getItem('love_alarm_my_instagram_id') === verifiedUsername) {
      localStorage.removeItem('love_alarm_my_instagram_id');
    }
    localStorage.removeItem('love_alarm_alarms');
    localStorage.removeItem('love_alarm_count');
    setVerifiedUsername('');
    setShowAuthManageSheet(false);
    setAuthManageStep('menu');
    showSuccessToastMessage('인증을 해제했어요');
  };

  const closeAuthManageSheet = () => {
    if (isDisconnectingAuth) return;
    setShowAuthManageSheet(false);
    setAuthManageStep('menu');
  };

  const handleInstagramAuthRowClick = () => {
    if (verifiedUsername) {
      setAuthManageStep('menu');
      setShowAuthManageSheet(true);
      return;
    }
    setShowAuthSheet(true);
  };

  const handleDisconnectInstagramAuth = async () => {
    if (!verifiedUsername || isDisconnectingAuth) return;

    setIsDisconnectingAuth(true);
    try {
      const result = await api.disconnectInstagramAuth();
      setUser(result.user);
      applyDisconnectedAuthState();
    } catch (error) {
      console.error('Failed to disconnect instagram auth:', error);
      window.alert(error.message || '인증 해제에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsDisconnectingAuth(false);
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

  const handleUnreadMessageBadgeToggle = () => {
    const nextValue = !unreadMessageBadgeEnabled;
    setUnreadMessageBadgeEnabled(nextValue);
    saveUnreadMessageBadgeEnabled(nextValue);
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#3182f6' }}>
                  @{verifiedUsername} ✓
                </span>
                <img
                  src="https://static.toss.im/icons/png/4x/icon-arrow-right-mono.png"
                  alt=""
                  style={{ width: '20px', height: '20px', opacity: 0.45 }}
                />
              </div>
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
          onClick={handleInstagramAuthRowClick}
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

        <ListRow
          contents={
            <Text color="#4e5968" typography="t5" fontWeight="semibold">
              읽지 않은 메세지 배지 표시
            </Text>
          }
          right={
            <Switch
              checked={unreadMessageBadgeEnabled}
              onChange={handleUnreadMessageBadgeToggle}
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
        currentVerifiedUsername={verifiedUsername}
        onSuccess={(username) => {
          const isReauth = !!verifiedUsername;
          setVerifiedUsername(username);
          setShowAuthSheet(false);
          showSuccessToastMessage(isReauth ? '재인증을 완료했어요' : '인증을 완료했어요');
        }}
      />

      <div
        className={`settings-auth-sheet-overlay ${showAuthManageSheet ? 'show' : ''}`}
        onClick={closeAuthManageSheet}
      >
        <div
          className={`settings-auth-sheet ${showAuthManageSheet ? 'show' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="settings-auth-sheet-handle" />
          <div className="settings-auth-sheet-header">
            {authManageStep === 'menu' ? (
              <>
                <h3 className="settings-auth-sheet-title">인스타그램 인증 관리</h3>
                <p className="settings-auth-sheet-desc">
                  현재 @{verifiedUsername} 계정이 인증돼 있어요.
                  <br />
                  재인증하거나 인증을 해제할 수 있어요.
                </p>
              </>
            ) : (
              <>
                <h3 className="settings-auth-sheet-title">인증을 해제할까요?</h3>
                <p className="settings-auth-sheet-desc">
                  해제 시 현재 ID로 등록한 알람도 함께 정리돼요.
                </p>
              </>
            )}
          </div>
          <div className="settings-auth-sheet-actions">
            {authManageStep === 'menu' ? (
              <>
                <button
                  type="button"
                  className="settings-auth-sheet-btn settings-auth-sheet-btn--primary"
                  onClick={() => {
                    setShowAuthManageSheet(false);
                    setAuthManageStep('menu');
                    setShowAuthSheet(true);
                  }}
                  disabled={isDisconnectingAuth}
                >
                  재인증하기
                </button>
                <button
                  type="button"
                  className="settings-auth-sheet-btn settings-auth-sheet-btn--danger"
                  onClick={() => setAuthManageStep('confirm-disconnect')}
                  disabled={isDisconnectingAuth}
                >
                  인증 해제하기
                </button>
                <button
                  type="button"
                  className="settings-auth-sheet-btn settings-auth-sheet-btn--ghost"
                  onClick={closeAuthManageSheet}
                  disabled={isDisconnectingAuth}
                >
                  취소
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="settings-auth-sheet-btn settings-auth-sheet-btn--danger"
                  onClick={handleDisconnectInstagramAuth}
                  disabled={isDisconnectingAuth}
                >
                  {isDisconnectingAuth ? '인증 해제 중…' : '예, 해제할게요'}
                </button>
                <button
                  type="button"
                  className="settings-auth-sheet-btn settings-auth-sheet-btn--ghost"
                  onClick={() => setAuthManageStep('menu')}
                  disabled={isDisconnectingAuth}
                >
                  아니오
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* DEV ONLY: 좋아하는 사람 수 캐시 */}
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

          {/* 좋아하는 사람 수 캐시 */}
          <div>
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

          {/* 메세지 배지 */}
          <div style={{ borderTop: '1px solid #ffe066', paddingTop: '10px', marginTop: '10px' }}>
            <div style={{ fontSize: '10px', color: '#7c5c00', marginBottom: '5px', fontWeight: 600 }}>
              메세지 배지
            </div>
            <button
              onClick={() => {
                localStorage.removeItem('love_alarm_msg_badge_cleared_at');
                alert('메세지 배지 초기화 완료 (홈으로 이동하면 배지 표시)');
              }}
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
              배지 초기화
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
