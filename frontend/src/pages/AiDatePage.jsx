import { useState, useEffect, useRef } from 'react';
import { Text, Spacing, Button } from '@toss/tds-mobile';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { logScreen, logClick } from '../utils/analytics';
import './AiDatePage.css';

// ── 씬 상수 ──────────────────────────────────────────────────────────────────
const SW = 340;
const SH = 280;
const TW = 60;
const TH = 30;

function iso(col, row) {
  return {
    x: SW / 2 + (col - row) * (TW / 2),
    y: 36 + (col + row) * (TH / 2),
  };
}

// ── 바닥 타일 ────────────────────────────────────────────────────────────────
function Tile({ col, row }) {
  const { x, y } = iso(col, row);
  const pts = [
    `${x},${y}`,
    `${x + TW / 2},${y + TH / 2}`,
    `${x},${y + TH}`,
    `${x - TW / 2},${y + TH / 2}`,
  ].join(' ');
  const alt = (col + row) % 2 === 0;
  return (
    <polygon
      points={pts}
      fill={alt ? '#f3eeff' : '#ebe4fb'}
      stroke="#ddd5f5"
      strokeWidth="0.4"
    />
  );
}

// ── 쿼터뷰 의자 ──────────────────────────────────────────────────────────────
function Chair({ cx, cy, accent }) {
  const dark = accent === 'pink' ? '#e0789e' : '#4f8fc0';
  const mid = accent === 'pink' ? '#ff9fc8' : '#7ab8e8';
  const light = accent === 'pink' ? '#ffcee2' : '#b3d8f5';
  return (
    <g>
      {/* 앞다리 */}
      <line x1={cx - 9} y1={cy + 6} x2={cx - 9} y2={cy + 20} stroke={dark} strokeWidth="2.8" strokeLinecap="round" />
      <line x1={cx + 5} y1={cy + 6} x2={cx + 5} y2={cy + 20} stroke={dark} strokeWidth="2.8" strokeLinecap="round" />
      {/* 뒷다리 */}
      <line x1={cx - 14} y1={cy} x2={cx - 14} y2={cy + 14} stroke={dark} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      <line x1={cx} y1={cy} x2={cx} y2={cy + 14} stroke={dark} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      {/* 좌석 윗면 */}
      <polygon
        points={`${cx - 7},${cy - 6} ${cx + 7},${cy - 0} ${cx - 7},${cy + 6} ${cx - 21},${cy - 0}`}
        fill={mid}
        stroke={dark}
        strokeWidth="0.6"
      />
      {/* 좌석 앞면 */}
      <polygon
        points={`${cx - 21},${cy} ${cx - 7},${cy + 6} ${cx - 7},${cy + 12} ${cx - 21},${cy + 6}`}
        fill={dark}
        opacity="0.75"
      />
      {/* 등받이 상단 */}
      <polygon
        points={`${cx - 21},${cy - 0} ${cx - 7},${cy - 6} ${cx - 7},${cy - 18} ${cx - 21},${cy - 12}`}
        fill={light}
        stroke={dark}
        strokeWidth="0.6"
      />
    </g>
  );
}

