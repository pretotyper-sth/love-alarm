import { useState, useEffect } from 'react';
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

// 리워드 광고 그룹 ID (콘솔에서 발급)
const REWARDED_AD_GROUP_ID = 'ait.v2.live.3c9485e5e7974743';

export function AddAlarmPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [myId, setMyId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorToast, setErrorToast] = useState({ show: false, message: '' });

  // 저장된 인스타그램 ID가 있으면 자동 입력 (localStorage에서)
  useEffect(() => {
    const savedMyId = localStorage.getItem('love_alarm_my_instagram_id');
    if (savedMyId) {
      setMyId(savedMyId);
    }
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

  // 리워드 광고 표시 함수
  const showRewardedAd = async () => {
    try {
      // 토스 앱 환경인지 확인
      const isInTossApp = typeof window !== 'undefined' && 
        (window.__GRANITE_ENV__ || window.appsInToss);
      
      if (!isInTossApp) {
        // 개발 환경에서는 광고 시뮬레이션
        console.log('📺 [개발 환경] 리워드 광고 시뮬레이션');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { rewarded: true };
      }
      
      // @apps-in-toss/web-framework에서 Ad 모듈 동적 import
      const { Ad } = await import('@apps-in-toss/web-framework');
      
      console.log('📺 리워드 광고 로드 시작:', REWARDED_AD_GROUP_ID);
      
      // 광고 로드
      await Ad.loadRewardedAd({
        adGroupId: REWARDED_AD_GROUP_ID,
      });
      
      console.log('📺 리워드 광고 표시');
      
      // 광고 표시 및 결과 반환
      const result = await Ad.showRewardedAd({
        adGroupId: REWARDED_AD_GROUP_ID,
      });
      
      console.log('📺 리워드 광고 결과:', result);
      return result;
      
    } catch (error) {
      console.error('📺 리워드 광고 오류:', error);
      
      // 광고 로드 실패 시에도 알람 추가는 진행
      // (광고가 없거나 네트워크 오류 등)
      if (error?.code === 'AD_NOT_READY' || error?.code === 'AD_LOAD_FAILED') {
        console.log('📺 광고 로드 실패, 알람 추가 진행');
        return { rewarded: true, skipped: true };
      }
      
      // 사용자가 광고를 닫은 경우
      if (error?.code === 'USER_CANCELLED' || error?.message?.includes('cancel')) {
        console.log('📺 사용자가 광고를 닫음');
        return { rewarded: false, cancelled: true };
      }
      
      // 기타 오류는 알람 추가 진행
      return { rewarded: true, error: true };
    }
  };

  const addAlarm = async () => {
    setIsSubmitting(true);
    try {
      // 1. 리워드 광고 표시
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

      // 2. localStorage에 본인 ID 저장 (다음 알람 추가 시 기본값으로)
      localStorage.setItem('love_alarm_my_instagram_id', myIdTrimmed);

      // 3. API로 알람 생성 (fromInstagramId 포함)
      const result = await api.createAlarm(myIdTrimmed, targetIdTrimmed);
      
      // 4. 최초 알람 등록인지 확인 (알림 팝업 표시 여부)
      const isFirstAlarm = !localStorage.getItem(FIRST_ALARM_REGISTERED_KEY);
      const pushEnabled = user?.pushEnabled ?? false;
      const tossAppEnabled = user?.tossAppEnabled ?? false;
      const shouldShowNotificationSheet = isFirstAlarm && !pushEnabled && !tossAppEnabled;
      
      // 최초 등록 완료 표시
      if (isFirstAlarm) {
        localStorage.setItem(FIRST_ALARM_REGISTERED_KEY, 'true');
      }
      
      // 5. 완료 후 페이지 이동
      if (result.matched) {
        navigate('/match-success', { state: { alarmId: result.alarm.id, targetInstagramId: targetIdTrimmed } });
      } else {
        navigate('/alarms', { 
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
          <TextField
          variant="big"
          hasError={myIdHasError}
            label="본인 인스타그램 ID"
          labelOption="sustain"
          help={getMyIdErrorMessage()}
            value={myId}
            onChange={(e) => setMyId(e.target.value)}
          placeholder="예: abcd1234"
          autoFocus={true}
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

      <div className="add-alarm-button-section">
        <Button
          size="xlarge"
          display="block"
          onClick={handleSubmit}
          disabled={!myId.trim() || !targetId.trim() || isSubmitting || myIdHasError || targetIdHasError}
          loading={isSubmitting}
        >
          추가하기
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
