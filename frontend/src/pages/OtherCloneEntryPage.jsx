import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Top,
  Text,
  Spacing,
  Button,
} from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import './CloneManagePage.css';
import './OtherCloneSelectPage.css';

const OTHER_CLONE_METHODS = [
  {
    id: 'specific',
    title: '특정 ID 지정하기',
    description: '알고 싶은 상대를 직접 고르고\n내 클론과의 대화 흐름을 먼저 확인해요.',
  },
  {
    id: 'random',
    title: '랜덤으로 진행하기',
    description: '지금 대화 가능한 클론 중에서\n잘 맞을 만한 상대를 자동으로 찾아볼게요.',
  },
];

export function OtherCloneEntryPage() {
  const navigate = useNavigate();
  const [selectedMethod, setSelectedMethod] = useState('');

  const handleContinue = () => {
    if (selectedMethod === 'specific') {
      navigate('/other-clone/specific');
      return;
    }

    if (selectedMethod === 'random') {
      navigate('/ai-clone', {
        replace: true,
        state: { otherCloneAction: 'random' },
      });
    }
  };

  return (
    <div className="add-alarm-page-container">
      <div className="add-alarm-form-content">
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
                상대 클론 만나기
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
                    color: adaptive.grey700,
                  }}
                >
                  상대를 직접 고르거나, 잘 맞을 만한 클론을 자동으로 찾아볼 수 있어요.
                </Text>
              </div>
            }
          />
        </div>

        <Spacing size={20} />

        <div className="clone-summary-options other-clone-method-options" role="radiogroup" aria-label="상대 클론 진행 방식">
          {OTHER_CLONE_METHODS.map((method) => (
            <button
              key={method.id}
              type="button"
              role="radio"
              aria-checked={selectedMethod === method.id}
              className={`clone-summary-option other-clone-method-option${selectedMethod === method.id ? ' selected' : ''}`}
              onClick={() => setSelectedMethod(method.id)}
            >
              <div className="other-clone-method-copy">
                <strong>{method.title}</strong>
                <small>{method.description}</small>
              </div>
              <span className={`clone-summary-check other-clone-method-check${selectedMethod === method.id ? '' : ' hidden'}`} aria-hidden>
                ✓
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="add-alarm-cta-section">
        <Button
          size="xlarge"
          display="block"
          onClick={handleContinue}
          disabled={!selectedMethod}
        >
          계속하기
        </Button>
      </div>
    </div>
  );
}
