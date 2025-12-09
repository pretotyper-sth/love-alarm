import { useState } from 'react';
import { Button, TextField } from '@toss/tds-mobile';
import { useNavigate } from 'react-router-dom';
import { alarmService } from '../utils/alarm';
import { PaymentModal } from '../components/PaymentModal';
import './AddAlarmPage.css';

export function AddAlarmPage() {
  const navigate = useNavigate();
  const [myId, setMyId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isFirstAlarmFree = alarmService.isFirstAlarmFree();
  const alarmCount = alarmService.getAlarmCount();

  const handleSubmit = async () => {
    if (!myId.trim() || !targetId.trim()) {
      alert('인스타그램 ID를 모두 입력해주세요.');
      return;
    }

    // ID 형식 간단 검증 (영문, 숫자, 언더스코어, 점만 허용)
    const idPattern = /^[a-zA-Z0-9._]+$/;
    if (!idPattern.test(myId.trim()) || !idPattern.test(targetId.trim())) {
      alert('ID 형식에 맞춰 정확하게 입력해주세요.');
      return;
    }

    // 첫 알람이 아니고 무료 알람을 이미 사용한 경우 결제 필요
    if (!isFirstAlarmFree && alarmCount > 0) {
      setShowPayment(true);
      return;
    }

    await addAlarm();
  };

  const addAlarm = async () => {
    setIsSubmitting(true);
    try {
      const newAlarm = alarmService.addAlarm(myId, targetId);
      
      // 매칭 확인
      const isMatched = alarmService.checkMatching(newAlarm);
      
      if (isMatched) {
        navigate('/match-success');
      } else {
        navigate('/alarms');
      }
    } catch (error) {
      console.error('알람 추가 실패:', error);
      alert('알람 추가에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentSuccess = () => {
    setShowPayment(false);
    addAlarm();
  };

  return (
    <div className="add-alarm-page">
      <div className="add-alarm-header">
        <h1 className="add-alarm-title">알람 추가</h1>
      </div>

      <div className="add-alarm-content">
        <p className="add-alarm-hint">
          추가해도 상대에게 연락이 가지 않아요.
        </p>

        <div className="form-group">
          <TextField
            variant="box"
            label="본인 인스타그램 ID"
            value={myId}
            onChange={(e) => setMyId(e.target.value)}
            placeholder="heart23"
            helperText="ID 형식에 맞춰 정확하게 입력해주세요."
          />
        </div>

        <div className="form-group">
          <TextField
            variant="box"
            label="상대 인스타그램 ID"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            placeholder="1245d22"
            helperText="ID 형식에 맞춰 정확하게 입력해주세요."
          />
        </div>
      </div>

      <div className="add-alarm-footer">
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="save-button"
        >
          저장하기
        </Button>
      </div>

      {showPayment && (
        <PaymentModal
          onClose={() => setShowPayment(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}

