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

export function AddAlarmPage() {
  const navigate = useNavigate();
  const { user, updateInstagramId } = useAuth();
  const [myId, setMyId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorToast, setErrorToast] = useState({ show: false, message: '' });

  // 저장된 인스타그램 ID가 있으면 자동 입력
  useEffect(() => {
    if (user?.instagramId) {
      setMyId(user.instagramId);
    }
  }, [user]);

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

    // ID 형식 간단 검증 (영문, 숫자, 언더스코어, 점만 허용)
    const idPattern = /^[a-zA-Z0-9._]+$/;
    if (!idPattern.test(myId.trim()) || !idPattern.test(targetId.trim())) {
      showErrorToast('ID 형식에 맞춰 정확하게 입력해주세요.');
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
      // 1. 인스타그램 ID 업데이트 (변경된 경우만)
      if (user?.instagramId !== myId.trim()) {
        console.log('📝 인스타그램 ID 업데이트:', myId.trim());
        await updateInstagramId(myId.trim());
      }

      // 2. API로 알람 생성
      console.log('📝 API로 알람 생성:', targetId.trim());
      const result = await api.createAlarm(targetId.trim());
      console.log('✅ 알람 생성 완료:', result);
      
      // 3. 매칭 결과에 따라 페이지 이동
      if (result.matched) {
        console.log('🎉 매칭 성공! /match-success로 이동');
        navigate('/match-success', { state: { alarmId: result.alarm.id } });
      } else {
        console.log('📋 알람 목록(/alarms)으로 이동');
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

  // 한글 포함 여부 확인
  const hasKorean = (text) => {
    return /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text);
  };

  // 본인 ID와 상대 ID가 같은지 확인 (대소문자 무시)
  const isSameId = myId.trim() && targetId.trim() && 
    myId.trim().toLowerCase() === targetId.trim().toLowerCase();

  const myIdHasError = hasKorean(myId);
  const targetIdHasError = hasKorean(targetId) || isSameId;

  // 상대 ID 에러 메시지
  const getTargetIdErrorMessage = () => {
    if (hasKorean(targetId)) {
      return 'ID 형식에 맞춰 정확하게 입력해주세요.';
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
          help={myIdHasError ? "ID 형식에 맞춰 정확하게 입력해주세요." : null}
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