// ── 캐릭터: 유저 (뒤통수, 오른쪽 위 방향) ───────────────────────────────────
// 앞쪽 의자에 앉아 있음 → 뒤에서 약간 왼쪽에서 보는 구도 → 오른쪽 옆뒤통수
function UserCharacter({ cx, cy, speaking }) {
  // 피부/헤어 톤: 중성 warm
  const skin = '#f5d5b8';
  const hairFill = '#6b4226';
  const shirtFill = '#ff9fc8';
  const shirtDark = '#e07899';

  return (
    <g className={`char-anim ${speaking ? 'char-speaking' : ''}`}>
      {/* 몸통 (뒤에서 보임) */}
      <ellipse cx={cx} cy={cy + 26} rx={11} ry={13} fill={shirtFill} />
      {/* 왼쪽 어깨 더 튀어나옴 (뒤에서 오른쪽 구도) */}
      <ellipse cx={cx - 11} cy={cy + 20} rx={6} ry={4} fill={shirtDark} opacity="0.8" />
      <ellipse cx={cx + 9} cy={cy + 22} rx={5} ry={3.5} fill={shirtFill} opacity="0.9" />

      {/* 목 */}
      <rect x={cx - 4} y={cy + 7} width={8} height={8} rx={3} fill={skin} />

      {/* 머리: 뒤통수 구도 - 원형이 주가 됨 */}
      {/* 뒷머리 */}
      <circle cx={cx - 2} cy={cy} r={13} fill={hairFill} />
      {/* 두피 경계(피부) */}
      <path
        d={`M${cx + 4},${cy - 2} Q${cx + 12},${cy - 4} ${cx + 11},${cy + 6}`}
        fill={skin}
        stroke="none"
      />
      {/* 오른쪽 뺨 - 살짝 보이는 옆모습 */}
      <ellipse cx={cx + 10} cy={cy + 1} rx={4.5} ry={6} fill={skin} />
      {/* 오른쪽 귀 살짝 */}
      <ellipse cx={cx + 13} cy={cy + 3} rx={2.2} ry={3} fill={skin} />
      <ellipse cx={cx + 13} cy={cy + 3} rx={1} ry={1.8} fill="#e8b89a" />
      {/* 오른쪽 눈 살짝 (프로필 힌트) */}
      <ellipse cx={cx + 11} cy={cy - 1} rx={1.5} ry={1.2} fill="#3a2510" opacity="0.7" />
      {/* 헤어라인 */}
      <path
        d={`M${cx - 12},${cy - 2} Q${cx - 4},${cy - 14} ${cx + 6},${cy - 12} Q${cx + 12},${cy - 6} ${cx + 11},${cy + 2}`}
        fill={hairFill}
        opacity="0.9"
      />
      {/* 머릿결 하이라이트 */}
      <path
        d={`M${cx - 8},${cy - 4} Q${cx},${cy - 12} ${cx + 5},${cy - 10}`}
        stroke="#9b6030"
        strokeWidth="1.2"
        fill="none"
        opacity="0.5"
      />

      {/* 말하는 중 표시 */}
      {speaking && (
        <g>
          <circle cx={cx + 18} cy={cy - 12} r={5} fill="white" stroke="#ffb8d8" strokeWidth="1" />
          <text x={cx + 18} y={cy - 9} textAnchor="middle" fontSize="7">💬</text>
        </g>
      )}
    </g>
  );
}

