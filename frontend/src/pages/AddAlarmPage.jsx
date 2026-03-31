import { useState, useEffect, useRef } from 'react';
import {
  Asset,
  Text,
  Top,
  TextField,
  Spacing,
  Button,
} from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import './AddAlarmPage.css';

// 최초 알람 등록 여부 키
const FIRST_ALARM_REGISTERED_KEY = 'love_alarm_first_registered';
const IG_VERIFIED_KEY = 'love_alarm_instagram_verified_username';

// 하루 추가 제한 키
const DAILY_ADD_COUNT_KEY = 'love_alarm_daily_add_count';
const DAILY_ADD_DATE_KEY  = 'love_alarm_daily_add_date';

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function getDailyAddCount() {
  const savedDate = localStorage.getItem(DAILY_ADD_DATE_KEY);
  const today = getTodayStr();
  if (savedDate !== today) {
    localStorage.setItem(DAILY_ADD_DATE_KEY, today);
    localStorage.setItem(DAILY_ADD_COUNT_KEY, '0');
    return 0;
  }
  return parseInt(localStorage.getItem(DAILY_ADD_COUNT_KEY) || '0', 10);
}

function incrementDailyAddCount() {
  const count = getDailyAddCount();
  localStorage.setItem(DAILY_ADD_COUNT_KEY, String(count + 1));
}

// 리워드 광고 그룹 ID (콘솔에서 발급)
const REWARDED_AD_GROUP_ID = 'ait.v2.live.3c9485e5e7974743';
const CHECKIN30_CLAIMED_KEY = 'love_alarm_checkin30_claimed';

function isAdFree() {
  // localStorage 플래그 (즉시 반영) 또는 서버에서 받은 user 데이터의 adFree 필드
  if (localStorage.getItem(CHECKIN30_CLAIMED_KEY) === 'true') return true;
  try {
    const user = JSON.parse(localStorage.getItem('love_alarm_user') || '{}');
    return user.adFree === true;
  } catch {
    return false;
  }
}

