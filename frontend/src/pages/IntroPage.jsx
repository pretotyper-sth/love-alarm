import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Asset,
  Top,
  Stepper,
  StepperRow,
  Spacing,
  Button,
} from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { storage } from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';
import './IntroPage.css';

export function IntroPage() {
  const navigate = useNavigate();
  const { relogin } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // 최초 화면에서 뒤로가기 시 앱 종료 처리 (검수 필수 요건)
  // 더미 히스토리를 추가하고, popstate 감지 시 앱 종료
  useEffect(() => {
    // 이미 히스토리가 추가되었는지 확인
    if (!window.history.state?.introGuard) {
      window.history.replaceState({ introGuard: true }, '');
      window.history.pushState({ introGuard: true }, '');
    }

    const handlePopState = async (e) => {
      // 인트로 가드 히스토리로 돌아왔으면 앱 종료
      if (e.state?.introGuard || window.history.length <= 2) {
        try {
          const { exitApp } = await import('@apps-in-toss/web-framework');
          await exitApp();
        } catch {
          // SDK 미지원 환경에서는 히스토리 복구
          window.history.pushState({ introGuard: true }, '');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleConfirm = async () => {
    setIsLoading(true);
    
    // 온보딩 완료 표시를 먼저 설정 (토스 앱 복귀 시 앱이 재시작되어도 복구 가능)
    storage.set('has_visited_intro', true);
    
    try {
      // 토스 로그인 수행
      await relogin();
      // 알람 목록으로 이동
      navigate('/alarms');
    } catch (error) {
      // 사용자에게 에러 표시
      alert(`로그인에 실패했어요.\n\n오류: ${error.message || '알 수 없는 오류'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="intro-page-container">
      <Spacing size={14} />

      <div className="intro-top-section">
        <Top
          title={
            <Top.TitleParagraph 
              size={22} 
              color={adaptive.grey900}
              style={{ fontSize: '22px' }}
            >
              사용 방법을 알려드릴게요
            </Top.TitleParagraph>
          }
        />
      </div>

      <Spacing size={16} />

      <div className="intro-image-container">
        <Asset.Image
          frameShape={Asset.frameShape.CleanW250}
          backgroundColor="transparent"
          src="https://static.toss.im/ml-product/heart-coin-calendar.png"
          aria-hidden={true}
          style={{ aspectRatio: '1/1' }}
        />
      </div>

      <Spacing size={8} />

      <Stepper>
        <StepperRow
          left={<StepperRow.NumberIcon number={1} />}
          center={
            <StepperRow.Texts
              type="A"
              title="본인과 상대의 인스타 ID를 입력해요."
              description=""
            />
          }
        />
        <StepperRow
          left={<StepperRow.NumberIcon number={2} />}
          center={
            <StepperRow.Texts
              type="A"
              title="서로의 마음이 같을 때까지 기다려요."
              description=""
            />
          }
        />
        <StepperRow
          left={<StepperRow.NumberIcon number={3} />}
          center={
            <StepperRow.Texts
              type="A"
              title="서로의 마음이 같으면 알람이 울려요."
              description=""
            />
          }
          hideLine={true}
        />
      </Stepper>

      <div className="intro-button-section">
        <Button
          size="xlarge"
          display="block"
          onClick={handleConfirm}
          loading={isLoading}
          disabled={isLoading}
        >
          확인했어요
        </Button>
      </div>
    </div>
  );
}