// ── 캐릭터: 상대 (왼쪽 프로필, 왼쪽 아래 방향) ─────────────────────────────
function OpponentCharacter({ cx, cy, speaking }) {
  const skin = '#f0d0b0';
  const hairFill = '#2c3e50';
  const shirtFill = '#7ab8e8';
  const shirtDark = '#4a88b8';

  return (
    <g className={`char-anim ${speaking ? 'char-speaking' : ''}`}>
      {/* 몸통 왼쪽 프로필 */}
      <ellipse cx={cx} cy={cy + 26} rx={10} ry={13} fill={shirtFill} />
      {/* 오른팔 뒤에 숨겨짐, 왼팔 앞으로 */}
      <ellipse cx={cx - 10} cy={cy + 20} rx={5} ry={3.5} fill={shirtFill} opacity="0.9" />
      <ellipse cx={cx + 8} cy={cy + 22} rx={4.5} ry={3} fill={shirtDark} opacity="0.6" />

      {/* 목 */}
      <rect x={cx - 4} y={cy + 7} width={7} height={8} rx={3} fill={skin} />

      {/* 머리: 왼쪽 프로필 구도 */}
      {/* 두상 */}
      <ellipse cx={cx - 2} cy={cy - 1} rx={12} ry={13.5} fill={skin} />
      {/* 이마/두개 영역 */}
      <ellipse cx={cx - 3} cy={cy - 5} rx={10} ry={10} fill={skin} />

      {/* 헤어 (왼쪽 프로필) */}
      <path
        d={`M${cx - 12},${cy + 6} Q${cx - 14},${cy - 4} ${cx - 10},${cy - 12}
           Q${cx - 4},${cy - 18} ${cx + 8},${cy - 14}
           Q${cx + 14},${cy - 8} ${cx + 10},${cy + 0}`}
        fill={hairFill}
      />
      {/* 뒷머리 */}
      <path
        d={`M${cx - 12},${cy + 6} Q${cx - 16},${cy + 2} ${cx - 14},${cy - 4}
           Q${cx - 13},${cy - 10} ${cx - 10},${cy - 12}`}
        fill={hairFill}
        opacity="0.9"
      />

      {/* 왼쪽 귀 */}
      <ellipse cx={cx + 11} cy={cy + 2} rx={2.2} ry={3} fill={skin} />
      <ellipse cx={cx + 11} cy={cy + 2} rx={1} ry={1.8} fill="#daa880" />

      {/* 왼쪽 눈썹 */}
      <path
        d={`M${cx - 4},${cy - 6} Q${cx + 1},${cy - 9} ${cx + 6},${cy - 7}`}
        stroke={hairFill}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* 왼쪽 눈 (반쯤 내리깜, 아래 방향 시선) */}
      <ellipse cx={cx + 2} cy={cy - 3} rx={4} ry={3} fill="white" />
      <ellipse cx={cx + 2} cy={cy - 2} rx={2.5} ry={2.5} fill="#2c3e50" />
      <ellipse cx={cx + 2} cy={cy - 2} rx={1.5} ry={1.5} fill="#1a252f" />
      <ellipse cx={cx + 0.5} cy={cy - 3} rx={0.8} ry={0.8} fill="white" />
      {/* 속눈썹 - 아래 방향 */}
      <path
        d={`M${cx - 2},${cy - 0.5} Q${cx + 2},${cy + 2} ${cx + 6},${cy - 0.5}`}
        stroke="#2c3e50"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />

      {/* 코 (왼쪽 프로필) */}
      <path
        d={`M${cx - 2},${cy - 2} L${cx - 5},${cy + 4} Q${cx - 3},${cy + 7} ${cx - 1},${cy + 5}`}
        stroke={skin}
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        style={{ filter: 'drop-shadow(0.5px 0.5px 0.5px rgba(0,0,0,0.2))' }}
      />

      {/* 입술 (살짝 내린 표정) */}
      <path
        d={`M${cx - 5},${cy + 7} Q${cx - 2},${cy + 9} ${cx},${cy + 7}`}
        stroke="#c47a5a"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={`M${cx - 5},${cy + 7} Q${cx - 2},${cy + 11} ${cx},${cy + 7}`}
        stroke="#e09878"
        strokeWidth="1"
        fill="#e8a882"
        opacity="0.5"
      />

      {/* 말하는 중 표시 */}
      {speaking && (
        <g>
          <circle cx={cx - 18} cy={cy - 12} r={5} fill="white" stroke="#7ab8e8" strokeWidth="1" />
          <text x={cx - 18} y={cy - 9} textAnchor="middle" fontSize="7">💬</text>
        </g>
      )}
    </g>
  );
}

// ── 씬 컴포넌트 ──────────────────────────────────────────────────────────────
function DateScene({ step }) {
  const pinkChair = iso(1.2, 2.9);
  const blueChair = iso(3.0, 1.1);

  const userSpeaking = step?.side === 'user';
  const oppSpeaking = step?.side === 'opponent';

  // 유저: 핑크 의자 위, 오른쪽 위를 향함 (뒷통수)
  const userPos = { x: pinkChair.x - 6, y: pinkChair.y - 46 };
  // 상대: 파란 의자 위, 왼쪽 아래를 향함 (왼쪽 프로필)
  const oppPos = { x: blueChair.x + 4, y: blueChair.y - 46 };

  return (
    <svg width={SW} height={SH} viewBox={`0 0 ${SW} ${SH}`} className="ai-date-scene-svg">
      <defs>
        <linearGradient id="floorGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f3eeff" />
          <stop offset="100%" stopColor="#fce8f3" />
        </linearGradient>
        <filter id="softShadow">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#a07ad0" floodOpacity="0.15" />
        </filter>
      </defs>

      {/* 바닥 타일 4×5 */}
      {Array.from({ length: 5 }, (_, r) =>
        Array.from({ length: 4 }, (_, c) => <Tile key={`${c}-${r}`} col={c} row={r} />)
      )}

      {/* 파란 의자 (뒷편) */}
      <g filter="url(#softShadow)">
        <Chair cx={blueChair.x} cy={blueChair.y} accent="blue" />
      </g>

      {/* 상대 캐릭터 (왼쪽 프로필, 좌하향) */}
      <OpponentCharacter cx={oppPos.x} cy={oppPos.y} speaking={oppSpeaking} />

      {/* 상대 말풍선 */}
      {oppSpeaking && step.text && (
        <BubbleLeft cx={oppPos.x - 14} cy={oppPos.y - 16} text={step.text} />
      )}

      {/* 핑크 의자 (앞편) */}
      <g filter="url(#softShadow)">
        <Chair cx={pinkChair.x} cy={pinkChair.y} accent="pink" />
      </g>

      {/* 유저 캐릭터 (뒤통수, 우상향) */}
      <UserCharacter cx={userPos.x} cy={userPos.y} speaking={userSpeaking} />

      {/* 유저 말풍선 */}
      {userSpeaking && step.text && (
        <BubbleRight cx={userPos.x + 14} cy={userPos.y - 16} text={step.text} />
      )}
    </svg>
  );
}

