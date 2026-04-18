import { useState, useEffect, useRef } from 'react';
import { Text, Spacing } from '@toss/tds-mobile';
import './AiDatePage.css';

// ── 쿼터뷰(아이소메트릭) 씬 상수 ──────────────────────────────────────────
const SCENE_W = 340;
const SCENE_H = 300;

// 바닥 타일 그리드 (4×5)
const TILE_W = 64;
const TILE_H = 32;

function isoToScreen(col, row) {
  const x = SCENE_W / 2 + (col - row) * (TILE_W / 2);
  const y = 40 + (col + row) * (TILE_H / 2);
  return { x, y };
}

// ── 타일 컴포넌트 ────────────────────────────────────────────────────────────
function Tile({ col, row }) {
  const { x, y } = isoToScreen(col, row);
  const pts = [
    `${x},${y}`,
    `${x + TILE_W / 2},${y + TILE_H / 2}`,
    `${x},${y + TILE_H}`,
    `${x - TILE_W / 2},${y + TILE_H / 2}`,
  ].join(' ');
  const isAlt = (col + row) % 2 === 0;
  return (
    <polygon
      points={pts}
      fill={isAlt ? '#f5f0ff' : '#ede8fb'}
      stroke="#d8d0f0"
      strokeWidth="0.5"
    />
  );
}

// ── 의자 컴포넌트 (쿼터뷰) ──────────────────────────────────────────────────
function Chair({ cx, cy, color, label }) {
  const legColor = color === '#ff9fc8' ? '#d97faa' : '#5b9fd4';
  const seatColor = color;
  const backColor = color === '#ff9fc8' ? '#ffb8d8' : '#7ab8e8';

  return (
    <g>
      {/* 다리 4개 */}
      <line x1={cx - 10} y1={cy + 4} x2={cx - 10} y2={cy + 20} stroke={legColor} strokeWidth="3" strokeLinecap="round" />
      <line x1={cx + 10} y1={cy + 4} x2={cx + 10} y2={cy + 20} stroke={legColor} strokeWidth="3" strokeLinecap="round" />
      <line x1={cx - 6} y1={cy - 2} x2={cx - 6} y2={cy + 16} stroke={legColor} strokeWidth="3" strokeLinecap="round" />
      <line x1={cx + 6} y1={cy - 2} x2={cx + 6} y2={cy + 16} stroke={legColor} strokeWidth="3" strokeLinecap="round" />

      {/* 쿼터뷰 좌석 (윗면 마름모 + 앞면) */}
      <polygon
        points={`${cx},${cy - 8} ${cx + 14},${cy - 1} ${cx},${cy + 6} ${cx - 14},${cy - 1}`}
        fill={seatColor}
        stroke={legColor}
        strokeWidth="0.8"
      />
      <polygon
        points={`${cx - 14},${cy - 1} ${cx},${cy + 6} ${cx},${cy + 14} ${cx - 14},${cy + 7}`}
        fill={legColor}
        stroke={legColor}
        strokeWidth="0.5"
      />
      <polygon
        points={`${cx + 14},${cy - 1} ${cx},${cy + 6} ${cx},${cy + 14} ${cx + 14},${cy + 7}`}
        fill={seatColor}
        stroke={legColor}
        strokeWidth="0.5"
        opacity="0.7"
      />

      {/* 등받이 */}
      <polygon
        points={`${cx - 14},${cy - 1} ${cx},${cy - 8} ${cx},${cy - 22} ${cx - 14},${cy - 15}`}
        fill={backColor}
        stroke={legColor}
        strokeWidth="0.8"
      />

      {/* 라벨 */}
      <text x={cx} y={cy + 30} textAnchor="middle" fontSize="10" fill={legColor} fontWeight="600">
        {label}
      </text>
    </g>
  );
}

