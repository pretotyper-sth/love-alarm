import { useNavigate } from 'react-router-dom';
import { Button } from '@toss/tds-mobile';
import { Confetti } from '../components/Confetti';
import './MatchSuccessPage.css';

export function MatchSuccessPage() {
  const navigate = useNavigate();

  const handleConfirm = () => {
    navigate('/alarms');
  };

  return (
    <div className="match-success-page">
      <Confetti />
      <div className="match-success-content">
        <div className="match-emoji">🎉</div>
        <h1 className="match-title">서로의 마음을 확인했어요</h1>
        <p className="match-subtitle">
          이 화면을 핑계로 연락해 보세요. 망설일 필요 없어요!
        </p>
      </div>
      <div className="match-success-footer">
        <Button onClick={handleConfirm}>
          확인했어요
        </Button>
      </div>
    </div>
  );
}