// ── 말풍선 ───────────────────────────────────────────────────────────────────
function BubbleRight({ cx, cy, text }) {
  const lines = splitText(text, 13);
  const bw = Math.max(55, Math.min(100, lines[0].length * 7 + 18));
  const bh = lines.length * 15 + 14;
  return (
    <g className="bubble-pop">
      <rect x={cx} y={cy - bh} width={bw} height={bh} rx={9} fill="white" stroke="#ffb8d8" strokeWidth="1.2" />
      <polygon points={`${cx + 5},${cy} ${cx + 18},${cy} ${cx},${cy - 6}`} fill="white" />
      {lines.map((l, i) => (
        <text key={i} x={cx + bw / 2} y={cy - bh + 13 + i * 15} textAnchor="middle" fontSize="10.5" fill="#333">{l}</text>
      ))}
    </g>
  );
}

function BubbleLeft({ cx, cy, text }) {
  const lines = splitText(text, 13);
  const bw = Math.max(55, Math.min(100, lines[0].length * 7 + 18));
  const bh = lines.length * 15 + 14;
  const x0 = cx - bw;
  return (
    <g className="bubble-pop">
      <rect x={x0} y={cy - bh} width={bw} height={bh} rx={9} fill="white" stroke="#7ab8e8" strokeWidth="1.2" />
      <polygon points={`${cx - 5},${cy} ${cx - 18},${cy} ${cx},${cy - 6}`} fill="white" />
      {lines.map((l, i) => (
        <text key={i} x={x0 + bw / 2} y={cy - bh + 13 + i * 15} textAnchor="middle" fontSize="10.5" fill="#333">{l}</text>
      ))}
    </g>
  );
}

function splitText(text, n) {
  const out = [];
  for (let i = 0; i < text.length; i += n) out.push(text.slice(i, i + n));
  return out.length ? out : [''];
}

// ── 시나리오 ─────────────────────────────────────────────────────────────────
const SCRIPT = [
  { side: null, text: null },
  { side: 'user', text: '안녕하세요 😊' },
  { side: 'opponent', text: '어, 반가워요!' },
  { side: 'user', text: '취미가 뭐예요?' },
  { side: 'opponent', text: '카페 탐방 좋아해요 ☕' },
  { side: 'user', text: '저도요! 같이 가요' },
  { side: 'opponent', text: '좋아요 💕' },
  { side: null, text: null, end: true },
];

// ── 온보딩 단계 카드 ─────────────────────────────────────────────────────────
const STEPS = [
  {
    num: '01',
    emoji: '📸',
    title: '인스타 인증으로 나를 분석',
    desc: '공개 프로필과 말투를 읽어\n당신만의 대화 스타일을 파악해요.',
  },
  {
    num: '02',
    emoji: '🤖',
    title: 'AI가 나의 클론을 생성',
    desc: '말투, 감정 패턴, 반응 속도까지\n나를 닮은 AI가 만들어져요.',
  },
  {
    num: '03',
    emoji: '💬',
    title: '클론끼리 대화를 나눠요',
    desc: '두 사람이라면 어떤 대화가 오갈지\nAI가 미리 시뮬레이션해요.',
  },
];

