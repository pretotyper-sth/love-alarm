import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Top, Spacing, Asset } from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { logScreen } from '../utils/analytics';
import './AiDatePage.css';

const CONVERSATION_LINES = [
  { scene: 'gallery', side: 'left', text: '전시 보는 걸 좋아해요.', delay: 2400 },
  { scene: 'gallery', side: 'right', text: '저도요. 조용한 전시가 좋더라고요.', delay: 2800 },
  { scene: 'gallery', side: 'left', text: '맞아요. 오래 보고 있어도 안 지루해요.', delay: 2900 },
  { scene: 'gallery', side: 'right', text: '보고 나서 카페 가는 코스도 좋아하세요?', delay: 3000 },
  { scene: 'gallery', side: 'left', text: '좋아해요. 그때 얘기가 제일 길어져요.', delay: 3000 },
  { scene: 'gallery', side: 'right', text: '그럼 저희 대화도 잘 통할 것 같아요.', delay: 7600, showHeart: true, heartDuration: 6600, heartAnimationMs: 6600 },
  { scene: 'gallery', side: 'left', text: '저도요. 벌써 편한 느낌이에요.', delay: 2800 },
  { scene: 'gallery', side: 'right', text: '실제로 만나도 안 어색하겠네요.', delay: 2900 },
  { scene: 'weekend', side: 'right', text: '주말엔 산책하고 커피 마시는 걸 좋아해요.', delay: 3200 },
  { scene: 'weekend', side: 'left', text: '저도요. 천천히 걷는 시간이 좋죠.', delay: 3000 },
  { scene: 'weekend', side: 'right', text: '걷다가 마음에 드는 곳 들르는 것도요.', delay: 3100 },
  { scene: 'weekend', side: 'left', text: '맞아요. 그러면 하루가 길게 남아요.', delay: 3000 },
  { scene: 'weekend', side: 'right', text: '취향이 꽤 비슷하네요.', delay: 2800 },
  { scene: 'weekend', side: 'left', text: '같이 있으면 편할 것 같아요.', delay: 3000 },
  { scene: 'weekend', side: 'right', text: '그럼 우리 잘 맞을 것 같아요.', delay: 8000, showHeart: true, heartDuration: 7000, heartAnimationMs: 7000 },
  { scene: 'weekend', side: 'left', text: '맞아요. 더 얘기해보고 싶어요.', delay: 2900 },
  { scene: 'weekend', side: 'right', text: '저도요. 오래 대화하고 싶어요.', delay: 3100 },
];

export function AiDatePage() {
  const navigate = useNavigate();
  const [isMethodOpen, setIsMethodOpen] = useState(false);
  const [chatState, setChatState] = useState({
    currentIdx: 0,
    previousIdx: null,
  });
  const [hiddenHeartIdx, setHiddenHeartIdx] = useState(null);

  useEffect(() => {
    logScreen('ai_clone_landing_screen');
  }, []);

  useEffect(() => {
    const currentConversation = CONVERSATION_LINES[chatState.currentIdx];
    const t = setTimeout(() => {
      setChatState(prev => ({
        currentIdx: (prev.currentIdx + 1) % CONVERSATION_LINES.length,
        previousIdx: (() => {
          const nextIdx = (prev.currentIdx + 1) % CONVERSATION_LINES.length;
          const previousConversation = CONVERSATION_LINES[prev.currentIdx];
          const nextConversation = CONVERSATION_LINES[nextIdx];

          if (nextIdx === 0 || previousConversation.scene !== nextConversation.scene) {
            return null;
          }

          return prev.currentIdx;
        })(),
      }));
    }, currentConversation?.delay ?? 2800);
    return () => clearTimeout(t);
  }, [chatState.currentIdx]);

  useEffect(() => {
    const currentConversation = CONVERSATION_LINES[chatState.currentIdx];
    if (!currentConversation?.showHeart) {
      return undefined;
    }

    const t = setTimeout(() => {
      setHiddenHeartIdx(chatState.currentIdx);
    }, currentConversation.heartDuration ?? 3600);

    return () => clearTimeout(t);
  }, [chatState.currentIdx]);

  const currentLine = CONVERSATION_LINES[chatState.currentIdx];
  const previousLine = chatState.previousIdx === null
    ? null
    : CONVERSATION_LINES[chatState.previousIdx];
  const isHeartVisible = Boolean(currentLine.showHeart) && hiddenHeartIdx !== chatState.currentIdx;

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
              {previousLine?.side === 'left' ? (
                <div className="bubble bubble-left bubble-previous">
                  {previousLine.text}
                </div>
              ) : null}
              {currentLine.side === 'left' ? (
                <div className="bubble bubble-left bubble-current">
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
              {previousLine?.side === 'right' ? (
                <div className="bubble bubble-right bubble-previous">
                  {previousLine.text}
                </div>
              ) : null}
              {currentLine.side === 'right' ? (
                <div className="bubble bubble-right bubble-current">
                  {currentLine.text}
                </div>
              ) : null}
              <div className="chair-body">
                <img src="/chair.png" alt="상대 의자" className="chair-img chair-mirror" />
                <span className="chair-label other">상대</span>
              </div>
            </div>
            {isHeartVisible ? (
              <div
                className="chemistry-heart"
                style={{ '--heart-duration': `${currentLine.heartAnimationMs ?? currentLine.heartDuration ?? 5200}ms` }}
                aria-hidden
              >
                <img
                  src="https://static.toss.im/3d-emojis/u2764-apng.png"
                  alt="❤️"
                  className="chemistry-heart-badge"
                />
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
              <div className="ai-method-section">
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
