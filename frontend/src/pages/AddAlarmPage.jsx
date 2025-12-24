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

export function AddAlarmPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [myId, setMyId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorToast, setErrorToast] = useState({ show: false, message: '' });
  const [showNotificationSheet, setShowNotificationSheet] = useState(false);
  const [pendingAlarmData, setPendingAlarmData] = useState(null);

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
    if (!myId.trim() || !targetId.trim()) {
      showErrorToast('인스타그램 ID를 모두 입력해주세요.');
      return;
    }

    // 인스타그램 ID 형식 검증
    const idPattern = /^[a-z0-9._]+$/;
    const myIdLower = myId.trim().toLowerCase();
    const targetIdLower = targetId.trim().toLowerCase();
    
    if (!idPattern.test(myIdLower) || myIdLower.length > 30 ||
        !idPattern.test(targetIdLower) || targetIdLower.length > 30) {
      showErrorToast('인스타그램 ID 형식에 맞춰 정확하게 입력해주세요.');
      return;
    }

    // 본인 ID와 상대 ID가 같으면 제한
    if (myId.trim().toLowerCase() === targetId.trim().toLowerCase()) {
      showErrorToast('상대 ID는 본인 ID와 같을 수 없어요.');
      return;
    }

    // 최초 알람 등록인지 확인
    const isFirstAlarm = !localStorage.getItem(FIRST_ALARM_REGISTERED_KEY);
    
    // 최초 등록이고 알림이 아직 활성화되지 않았으면 팝업 표시
    // user 객체에서 알림 설정 확인
    const pushEnabled = user?.pushEnabled ?? false;
    const tossAppEnabled = user?.tossAppEnabled ?? false;
    
    if (isFirstAlarm && !pushEnabled && !tossAppEnabled) {
      setPendingAlarmData({ myId: myIdLower, targetId: targetIdLower });
      setShowNotificationSheet(true);
      return;
    }

    await addAlarm();
  };

  // 알림 동의하기 클릭
  const handleNotificationAgree = async () => {
    try {
      // 알림 설정 켜기 (API 호출)
      const updatedUser = await api.updateSettings({ 
        pushEnabled: true, 
        tossAppEnabled: true 
      });
      setUser(updatedUser);
    } catch (error) {
      console.error('Failed to update notification settings:', error);
    }
    
    // 최초 등록 완료 표시
    localStorage.setItem(FIRST_ALARM_REGISTERED_KEY, 'true');
    // 팝업 닫기
    setShowNotificationSheet(false);
    // 알람 저장
    await addAlarm();
  };

  // 알림 닫기 클릭 (동의 안 함)
  const handleNotificationClose = async () => {
    // 최초 등록 완료 표시 (다시 팝업 안 뜨게)
    localStorage.setItem(FIRST_ALARM_REGISTERED_KEY, 'true');
    // 팝업 닫기
    setShowNotificationSheet(false);
    // 알람은 저장
    await addAlarm();
  };

  const addAlarm = async () => {
    setIsSubmitting(true);
    try {
      const myIdTrimmed = myId.trim().toLowerCase();
      const targetIdTrimmed = targetId.trim().toLowerCase();

      // 1. localStorage에 본인 ID 저장 (다음 알람 추가 시 기본값으로)
      localStorage.setItem('love_alarm_my_instagram_id', myIdTrimmed);

      // 2. API로 알람 생성 (fromInstagramId 포함)
      const result = await api.createAlarm(myIdTrimmed, targetIdTrimmed);
      
      // 3. 완료 후 페이지 이동
      if (result.matched) {
        navigate('/match-success', { state: { alarmId: result.alarm.id, targetInstagramId: targetIdTrimmed } });
      } else {
        navigate('/alarms', { state: { showAddedToast: true } });
      }
    } catch (error) {
      console.error('❌ 알람 추가 실패:', error);
      showErrorToast(error.message || '알람 추가에 실패했습니다.');
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
      return '인스타그램 ID 형식에 맞춰 정확하게 입력해주세요.';
    }
    return null;
  };

  const getTargetIdErrorMessage = () => {
    if (isInvalidInstagramId(targetId)) {
      return '인스타그램 ID 형식에 맞춰 정확하게 입력해주세요.';
    }
    if (isSameId) {
      return '상대 ID는 본인 ID와 같을 수 없어요.';
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
          저장하기
        </Button>
      </div>

      {/* 에러 Toast */}
      <div className={`single-toast ${errorToast.show ? 'show' : ''}`}>
        <div className="custom-toast-content">
          <span className="custom-toast-error-icon">!</span>
          <span className="custom-toast-text">{errorToast.message}</span>
        </div>
      </div>

      {/* 알림 허용 BottomSheet - limit sheet 형식 */}
      <div className={`custom-bottom-sheet-overlay ${showNotificationSheet ? 'show' : ''}`} onClick={handleNotificationClose}>
        <div className={`custom-bottom-sheet ${showNotificationSheet ? 'show' : ''}`} onClick={(e) => e.stopPropagation()}>
          <div className="bottom-sheet-header">
            <h3 className="bottom-sheet-title">알림 받기</h3>
            <p className="bottom-sheet-description">알람이 추가됐어요.<br />상대 마음도 같다면 바로 알려드릴게요.</p>
          </div>
          <div className="bottom-sheet-content">
            <img 
              src="https://static.toss.im/3d-emojis/u1F514-apng.png" 
              alt="알림" 
              className="bottom-sheet-image"
            />
          </div>
          <div className="bottom-sheet-cta bottom-sheet-cta-double">
            <Button
              size="large"
              display="block"
              color="dark"
              variant="weak"
              onClick={handleNotificationClose}
              style={{
                '--button-background-color': '#f2f4f6',
                '--button-color': '#6b7684',
                flex: 1,
              }}
            >
              나중에 하기
            </Button>
            <Button
              size="large"
              display="block"
              onClick={handleNotificationAgree}
              style={{ flex: 1 }}
            >
              동의하기
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
