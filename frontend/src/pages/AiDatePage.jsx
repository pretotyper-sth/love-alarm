import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Top, Spacing, Asset } from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { logScreen } from '../utils/analytics';
import './AiDatePage.css';

const CONVERSATION_SCENARIOS = [
  {
    id: 'gallery-date',
    outcome: 'success',
    outcomeDuration: 6800,
    outcomeAnimationMs: 6800,
    lines: [
      { side: 'left', text: '전시 보는 거 좋아해요.', delay: 4600 },
      { side: 'right', text: '저도요. 조용한 전시를 더 좋아해요.', delay: 4800 },
      { side: 'left', text: '맞아요. 오래 보고 있어도 안 질리더라고요.', delay: 4900 },
      { side: 'right', text: '저는 설명 읽고 다시 보면 더 재밌어요.', delay: 5000 },
      { side: 'left', text: '보고 나서 카페 가서 얘기하는 것도 좋고요.', delay: 5000 },
      { side: 'right', text: '그 시간이 제일 기억에 남죠.', delay: 5000 },
      { side: 'left', text: '뭔가 저랑 잘 맞는 것 같아요.', delay: 5000 },
    ],
  },
  {
    id: 'weekend-routine',
    outcome: 'success',
    outcomeDuration: 7000,
    outcomeAnimationMs: 7000,
    lines: [
      { side: 'right', text: '주말엔 보통 뭐 하세요?', delay: 4600 },
      { side: 'left', text: '산책하고 커피 마시는 걸 좋아해요.', delay: 4800 },
      { side: 'right', text: '저도요. 그냥 천천히 걷는 시간이 좋더라고요.', delay: 5000 },
      { side: 'left', text: '걷다가 예쁜 가게 보이면 들어가고요.', delay: 4900 },
      { side: 'right', text: '그런 날은 하루가 길게 남는 느낌이에요.', delay: 5100 },
      { side: 'left', text: '이런 건 잘 맞을 것 같네요.', delay: 5000 },
      { side: 'right', text: '같이 있으면 편할 것 같아요.', delay: 5000 },
    ],
  },
  {
    id: 'travel-style',
    outcome: 'fail',
    outcomeDuration: 6800,
    outcomeAnimationMs: 6800,
    lines: [
      { side: 'left', text: '여행 가면 일정을 꽤 꼼꼼히 짜는 편이에요.', delay: 4900 },
      { side: 'right', text: '저는 반대예요. 좀 즉흥적으로 다니는 걸 좋아해요.', delay: 5100 },
      { side: 'left', text: '저는 예약이 없으면 조금 불안하거든요.', delay: 5000 },
      { side: 'right', text: '저는 오히려 비어 있어야 마음이 편해요.', delay: 5100 },
      { side: 'left', text: '같이 가면 제가 자꾸 재촉할 수도 있겠네요.', delay: 5100 },
      { side: 'right', text: '그러면 저는 조금 지칠 것 같아요. 이건 좀 다르네요.', delay: 5300 },
    ],
  },
];

const SCENARIO_TRANSITION_DELAY = 650;
const OUTCOME_FADE_OUT_DELAY = 520;
const BUBBLE_FADE_OUT_LEAD = 310;

