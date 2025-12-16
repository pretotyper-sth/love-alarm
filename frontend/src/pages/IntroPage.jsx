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
import './IntroPage.css';

export function IntroPage() {
  const navigate = useNavigate();

  const handleConfirm = () => {
    storage.set('has_visited_intro', true);
    navigate('/alarms');
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
        >
          확인했어요
        </Button>
      </div>
    </div>
  );
}