// ── 캐릭터 (동그란 머리 + 몸) ────────────────────────────────────────────────
function Character({ cx, cy, side, speaking, emotion }) {
  const isPink = side === 'user';
  const bodyColor = isPink ? '#ff9fc8' : '#5b9fd4';
  const skinColor = '#ffe0cc';
  const hairColor = isPink ? '#c24b8a' : '#3a5fa0';

  return (
    <g className={`char-${side} ${speaking ? 'char-speaking' : ''}`}>
      {/* 몸 */}
      <ellipse cx={cx} cy={cy + 16} rx={10} ry={14} fill={bodyColor} />
      {/* 머리 */}
      <circle cx={cx} cy={cy} r={12} fill={skinColor} />
      {/* 머리카락 */}
      {isPink ? (
        <path d={`M${cx - 12},${cy - 2} Q${cx - 10},${cy - 18} ${cx},${cy - 15} Q${cx + 10},${cy - 18} ${cx + 12},${cy - 2}`} fill={hairColor} />
      ) : (
        <path d={`M${cx - 12},${cy - 4} Q${cx - 8},${cy - 16} ${cx},${cy - 14} Q${cx + 8},${cy - 16} ${cx + 12},${cy - 4}`} fill={hairColor} />
      )}
      {/* 눈 */}
      {emotion === 'happy' ? (
        <>
          <path d={`M${cx - 5},${cy - 2} Q${cx - 3},${cy - 5} ${cx - 1},${cy - 2}`} stroke="#555" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <path d={`M${cx + 1},${cy - 2} Q${cx + 3},${cy - 5} ${cx + 5},${cy - 2}`} stroke="#555" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </>
      ) : emotion === 'shy' ? (
        <>
          <circle cx={cx - 3} cy={cy - 2} r={1.5} fill="#555" />
          <circle cx={cx + 3} cy={cy - 2} r={1.5} fill="#555" />
          <ellipse cx={cx - 4} cy={cy + 2} rx={3} ry={1.5} fill="#ffb3b3" opacity="0.7" />
          <ellipse cx={cx + 4} cy={cy + 2} rx={3} ry={1.5} fill="#ffb3b3" opacity="0.7" />
        </>
      ) : (
        <>
          <circle cx={cx - 3} cy={cy - 2} r={1.5} fill="#555" />
          <circle cx={cx + 3} cy={cy - 2} r={1.5} fill="#555" />
        </>
      )}
      {/* 입 */}
      {emotion === 'happy' ? (
        <path d={`M${cx - 4},${cy + 4} Q${cx},${cy + 8} ${cx + 4},${cy + 4}`} stroke="#c87070" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      ) : emotion === 'shy' ? (
        <path d={`M${cx - 3},${cy + 5} Q${cx},${cy + 7} ${cx + 3},${cy + 5}`} stroke="#c87070" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      ) : (
        <path d={`M${cx - 3},${cy + 5} L${cx + 3},${cy + 5}`} stroke="#c87070" strokeWidth="1.5" strokeLinecap="round" />
      )}
    </g>
  );
}

// ── 말풍선 ───────────────────────────────────────────────────────────────────
function SpeechBubble({ cx, cy, text, side }) {
  const isLeft = side === 'user';
  const maxW = 110;
  const lines = wrapText(text, 16);
  const bh = lines.length * 16 + 14;
  const bw = Math.min(maxW, Math.max(60, lines.reduce((m, l) => Math.max(m, l.length * 6.5), 0) + 16));
  const bx = isLeft ? cx - bw - 10 : cx + 10;
  const by = cy - bh - 10;

  return (
    <g className="speech-bubble-anim">
      <rect x={bx} y={by} width={bw} height={bh} rx="10" fill="white" stroke={isLeft ? '#ffb8d8' : '#7ab8e8'} strokeWidth="1.5" filter="url(#shadow)" />
      {/* 꼬리 */}
      {isLeft ? (
        <polygon points={`${bx + bw - 14},${by + bh} ${bx + bw},${by + bh} ${cx},${cy - 4}`} fill="white" />
      ) : (
        <polygon points={`${bx + 14},${by + bh} ${bx},${by + bh} ${cx},${cy - 4}`} fill="white" />
      )}
      {lines.map((line, i) => (
        <text key={i} x={bx + bw / 2} y={by + 14 + i * 16} textAnchor="middle" fontSize="11" fill="#333">
          {line}
        </text>
      ))}
    </g>
  );
}

