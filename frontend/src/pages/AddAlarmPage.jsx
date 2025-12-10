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
// useAuth는 더 이상 필요하지 않음 (본인 ID는 알람별로 localStorage에 저장)
import { api } from '../utils/api';
import './AddAlarmPage.css';

export function AddAlarmPage() {
  const navigate = useNavigate();
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
    console.log('🔍 handleSubmit 시작', { myId, targetId });
    
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

    console.log('✅ 유효성 검증 통과');
    console.log('💾 알람 추가 시작');
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
        navigate('/match-success', { state: { alarmId: result.alarm.id } });
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
      {/* Quick_Navigation - 상단 네비게이션 바 */}
      <div className="quick-navigation">
        {/* Left Container */}
        <div className="nav-left-container">
          {/* Back Button */}
          <button
            className="nav-back-button"
            onClick={() => navigate(-1)}
            aria-label="뒤로가기"
          >
            <Asset.Icon
              frameShape={Asset.frameShape.CleanW24}
              backgroundColor="transparent"
              name="icon-arrow-back-ios-mono"
              color={adaptive.grey900}
              aria-hidden={true}
              ratio="1/1"
            />
          </button>
          {/* Title Area */}
          <div className="nav-title-area">
            <div className="nav-title-content">
              <Asset.Image
                frameShape={Asset.frameShape.CleanW16}
                backgroundColor="transparent"
                src="https://static.toss.im/appsintoss/9737/f6aa6697-d258-40c2-a59f-91f8e8bab8be.png"
                aria-hidden={true}
                style={{ aspectRatio: '1/1' }}
              />
              <Text color={adaptive.grey900} typography="t6" fontWeight="semibold">
                좋아하면 울리는
              </Text>
            </div>
          </div>
        </div>
        {/* Right Container */}
        <div className="nav-right-container">
          {/* Dynamic Icon Area */}
          <div className="nav-dynamic-icon-area">
            <button className="nav-icon-button" aria-label="하트">
              <Asset.Icon
                frameShape={Asset.frameShape.CleanW20}
                backgroundColor="transparent"
                name="icon-heart-mono"
                color={adaptive.greyOpacity600}
                aria-hidden={true}
                ratio="1/1"
              />
            </button>
          </div>
          {/* Fixed Icon Area */}
          <div className="nav-fixed-icon-area">
            <button className="nav-icon-button" aria-label="더보기">
              <Asset.Icon
                frameShape={Asset.frameShape.CleanW20}
                backgroundColor="transparent"
                name="icon-dots-mono"
                color={adaptive.greyOpacity600}
                aria-hidden={true}
                ratio="1/1"
              />
            </button>
            <div className="nav-divider"></div>
            <button className="nav-icon-button" aria-label="닫기">
              <Asset.Icon
                frameShape={Asset.frameShape.CleanW20}
                backgroundColor="transparent"
                name="icon-x-mono"
                color={adaptive.greyOpacity600}
                aria-hidden={true}
                ratio="1/1"
              />
            </button>
          </div>
        </div>
      </div>

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
    </div>
  );
}
