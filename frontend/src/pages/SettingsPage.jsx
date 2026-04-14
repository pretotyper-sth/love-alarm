import { useState, useEffect, useRef } from 'react';
import {
  Text,
  Top,
  List,
  ListRow,
  Spacing,
} from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { logScreen, logClick } from '../utils/analytics';
import { InstagramAuthSheet } from '../components/InstagramAuthSheet';
import './SettingsPage.css';

const IG_VERIFIED_KEY = 'love_alarm_instagram_verified_username';
const IS_DEV = import.meta.env.DEV;
const DEV_BYPASS_USERNAME = 'dev_bypass';
const LIKE_COUNT_TARGET_KEY = 'love_alarm_like_count_target';
const LIKE_COUNT_RESULT_KEY = 'love_alarm_like_count_result';
const LIKE_COUNT_CHECKED_AT_KEY = 'love_alarm_like_count_checked_at';

// 공유 기능 (getTossShareLink + OG 이미지)
const handleShareApp = async () => {
  logClick('settings_share_click');
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

  useEffect(() => {
    logScreen('settings_screen');
  }, []);

  const showSuccessToastMessage = (message) => {
    setSuccessToast({ show: true, message, isError: false });
    setTimeout(() => {
      setSuccessToast(prev => ({ ...prev, show: false }));
      setTimeout(() => setSuccessToast({ show: false, message: '', isError: false }), 300);
    }, 3000);
  };

  const showErrorToastMessage = (message) => {
    setSuccessToast({ show: true, message, isError: true });
    setTimeout(() => {
      setSuccessToast(prev => ({ ...prev, show: false }));
      setTimeout(() => setSuccessToast({ show: false, message: '', isError: false }), 300);
    }, 3000);
  };

  const syncLocalUserCache = (nextInstagramId) => {
    if (!user) return;
    localStorage.setItem(
      'love_alarm_user',
      JSON.stringify({
        ...user,
        instagramId: nextInstagramId,
      }),
    );
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

  const handleDevAuthToggle = () => {
    if (!user) return;

    if (verifiedUsername === DEV_BYPASS_USERNAME) {
      syncLocalUserCache(null);
      setUser({ ...user, instagramId: null });
      applyDisconnectedAuthState();
      return;
    }

    logClick('settings_auth_complete');
    localStorage.setItem(IG_VERIFIED_KEY, DEV_BYPASS_USERNAME);
    setVerifiedUsername(DEV_BYPASS_USERNAME);
    setShowAuthSheet(false);
    setShowAuthManageSheet(false);
    setAuthManageStep('menu');
    syncLocalUserCache(DEV_BYPASS_USERNAME);
    setUser({ ...user, instagramId: DEV_BYPASS_USERNAME });
    showSuccessToastMessage('인증을 완료했어요');
  };

  const closeAuthManageSheet = () => {
    if (isDisconnectingAuth) return;
    setShowAuthManageSheet(false);
    setAuthManageStep('menu');
  };

  const handleInstagramAuthRowClick = () => {
    logClick('settings_auth_click', { has_verified: !!verifiedUsername });
    if (verifiedUsername) {
      setAuthManageStep('menu');
      setShowAuthManageSheet(true);
      return;
    }
    setShowAuthSheet(true);
  };

  const handleDisconnectInstagramAuth = async () => {
    if (!verifiedUsername || isDisconnectingAuth) return;

    if (IS_DEV && verifiedUsername === DEV_BYPASS_USERNAME) {
      handleDevAuthToggle();
      return;
    }

    setIsDisconnectingAuth(true);
    try {
      const result = await api.disconnectInstagramAuth();
      if (result.user) setUser(result.user);
      applyDisconnectedAuthState();
    } catch (error) {
      console.error('Failed to disconnect instagram auth:', error);
      showErrorToastMessage(error.message || '인증 해제에 실패했어요. 잠시 후 다시 시도해 주세요.');
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

      <Spacing size={8} />

      {/* 메뉴 섹션 */}
      <List>
        <ListRow
          contents={
            <Text color="#4e5968" typography="t5" fontWeight="semibold">
              알림 설정
            </Text>
          }
          right={
            <img
              src="https://static.toss.im/icons/png/4x/icon-arrow-right-mono.png"
              alt=""
              style={{ width: '20px', height: '20px', opacity: 0.6 }}
            />
          }
          verticalPadding="large"
          horizontalPadding="medium"
          onClick={() => {
            logClick('settings_notification_click');
            navigate('/notification-settings');
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
            logClick('settings_feedback_click');
            navigate('/feedback');
          }}
        />
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
      </List>

      {/* 토스트 - 성공/에러 공용 */}
      <div className="toast-stack">
        {successToast.message && (
          <div className={`custom-toast ${successToast.show ? 'show' : ''} ${successToast.isError ? 'error' : ''}`}>
            <div className="custom-toast-content">
              <span className="custom-toast-icon">{successToast.isError ? '!' : '✓'}</span>
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
          logClick('settings_auth_complete');
          const isReauth = !!verifiedUsername;
          setVerifiedUsername(username);
          setShowAuthSheet(false);
          showSuccessToastMessage(isReauth ? '재인증을 완료했어요' : '인증을 완료했어요');
        }}
      />

      <div
        className={`auth-manage-card-overlay ${showAuthManageSheet ? 'show' : ''}`}
        onClick={closeAuthManageSheet}
      >
        <div
          className={`auth-manage-card ${showAuthManageSheet ? 'show' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="auth-manage-card-header">
            {authManageStep === 'menu' ? (
              <>
                <h3 className="auth-manage-card-title">인스타그램 인증 관리</h3>
                <p className="auth-manage-card-desc">
                  현재 @{verifiedUsername} 계정이 인증돼 있어요.
                  <br />
                  재인증하거나 인증을 해제할 수 있어요.
                </p>
              </>
            ) : (
              <>
                <h3 className="auth-manage-card-title">인증을 해제할까요?</h3>
                <p className="auth-manage-card-desc">
                  해제 시 현재 ID로 등록한 알람도 함께 정리돼요.
                </p>
              </>
            )}
          </div>
          <div className="auth-manage-card-actions">
            {authManageStep === 'menu' ? (
              <>
                <button
                  type="button"
                  className="auth-manage-card-btn auth-manage-card-btn--primary"
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
                  className="auth-manage-card-btn auth-manage-card-btn--danger"
                  onClick={() => setAuthManageStep('confirm-disconnect')}
                  disabled={isDisconnectingAuth}
                >
                  인증 해제하기
                </button>
                <button
                  type="button"
                  className="auth-manage-card-btn auth-manage-card-btn--ghost"
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
                  className="auth-manage-card-btn auth-manage-card-btn--danger"
                  onClick={handleDisconnectInstagramAuth}
                  disabled={isDisconnectingAuth}
                >
                  {isDisconnectingAuth ? '인증 해제 중…' : '예, 해제할게요'}
                </button>
                <button
                  type="button"
                  className="auth-manage-card-btn auth-manage-card-btn--ghost"
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
                  background: verifiedUsername === DEV_BYPASS_USERNAME ? '#e53e3e' : '#2f855a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {verifiedUsername === DEV_BYPASS_USERNAME ? '인증 해제' : 'bypass 인증'}
              </button>
              <span style={{ fontSize: '12px', color: '#7c5c00' }}>
                {verifiedUsername === DEV_BYPASS_USERNAME ? `@${verifiedUsername}` : '미인증'}
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

          {/* 메시지 배지 */}
          <div style={{ borderTop: '1px solid #ffe066', paddingTop: '10px', marginTop: '10px' }}>
            <div style={{ fontSize: '10px', color: '#7c5c00', marginBottom: '5px', fontWeight: 600 }}>
              메시지 배지
            </div>
            <button
              onClick={() => {
                localStorage.removeItem('love_alarm_msg_badge_cleared_at');
                alert('메시지 배지 초기화 완료 (홈으로 이동하면 배지 표시)');
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
