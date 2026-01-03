import { useState } from 'react';
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

  const handleConfirm = async () => {
    console.log('🔐 [IntroPage] 확인했어요 버튼 클릭');
    setIsLoading(true);
    try {
      console.log('🔐 [IntroPage] 토스 로그인 시작...');
      // 토스 로그인 수행 - 여기서 토스 동의 화면이 떠야 함
      await relogin();
      console.log('🔐 [IntroPage] 토스 로그인 성공!');
      // 온보딩 완료 표시
      storage.set('has_visited_intro', true);
      // 알람 목록으로 이동
      navigate('/alarms');
    } catch (error) {
      console.error('🔐 [IntroPage] 로그인 실패:', error);
      // 로그인 실패 시 에러 표시 (프로덕션에서는 로그인 필수)
      alert('로그인에 실패했습니다: ' + (error.message || '알 수 없는 오류'));
      // 실패해도 진행하지 않음 - 로그인 필수
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
