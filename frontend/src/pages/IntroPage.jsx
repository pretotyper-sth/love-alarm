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
      
      // 상세 에러 정보 출력
      const errorDetails = {
        message: error.message,
        name: error.name,
        stack: error.stack?.substring(0, 200),
      };
      console.error('🔐 [IntroPage] 에러 상세:', JSON.stringify(errorDetails));
      
      // 에러 원인에 따른 사용자 안내
      let userMessage = '로그인에 실패했어요.\n\n';
      if (error.message?.includes('mTLS') || error.message?.includes('인증서')) {
        userMessage += '서버 인증서 오류입니다.\n개발팀에 문의해주세요.';
      } else if (error.message?.includes('토큰') || error.message?.includes('token')) {
        userMessage += '토스 인증 처리 중 오류가 발생했어요.\n잠시 후 다시 시도해주세요.';
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        userMessage += '서버에 연결할 수 없어요.\n인터넷 연결을 확인해주세요.';
      } else {
        userMessage += `오류: ${error.message || '알 수 없는 오류'}`;
      }
      
      alert(userMessage);
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