export function AddAlarmPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [myId, setMyId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorToast, setErrorToast] = useState({ show: false, message: '' });
  const [isAdLoaded, setIsAdLoaded] = useState(false);
  const adCleanupRef = useRef(null);

  // 인증된 Instagram 계정 여부
  const verifiedUsername = localStorage.getItem(IG_VERIFIED_KEY) || '';
  const isVerified = !!verifiedUsername;

  // 저장된 인스타그램 ID가 있으면 자동 입력 (localStorage에서)
  useEffect(() => {
    if (isVerified) {
      setMyId(verifiedUsername);
    } else {
      const savedMyId = localStorage.getItem('love_alarm_my_instagram_id');
      if (savedMyId) setMyId(savedMyId);
    }
  }, []);

  // 페이지 진입 시 광고 사전 로드 (Preload) - 검수 필수 요건
  useEffect(() => {
    const preloadAd = async () => {
      try {
        const { GoogleAdMob } = await import('@apps-in-toss/web-framework');
        
        if (GoogleAdMob.loadAppsInTossAdMob.isSupported() !== true) {
          setIsAdLoaded(true); // SDK 미지원 시 로드 완료로 처리
          return;
        }
        
        adCleanupRef.current = GoogleAdMob.loadAppsInTossAdMob({
          options: { adGroupId: REWARDED_AD_GROUP_ID },
          onEvent: (event) => {
            if (event.type === 'loaded') {
              setIsAdLoaded(true);
              adCleanupRef.current?.();
            }
          },
          onError: () => {
            setIsAdLoaded(true); // 로드 실패해도 진행 가능하도록
            adCleanupRef.current?.();
          },
        });
      } catch {
        setIsAdLoaded(true); // 오류 시 로드 완료로 처리
      }
    };
    
    preloadAd();
    
    return () => {
      adCleanupRef.current?.();
    };
  }, []);

  const showErrorToast = (message) => {
    setErrorToast({ show: true, message });
    setTimeout(() => {
      setErrorToast((prev) => ({ ...prev, show: false }));
    }, 3000);
  };

  const handleSubmit = async () => {
    await addAlarm();
  };

  // 리워드 광고 표시 함수 (문서: https://developers-apps-in-toss.toss.im/ads/develop.html)
  const showRewardedAd = async () => {
    // 30일 체크인 보상 수령 시 광고 면제
    if (isAdFree()) {
      return { rewarded: true, skipped: true };
    }

    try {
      const { GoogleAdMob } = await import('@apps-in-toss/web-framework');
      
      // SDK 지원 여부 확인
      if (GoogleAdMob.showAppsInTossAdMob.isSupported() !== true) {
        // SDK 미지원 환경 (로컬 개발 등)
        await new Promise(resolve => setTimeout(resolve, 500));
        return { rewarded: true, skipped: true };
      }
      
      // 사전 로드가 안 됐으면 다시 로드 시도
      if (!isAdLoaded) {
        await new Promise((resolve, reject) => {
          const cleanup = GoogleAdMob.loadAppsInTossAdMob({
            options: { adGroupId: REWARDED_AD_GROUP_ID },
            onEvent: (event) => {
              if (event.type === 'loaded') {
                cleanup?.();
                resolve();
              }
            },
            onError: (error) => {
              cleanup?.();
              reject(error);
            },
          });
        });
      }
      
      // 광고 표시 및 보상 확인
      const result = await new Promise((resolve, reject) => {
        let rewarded = false;
        
        const cleanup = GoogleAdMob.showAppsInTossAdMob({
          options: { adGroupId: REWARDED_AD_GROUP_ID },
          onEvent: (event) => {
            if (event.type === 'userEarnedReward') {
              rewarded = true;
            }
            if (event.type === 'dismissed') {
              cleanup?.();
              resolve({ rewarded });
            }
          },
          onError: (error) => {
            cleanup?.();
            reject(error);
          },
        });
      });
      
      // 광고 표시 후 다음 광고 미리 로드 (load → show → 다음 load)
      setIsAdLoaded(false);
      
      return result;
      
    } catch (error) {
      // 광고 로드 실패 시에도 알람 추가는 진행
      if (error?.code === 'AD_NOT_READY' || error?.code === 'AD_LOAD_FAILED') {
        return { rewarded: true, skipped: true };
      }
      
      // 사용자가 광고를 닫은 경우
      if (error?.code === 'USER_CANCELLED' || error?.message?.includes('cancel')) {
        return { rewarded: false, cancelled: true };
      }
      
      // SDK 미지원 환경 또는 기타 오류
      return { rewarded: true, skipped: true };
    }
  };

  const addAlarm = async () => {
    // ① 하루 추가 제한 체크 (광고 노출 전)
    const dailyLimit = (user?.maxSlots ?? 2) * 2;
    const dailyCount = getDailyAddCount();
    if (dailyCount >= dailyLimit) {
      showErrorToast(`하루 최대 ${dailyLimit}번까지 추가할 수 있어요.`);
      return;
    }

    setIsSubmitting(true);
    try {
      // 2. 리워드 광고 표시
      const adResult = await showRewardedAd();
      
      // 광고를 끝까지 보지 않으면 알람 추가 안 함
      if (!adResult.rewarded) {
        if (adResult.cancelled) {
          showErrorToast('시청을 완료해 주세요');
        }
        setIsSubmitting(false);
        return;
      }
      
      const myIdTrimmed = myId.trim().toLowerCase();
      const targetIdTrimmed = targetId.trim().toLowerCase();
      const messageTrimmed = message.trim() || undefined;

      // 3. localStorage에 본인 ID 저장 (다음 알람 추가 시 기본값으로)
      localStorage.setItem('love_alarm_my_instagram_id', myIdTrimmed);

      // 4. API로 알람 생성 (fromInstagramId + message 포함)
      const result = await api.createAlarm(myIdTrimmed, targetIdTrimmed, messageTrimmed);

      // 5. 성공 시 하루 카운트 증가
      incrementDailyAddCount();
      
      // 6. 최초 알람 등록인지 확인 (알림 팝업 표시 여부)
      const isFirstAlarm = !localStorage.getItem(FIRST_ALARM_REGISTERED_KEY);
      const pushEnabled = user?.pushEnabled ?? false;
      const tossAppEnabled = user?.tossAppEnabled ?? false;
      const shouldShowNotificationSheet = isFirstAlarm && !pushEnabled && !tossAppEnabled;
      
      // 최초 등록 완료 표시
      if (isFirstAlarm) {
        localStorage.setItem(FIRST_ALARM_REGISTERED_KEY, 'true');
      }
      
      // 7. 완료 후 페이지 이동 (replace: true로 히스토리 중복 방지)
      if (result.matched) {
        navigate('/match-success', { 
          replace: true,
          state: { 
            alarmId: result.alarm.id, 
            fromInstagramId: myIdTrimmed,
            targetInstagramId: targetIdTrimmed,
          } 
        });
      } else {
        navigate('/alarms', { 
          replace: true,
          state: { 
            showAddedToast: true,
            showNotificationSheet: shouldShowNotificationSheet 
          } 
        });
      }
    } catch (error) {
      console.error('❌ 알람 추가 실패:', error);
      showErrorToast(error.message || '알람 추가에 실패했어요');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearMyId = () => {
    setMyId('');
  };

  const handleClearTargetId = () => {
    setTargetId('');
  };

  // 인스타그램 ID 유효성 검사
  // - 영문 소문자(a-z), 숫자(0-9), 마침표(.), 밑줄(_) 만 허용
  // - 1~30자
  // - 대문자 입력 시 소문자로 취급 (인스타그램 정책)
  const isInvalidInstagramId = (text) => {
    const trimmed = text.trim().toLowerCase();
    if (!trimmed) return false;
    if (trimmed.length > 30) return true;
    return !/^[a-z0-9._]+$/.test(trimmed);
  };

  // 본인 ID와 상대 ID가 같은지 확인 (대소문자 무시)
  const isSameId = myId.trim() && targetId.trim() && 
    myId.trim().toLowerCase() === targetId.trim().toLowerCase();

  const myIdHasError = isInvalidInstagramId(myId);
  const targetIdHasError = isInvalidInstagramId(targetId) || isSameId;

  // 에러 메시지
  const getMyIdErrorMessage = () => {
    if (isInvalidInstagramId(myId)) {
      return '인스타그램 ID 형식에 맞춰 정확하게 입력해 주세요';
    }
    return null;
  };

  const getTargetIdErrorMessage = () => {
    if (isInvalidInstagramId(targetId)) {
      return '인스타그램 ID 형식에 맞춰 정확하게 입력해 주세요';
    }
    if (isSameId) {
      return '상대 ID는 본인 ID와 같을 수 없어요';
    }
    return null;
  };

  return (
    <div className="add-alarm-page-container">
      <div className="add-alarm-form-content">
      <Spacing size={14} />

      <div className="add-alarm-top-section">
        <Top
          title={
            <Top.TitleParagraph 
              size={22} 
              color={adaptive.grey900}
              fontWeight="bold"
              style={{ fontSize: '22px' }}
            >
              알람 추가
            </Top.TitleParagraph>
          }
          subtitleBottom={
            <div className="add-alarm-subtitle">
              <Text 
                color={adaptive.grey700} 
                typography="t7"
                style={{ 
                  fontSize: '17px', 
                  fontWeight: 500,
                  color: adaptive.grey700 
                }}
              >
                추가해도 상대에게 연락이 가지 않아요.
              </Text>
            </div>
          }
        />
      </div>

      <Spacing size={16} />

      <div className="add-alarm-content">
          {isVerified ? (
            /* 인증된 경우: TDS TextField 동일 스타일, 읽기 전용 */
            <div className="add-alarm-verified-field">
              <TextField
                variant="big"
                label="본인 인스타그램 ID"
                labelOption="sustain"
                value={verifiedUsername}
                disabled
                onChange={() => {}}
                help="인증된 계정으로 적용됐어요. (변경은 '더보기' 메뉴에서)"
              />
            </div>
          ) : (
            <TextField
              variant="big"
              hasError={myIdHasError}
              label="본인 인스타그램 ID"
              labelOption="sustain"
              help={getMyIdErrorMessage()}
              value={myId}
              onChange={(e) => setMyId(e.target.value)}
              placeholder="예: abcd1234"
              right={
                myId ? (
                  <button
                    onClick={handleClearMyId}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    aria-label="지우기"
                  >
                    <Asset.Icon
                      frameShape={Asset.frameShape.CleanW20}
                      backgroundColor="transparent"
                      name="icon-x-mono"
                      color={adaptive.greyOpacity600}
                      aria-hidden={true}
                      ratio="1/1"
                    />
                  </button>
                ) : null
              }
            />
          )}

        <Spacing size={16} />

          <TextField
          variant="big"
          hasError={targetIdHasError}
            label="상대 인스타그램 ID"
          labelOption="sustain"
          help={getTargetIdErrorMessage()}
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          placeholder="예: abcd1234"
          right={
            targetId ? (
              <button
                onClick={handleClearTargetId}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
                aria-label="지우기"
              >
                <Asset.Icon
                  frameShape={Asset.frameShape.CleanW20}
                  backgroundColor="transparent"
                  name="icon-x-mono"
                  color={adaptive.greyOpacity600}
                  aria-hidden={true}
                  ratio="1/1"
          />
              </button>
            ) : null
          }
        />
      </div>

      {/* 메세지 필드는 메세지 기능 검수 시 복원 */}
      </div>

      <div className="add-alarm-cta-section">
        <Button
          size="xlarge"
          display="block"
          onClick={handleSubmit}
          disabled={!myId.trim() || !targetId.trim() || isSubmitting || myIdHasError || targetIdHasError}
          loading={isSubmitting}
        >
          {isAdFree() ? '알람 추가하기' : '광고보고 추가하기'}
        </Button>
      </div>

      {/* 에러 Toast */}
      <div className={`single-toast ${errorToast.show ? 'show' : ''}`}>
        <div className="custom-toast-content">
          <span className="custom-toast-error-icon">!</span>
          <span className="custom-toast-text">{errorToast.message}</span>
        </div>
      </div>

    </div>
  );
}
