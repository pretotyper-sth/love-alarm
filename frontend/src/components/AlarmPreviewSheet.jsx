import { useState } from 'react';
import { Text, Button, Spacing } from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { CLONE_COPY } from '../constants/cloneCopy';
import { api } from '../utils/api';
import { logClick } from '../utils/analytics';
import './AlarmPreviewSheet.css';

export function AlarmPreviewSheet({ targetInstagramId, onClose, onSkip }) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handlePreview = async () => {
    setIsLoading(true);
    setError(null);
    logClick('alarm_preview_purchase_click');

    try {
      const data = await api.runAlarmPreview(targetInstagramId);

      if (!data.available) {
        setError(data.reason);
        return;
      }

      await api.purchaseConversationView(data.conversation.id, 'alarm_preview');

      logClick('alarm_preview_purchase_success');
      setResult(data.conversation);
    } catch (err) {
      setError(err.message);
      logClick('alarm_preview_purchase_fail', { reason: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const copy = CLONE_COPY.alarmPreviewSheet;

  if (result) {
    return (
      <>
        <div className="alarm-preview-overlay show" onClick={onClose} />
        <div className="alarm-preview-sheet show">
          <div className="alarm-preview-sheet-header">
            <Text typography="t5" fontWeight="bold" color={adaptive.grey900}>
              AI 대화 시뮬레이션 결과
            </Text>
          </div>

          <Spacing size={16} />

          <div className="alarm-preview-chemistry">
            <div className="alarm-preview-chemistry-score">
              <Text typography="t3" fontWeight="bold" color="#FF6B6B">
                {Math.round(result.chemistryScore)}
              </Text>
              <Text typography="t8" color={adaptive.grey600}>
                / 100
              </Text>
            </div>
            <Text typography="t7" color={adaptive.grey700}>
              케미 점수
            </Text>
          </div>

          <Spacing size={12} />

          {result.summary && (
            <div className="alarm-preview-summary">
              <Text typography="t7" color={adaptive.grey800}>
                {result.summary}
              </Text>
            </div>
          )}

          <Spacing size={16} />

          <div className="alarm-preview-messages">
            {(Array.isArray(result.messages) ? result.messages : [])
              .slice(0, 6)
              .map((msg, i) => (
                <div
                  key={i}
                  className={`alarm-preview-message ${msg.speaker === 'A' ? 'mine' : 'theirs'}`}
                >
                  <Text typography="t8" color={adaptive.grey800}>
                    {msg.message}
                  </Text>
                </div>
              ))}
          </div>

          <Spacing size={20} />

          <Button size="large" display="block" onClick={onClose}>
            확인
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="alarm-preview-overlay show" onClick={onSkip} />
      <div className="alarm-preview-sheet show">
        <div className="alarm-preview-sheet-header">
          <Text
            typography="t5"
            fontWeight="bold"
            color={adaptive.grey900}
            style={{ whiteSpace: 'pre-line' }}
          >
            {copy.title}
          </Text>
        </div>

        <Spacing size={8} />

        <Text typography="t7" color={adaptive.grey600} style={{ whiteSpace: 'pre-line' }}>
          {copy.description}
        </Text>

        {error && (
          <>
            <Spacing size={12} />
            <Text typography="t8" color="#FF4444">
              {error}
            </Text>
          </>
        )}

        <Spacing size={24} />

        <Button
          size="large"
          display="block"
          onClick={handlePreview}
          loading={isLoading}
          disabled={isLoading}
        >
          {copy.ctaPrimary}
        </Button>

        <Spacing size={8} />

        <Button
          size="large"
          display="block"
          variant="weak"
          onClick={onSkip}
          disabled={isLoading}
        >
          {copy.ctaSecondary}
        </Button>
      </div>
    </>
  );
}