// ── 메인 페이지 ──────────────────────────────────────────────────────────────
export function AiDatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [clone, setClone] = useState(null);
  const [cloneLoading, setCloneLoading] = useState(true);
  const [scriptIdx, setScriptIdx] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const timerRef = useRef(null);

  useEffect(() => {
    logScreen('ai_clone_landing_screen');
    loadClone();
  }, []);

  const loadClone = async () => {
    try {
      const data = await api.getClone();
      setClone(data?.clone || null);
    } catch {
      setClone(null);
    } finally {
      setCloneLoading(false);
    }
  };

  // 씬 자동 재생
  useEffect(() => {
    if (!autoPlay) return;
    const isEnd = SCRIPT[scriptIdx]?.end;
    if (isEnd) {
      timerRef.current = setTimeout(() => setScriptIdx(0), 3000);
      return;
    }
    timerRef.current = setTimeout(() => {
      setScriptIdx((i) => Math.min(i + 1, SCRIPT.length - 1));
    }, 2000);
    return () => clearTimeout(timerRef.current);
  }, [scriptIdx, autoPlay]);

  const currentStep = SCRIPT[scriptIdx];
  const isEnd = currentStep?.end;

  return (
    <div className="ai-date-page">
      {/* ── 헤더 ── */}
      <div className="ai-date-header">
        <div className="ai-date-header-badge">AI 클론 Beta</div>
        <Text typography="t4" fontWeight="bold" color="#191F28">
          이 사람이랑<br />대화하면 어떨까?
        </Text>
        <Spacing size={6} />
        <Text typography="t8" color="#6b7684">
          AI가 두 사람의 첫 대화를 미리 시뮬레이션해요
        </Text>
      </div>

      <Spacing size={16} />

      {/* ── 씬 카드 ── */}
      <div className="ai-date-scene-card">
        <div className="ai-date-scene-labels">
          <span className="ai-date-label pink">나 (핑크)</span>
          <span className="ai-date-label blue">상대 (파랑)</span>
        </div>
        <DateScene step={currentStep} />
        {isEnd && (
          <div className="ai-date-match-overlay">
            <span className="ai-date-match-text">💕 케미 좋아요!</span>
          </div>
        )}
        {/* 진행 도트 */}
        <div className="ai-date-dots">
          {SCRIPT.map((_, i) => (
            <button
              key={i}
              className={`ai-date-dot ${i === scriptIdx ? 'active' : i < scriptIdx ? 'past' : ''}`}
              onClick={() => { setAutoPlay(false); setScriptIdx(i); }}
            />
          ))}
        </div>
      </div>

      <Spacing size={28} />

      {/* ── 등록 플로우 소개 ── */}
      <div className="ai-date-section">
        <Text typography="t6" fontWeight="bold" color="#191F28">이런 과정이에요</Text>
        <Spacing size={14} />
        <div className="ai-date-steps">
          {STEPS.map((s, i) => (
            <div key={i} className="ai-date-step-card">
              <div className="ai-date-step-left">
                <div className="ai-date-step-num">{s.num}</div>
                {i < STEPS.length - 1 && <div className="ai-date-step-line" />}
              </div>
              <div className="ai-date-step-body">
                <div className="ai-date-step-title-row">
                  <span className="ai-date-step-emoji">{s.emoji}</span>
                  <Text typography="t7" fontWeight="bold" color="#191F28">{s.title}</Text>
                </div>
                <Spacing size={3} />
                <Text typography="t8" color="#6b7684" style={{ whiteSpace: 'pre-line' }}>{s.desc}</Text>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Spacing size={24} />

      {/* ── 안전 배지 ── */}
      <div className="ai-date-safety-row">
        {['🔒 본인 인증 필수', '🤝 양방향 동의', '🗑️ 언제든 삭제'].map((b) => (
          <span key={b} className="ai-date-safety-badge">{b}</span>
        ))}
      </div>

      <Spacing size={28} />

      {/* ── CTA ── */}
      <div className="ai-date-cta-area">
        {cloneLoading ? null : clone ? (
          <>
            <div className="ai-date-clone-active-card">
              <span className="ai-date-clone-active-dot" />
              <Text typography="t8" color="#3d85f5" fontWeight="bold">
                @{clone.instagramId} 클론 활성
              </Text>
            </div>
            <Spacing size={12} />
            <Button size="xlarge" display="block" onClick={() => { logClick('ai_clone_manage_tap'); navigate('/clone'); }}>
              클론 관리하기
            </Button>
            <Spacing size={10} />
            <button className="ai-date-secondary-btn" onClick={() => navigate('/clone-conversations')}>
              AI 대화 기록 보기 →
            </button>
          </>
        ) : (
          <>
            <Button
              size="xlarge"
              display="block"
              onClick={() => { logClick('ai_clone_create_tap'); navigate('/clone'); }}
            >
              내 클론 만들기 →
            </Button>
            <Spacing size={10} />
            <Text typography="t8" color="#8b95a1" style={{ textAlign: 'center' }}>
              인스타그램 인증만 하면 무료로 시작해요
            </Text>
          </>
        )}
      </div>

      <Spacing size={90} />
    </div>
  );
}
