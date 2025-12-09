import { Button } from '@toss/tds-mobile';
import { useNavigate } from 'react-router-dom';
import { storage } from '../../utils/storage';
import './IntroPage.css';

export function IntroPage() {
  const navigate = useNavigate();

  const handleConfirm = () => {
    storage.set('has_visited_intro', true);
    navigate('/alarms');
  };

  return (
    <div className="intro-page">
      <div className="intro-content">
        <h1 className="intro-title">사용 방법을 알려드릴게요</h1>
        
        <div className="intro-illustration">
          <div className="calendar-icon">
            <div className="calendar-heart">❤️</div>
          </div>
        </div>

        <div className="intro-steps">
          <div className="step">
            <div className="step-number">1</div>
            <div className="step-text">본인과 상대의 인스타 ID를 입력해요.</div>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <div className="step-text">서로의 마음이 같을 때까지 기다려요.</div>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <div className="step-text">서로의 마음이 같으면 알람이 울려요.</div>
          </div>
        </div>
      </div>

      <div className="intro-footer">
        <Button onClick={handleConfirm}>
          확인했어요
        </Button>
      </div>
    </div>
  );
}

