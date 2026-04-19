import { useState, useEffect } from 'react';
import { Top, Spacing } from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { logScreen } from '../utils/analytics';
import './AiDatePage.css';

const CONVERSATION_LINES = [
  { side: 'left', text: '전시 보러 다니는 걸 좋아해요.' },
  { side: 'right', text: '저도요. 요즘은 어떤 전시가 좋았어요?' },
  { side: 'left', text: '조용한 공간에서 천천히 보는 전시를 좋아해요.' },
  { side: 'right', text: '분위기 취향이 비슷하네요. 카페도 좋아하세요?' },
  { side: 'left', text: '네, 주말엔 카페 가서 책 읽는 편이에요.' },
  { side: 'right', text: '대화가 잘 통할 것 같아요.' },
];

export function AiDatePage() {
  const [chatState, setChatState] = useState({
    currentIdx: 0,
    previousIdx: null,
  });

  useEffect(() => {
    logScreen('ai_clone_landing_screen');
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setChatState(prev => ({
        previousIdx: prev.currentIdx,
        currentIdx: (prev.currentIdx + 1) % CONVERSATION_LINES.length,
      }));
    }, 5600);
    return () => clearInterval(t);
  }, []);

  const currentLine = CONVERSATION_LINES[chatState.currentIdx];
  const previousLine = chatState.previousIdx === null
    ? null
    : CONVERSATION_LINES[chatState.previousIdx];

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
          AI 클론이 먼저 대화해보고, 잘 맞는 상대를 보여드려요.
        </p>
      </div>

      <div className="ai-scene-wrap">
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
            <div className="chair-body">
              <img src="/chair.png" alt="내 의자" className="chair-img" />
              <span className="chair-label me">나</span>
            </div>
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
        </div>
      </div>
    </div>
  );
}