function wrapText(text, maxChars) {
  if (!text) return [];
  const words = text;
  const lines = [];
  for (let i = 0; i < words.length; i += maxChars) {
    lines.push(words.slice(i, i + maxChars));
  }
  return lines.length ? lines : [''];
}

// ── 하트 파티클 ─────────────────────────────────────────────────────────────
function HeartParticles({ active }) {
  if (!active) return null;
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <text
          key={i}
          className={`heart-particle heart-particle-${i}`}
          x={SCENE_W / 2 - 10 + i * 8}
          y={100}
          fontSize="14"
          textAnchor="middle"
        >
          💕
        </text>
      ))}
    </>
  );
}

// ── 데모 대화 시나리오 ────────────────────────────────────────────────────────
const DEMO_SCRIPT = [
  { side: 'user', text: '안녕하세요 😊', emotion: 'happy', userPos: 'seated', opponentPos: 'seated' },
  { side: 'opponent', text: '안녕하세요! 반가워요', emotion: 'happy', userPos: 'seated', opponentPos: 'seated' },
  { side: 'user', text: '취미가 뭐예요?', emotion: 'normal', userPos: 'seated', opponentPos: 'seated' },
  { side: 'opponent', text: '카페 탐방이요 ☕', emotion: 'happy', userPos: 'seated', opponentPos: 'seated' },
  { side: 'user', text: '저도요! 같이 가요', emotion: 'shy', userPos: 'seated', opponentPos: 'seated' },
  { side: 'opponent', text: '좋아요 💕', emotion: 'shy', userPos: 'seated', opponentPos: 'seated' },
  { side: null, text: null, emotion: null, userPos: 'standing', opponentPos: 'standing', hearts: true },
];