export function AiDatePage() {
  const navigate = useNavigate();
  const methodSectionRef = useRef(null);
  const [isMethodOpen, setIsMethodOpen] = useState(false);
  const [conversationState, setConversationState] = useState({
    scenarioIdx: 0,
    lineIdx: 0,
    previousLineIdx: null,
    isShowingOutcome: false,
    isClosingBubbles: false,
    isClosingOutcome: false,
    isTransitioning: false,
  });

  useEffect(() => {
    logScreen('ai_clone_landing_screen');
  }, []);

  useEffect(() => {
    if (!isMethodOpen) {
      return undefined;
    }

    const t = setTimeout(() => {
      methodSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 120);

    return () => clearTimeout(t);
  }, [isMethodOpen]);

  useEffect(() => {
    const currentScenario = CONVERSATION_SCENARIOS[conversationState.scenarioIdx];

    if (conversationState.isShowingOutcome) {
      const bubbleFadeStartAt = Math.max(
        currentScenario.outcomeDuration - OUTCOME_FADE_OUT_DELAY - BUBBLE_FADE_OUT_LEAD,
        0
      );
      const outcomeFadeStartAt = Math.max(currentScenario.outcomeDuration - OUTCOME_FADE_OUT_DELAY, 0);

      const bubbleFadeTimer = setTimeout(() => {
        setConversationState((prev) => ({
          ...prev,
          isClosingBubbles: true,
        }));
      }, bubbleFadeStartAt);

      const outcomeFadeTimer = setTimeout(() => {
        setConversationState((prev) => ({
          ...prev,
          isClosingOutcome: true,
        }));
      }, outcomeFadeStartAt);

      const t = setTimeout(() => {
        setConversationState((prev) => ({
          scenarioIdx: (prev.scenarioIdx + 1) % CONVERSATION_SCENARIOS.length,
          lineIdx: 0,
          previousLineIdx: null,
          isShowingOutcome: false,
          isClosingBubbles: false,
          isClosingOutcome: false,
          isTransitioning: true,
        }));
      }, currentScenario.outcomeDuration);

      return () => {
        clearTimeout(bubbleFadeTimer);
        clearTimeout(outcomeFadeTimer);
        clearTimeout(t);
      };
    }

    if (conversationState.isTransitioning) {
      const t = setTimeout(() => {
        setConversationState((prev) => ({
          ...prev,
          isTransitioning: false,
        }));
      }, SCENARIO_TRANSITION_DELAY);

      return () => clearTimeout(t);
    }

    const currentLine = currentScenario.lines[conversationState.lineIdx];
    const t = setTimeout(() => {
      setConversationState((prev) => {
        const activeScenario = CONVERSATION_SCENARIOS[prev.scenarioIdx];
        const isLastLine = prev.lineIdx === activeScenario.lines.length - 1;

        if (isLastLine) {
          return {
            ...prev,
            isShowingOutcome: true,
            isClosingBubbles: false,
            isClosingOutcome: false,
          };
        }

        return {
          ...prev,
          lineIdx: prev.lineIdx + 1,
          previousLineIdx: prev.lineIdx,
        };
      });
    }, currentLine?.delay ?? 2800);

    return () => clearTimeout(t);
  }, [
    conversationState.scenarioIdx,
    conversationState.lineIdx,
    conversationState.isShowingOutcome,
    conversationState.isTransitioning,
  ]);

  const currentScenario = CONVERSATION_SCENARIOS[conversationState.scenarioIdx];
  const currentLine = currentScenario.lines[conversationState.lineIdx];
  const previousLine = conversationState.previousLineIdx === null
    ? null
    : currentScenario.lines[conversationState.previousLineIdx];
  const isSuccessOutcome = currentScenario.outcome === 'success';

  return (
    <div className="ai-page">
      <Spacing size={14} />

      <div className="ai-top-section">
        <Top
          title={
            <Top.TitleParagraph size={22} color={adaptive.grey900} style={{ fontSize: '22px' }}>
              AI 클론
            </Top.TitleParagraph>
          }
        />
        <p className="ai-page-subtitle">
          내 취향을 닮은 AI 클론을 만들고 대화를 지켜봐요.
          <br />
          상대와의 케미를 먼저 살펴볼 수 있어요.
        </p>
      </div>

      <div className="ai-scene-wrap">
        <div className="ai-scene-stack">
          <div className="chairs-scene">
            <div className="chair-slot chair-slot-left">
              {!conversationState.isTransitioning && previousLine?.side === 'left' ? (
                <div
                  key={`${currentScenario.id}-prev-left-${conversationState.previousLineIdx}-${conversationState.isClosingBubbles ? 'closing' : 'open'}`}
                  className={`bubble bubble-left bubble-previous${conversationState.isClosingBubbles ? ' is-closing' : ''}`}
                >
                  {previousLine.text}
                </div>
              ) : null}
              {!conversationState.isTransitioning && currentLine.side === 'left' ? (
                <div
                  key={`${currentScenario.id}-current-left-${conversationState.lineIdx}-${conversationState.isClosingBubbles ? 'closing' : 'open'}`}
                  className={`bubble bubble-left bubble-current${conversationState.isClosingBubbles ? ' is-closing' : ''}`}
                >
                  {currentLine.text}
                </div>
              ) : null}
              <button
                type="button"
                className="chair-body chair-body-button"
                onClick={() => navigate('/clone')}
                aria-label="나 의자 선택하고 AI 클론 만들기"
              >
                <img src="/chair.png" alt="내 의자" className="chair-img" />
                <span className="chair-label me">나</span>
              </button>
            </div>

            <div className="chair-slot chair-slot-right">
              {!conversationState.isTransitioning && previousLine?.side === 'right' ? (
                <div
                  key={`${currentScenario.id}-prev-right-${conversationState.previousLineIdx}-${conversationState.isClosingBubbles ? 'closing' : 'open'}`}
                  className={`bubble bubble-right bubble-previous${conversationState.isClosingBubbles ? ' is-closing' : ''}`}
                >
                  {previousLine.text}
                </div>
              ) : null}
              {!conversationState.isTransitioning && currentLine.side === 'right' ? (
                <div
                  key={`${currentScenario.id}-current-right-${conversationState.lineIdx}-${conversationState.isClosingBubbles ? 'closing' : 'open'}`}
                  className={`bubble bubble-right bubble-current${conversationState.isClosingBubbles ? ' is-closing' : ''}`}
                >
                  {currentLine.text}
                </div>
              ) : null}
              <div className="chair-body">
                <img src="/chair.png" alt="상대 의자" className="chair-img chair-mirror" />
                <span className="chair-label other">상대</span>
              </div>
            </div>
            {conversationState.isShowingOutcome ? (
              <div
                className={`chemistry-heart${isSuccessOutcome ? '' : ' is-soft-fail'}${conversationState.isClosingOutcome ? ' is-closing' : ''}`}
                style={{ '--heart-duration': `${currentScenario.outcomeAnimationMs ?? 5200}ms` }}
                aria-hidden
              >
                {isSuccessOutcome ? (
                  <img
                    src="https://static.toss.im/3d-emojis/u2764-apng.png"
                    alt="❤️"
                    className="chemistry-heart-badge"
                  />
                ) : (
                  <span className="chemistry-soft-fail-badge" aria-hidden>
                    🤔
                  </span>
                )}
              </div>
            ) : null}
          </div>

          <div className="seat-preview-cta">
            <span className="seat-preview-cta-arrow" aria-hidden>
              <Asset.Icon
                frameShape={Asset.frameShape.CleanW24}
                backgroundColor="transparent"
                name="icon-arrow-down-mono"
                color="#3182f6"
                ratio="1/1"
                aria-hidden
              />
            </span>
            <p className="seat-preview-cta-copy">
              <span className="seat-preview-cta-copy-muted">현재는 미리보기 상태예요.</span>
              <span className="seat-preview-cta-copy-strong">잘 맞는 상대가 궁금하다면, 지금 만들어보세요.</span>
            </p>
            <button
              type="button"
              className={`ai-method-trigger seat-preview-method-trigger ${isMethodOpen ? 'active' : ''}`}
              onClick={() => setIsMethodOpen(prev => !prev)}
              aria-expanded={isMethodOpen}
            >
              AI 클론이 뭔가요?
            </button>
            {isMethodOpen ? (
              <div className="ai-method-section" ref={methodSectionRef}>
                <div className="ai-method-panel">
                  <div className="ai-method-card">
                    <strong className="ai-method-card-title">AI 클론이란</strong>
                    <p className="ai-method-card-text">
                      공개된 정보를 바탕으로 나를 닮은 대화 스타일을 먼저 보여주는 프로필이에요.
                    </p>
                  </div>
                  <div className="ai-method-card">
                    <strong className="ai-method-card-title">어떻게 만들어요?</strong>
                    <p className="ai-method-card-text">
                      인스타그램 ID를 인증하면 공개된 프로필과 게시물을 바탕으로 취향, 말투, 대화 분위기를 반영해 AI 클론을 만들어요.
                    </p>
                  </div>
                  <div className="ai-method-card">
                    <strong className="ai-method-card-title">무엇을 보나요</strong>
                    <p className="ai-method-card-text">
                      상대와 먼저 대화를 나눠보며 흐름과 케미를 미리 살펴봐요.
                    </p>
                  </div>
                  <div className="ai-method-card">
                    <strong className="ai-method-card-title">알아둘 점</strong>
                    <p className="ai-method-card-text">
                      비공개 계정은 공개 정보가 없어 AI 클론을 만들 수 없어요.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