// ── 메인 페이지 ──────────────────────────────────────────────────────────────
export function AiDatePage() {
  const [scriptIdx, setScriptIdx] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [showHearts, setShowHearts] = useState(false);
  const intervalRef = useRef(null);

  const currentStep = DEMO_SCRIPT[Math.min(scriptIdx, DEMO_SCRIPT.length - 1)];
  const isEnd = scriptIdx >= DEMO_SCRIPT.length - 1;

  // 자동 재생
  useEffect(() => {
    if (autoPlay && !isEnd) {
      intervalRef.current = setTimeout(() => {
        nextStep();
      }, 2200);
    }
    return () => clearTimeout(intervalRef.current);
  }, [autoPlay, scriptIdx]);

  const nextStep = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    const next = Math.min(scriptIdx + 1, DEMO_SCRIPT.length - 1);
    setScriptIdx(next);
    if (DEMO_SCRIPT[next]?.hearts) setShowHearts(true);
    setTimeout(() => setIsAnimating(false), 400);
  };

  const reset = () => {
    setScriptIdx(0);
    setShowHearts(false);
    setAutoPlay(false);
  };

  // ── 캐릭터 위치 계산 ─────────────────────────────────────────────────────
  // 핑크(유저): 앞쪽 의자 (col=1, row=3) → 화면 기준 아랫쪽
  // 파랑(상대): 뒷쪽 의자 (col=3, row=1) → 화면 기준 윗쪽
  const pinkChairPos = isoToScreen(1.5, 2.8);
  const blueChairPos = isoToScreen(2.8, 1.2);

  const userStanding = currentStep?.userPos === 'standing';
  const opponentStanding = currentStep?.opponentPos === 'standing';

  const userCharPos = userStanding
    ? { x: pinkChairPos.x - 20, y: pinkChairPos.y - 40 }
    : { x: pinkChairPos.x - 8, y: pinkChairPos.y - 44 };
  const oppCharPos = opponentStanding
    ? { x: blueChairPos.x + 20, y: blueChairPos.y - 40 }
    : { x: blueChairPos.x + 8, y: blueChairPos.y - 44 };

  return (
    <div className="ai-date-page">
      {/* 헤더 */}
      <div className="ai-date-header">
        <Text typography="t5" fontWeight="bold" color="#191F28">AI 소개팅</Text>
        <Text typography="t8" color="#6b7684">AI가 나 대신 첫 대화를 나눠드려요</Text>
      </div>

      <Spacing size={8} />

      {/* 씬 카드 */}
      <div className="ai-date-scene-card">
        <svg
          width={SCENE_W}
          height={SCENE_H}
          viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
          className="ai-date-scene-svg"
        >
          <defs>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.12" />
            </filter>
          </defs>

          {/* 바닥 타일 */}
          {Array.from({ length: 5 }, (_, row) =>
            Array.from({ length: 4 }, (_, col) => (
              <Tile key={`${col}-${row}`} col={col} row={row} />
            ))
          )}

          {/* 파란 의자 (뒤쪽) */}
          <Chair cx={blueChairPos.x} cy={blueChairPos.y} color="#7ab8e8" label="상대" />

          {/* 상대 캐릭터 */}
          <Character
            cx={oppCharPos.x}
            cy={oppCharPos.y}
            side="opponent"
            speaking={currentStep?.side === 'opponent'}
            emotion={currentStep?.side === 'opponent' ? currentStep.emotion : 'normal'}
          />

          {/* 상대 말풍선 */}
          {currentStep?.side === 'opponent' && (
            <SpeechBubble
              cx={oppCharPos.x}
              cy={oppCharPos.y}
              text={currentStep.text}
              side="opponent"
            />
          )}

          {/* 핑크 의자 (앞쪽) */}
          <Chair cx={pinkChairPos.x} cy={pinkChairPos.y} color="#ff9fc8" label="나" />

          {/* 유저 캐릭터 */}
          <Character
            cx={userCharPos.x}
            cy={userCharPos.y}
            side="user"
            speaking={currentStep?.side === 'user'}
            emotion={currentStep?.side === 'user' ? currentStep.emotion : 'normal'}
          />

          {/* 유저 말풍선 */}
          {currentStep?.side === 'user' && (
            <SpeechBubble
              cx={userCharPos.x}
              cy={userCharPos.y}
              text={currentStep.text}
              side="user"
            />
          )}

          {/* 하트 파티클 */}
          <HeartParticles active={showHearts} />
        </svg>

        {/* 진행 도트 */}
        <div className="ai-date-dots">
          {DEMO_SCRIPT.map((_, i) => (
            <div
              key={i}
              className={`ai-date-dot ${i <= scriptIdx ? 'active' : ''}`}
            />
          ))}
        </div>
      </div>

      <Spacing size={16} />

      {/* 대화 상태 텍스트 */}
      <div className="ai-date-status">
        {isEnd ? (
          <div className="ai-date-status-match">
            <Text typography="t5" fontWeight="bold" color="#ff6b9d">💕 연결됐어요!</Text>
            <Spacing size={4} />
            <Text typography="t8" color="#6b7684">AI가 서로의 공통점을 찾았어요</Text>
          </div>
        ) : currentStep?.side ? (
          <Text typography="t8" color="#8b95a1">
            {currentStep.side === 'user' ? '나의 AI가 말하는 중...' : '상대 AI가 답하는 중...'}
          </Text>
        ) : null}
      </div>

      <Spacing size={20} />

      {/* 컨트롤 버튼 */}
      <div className="ai-date-controls">
        {isEnd ? (
          <>
            <button className="ai-date-btn ai-date-btn-secondary" onClick={reset}>
              다시 보기
            </button>
            <button className="ai-date-btn ai-date-btn-primary" onClick={() => {}}>
              시작하기 (준비 중)
            </button>
          </>
        ) : (
          <>
            <button
              className={`ai-date-btn ai-date-btn-secondary ${autoPlay ? 'active' : ''}`}
              onClick={() => setAutoPlay((p) => !p)}
            >
              {autoPlay ? '⏸ 일시정지' : '▶ 자동 재생'}
            </button>
            <button
              className="ai-date-btn ai-date-btn-primary"
              onClick={nextStep}
              disabled={isAnimating}
            >
              다음 →
            </button>
          </>
        )}
      </div>

      <Spacing size={16} />

      {/* 안내 배너 */}
      <div className="ai-date-info-banner">
        <Text typography="t8" color="#6b7684">
          💡 내 알람 상대와 AI가 먼저 대화해봐요. 잘 맞으면 직접 연결해드려요.
        </Text>
      </div>

      <Spacing size={80} />
    </div>
  );
}
