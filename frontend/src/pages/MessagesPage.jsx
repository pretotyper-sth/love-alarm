import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { InstagramAuthSheet } from '../components/InstagramAuthSheet';
import './MessagesPage.css';

const IS_DEV = import.meta.env.DEV;
const IG_VERIFIED_KEY = 'love_alarm_instagram_verified_username';
const MSG_BADGE_CLEARED_AT_KEY = 'love_alarm_msg_badge_cleared_at';

// 날짜 포맷 (예: 3월 29일 오후 2:30)
function formatDate(isoStr) {
  const d = new Date(isoStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours < 12 ? '오전' : '오후';
  const h12 = hours % 12 || 12;
  return `${month}월 ${day}일 ${ampm} ${h12}:${minutes}`;
}

// 텍스트 줄임 (max자 초과 시 말줄임)
function truncateText(text, max = 40) {
  if (!text) return '';
  return text.length > max ? text.slice(0, max) + '…' : text;
}

// DEV 목업 데이터
const DEV_MOCK_SENT = [
  {
    id: 'mock-sent-1',
    targetInstagramId: 'jungsoo.dev',
    message: '안녕하세요, 우연히 같은 카페에서 자주 마주쳤는데 용기 내어 메세지 남겨요. 잘 지내고 계신가요? 언젠가 한번 이야기 나눠볼 수 있으면 좋겠습니다.',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    reactions: [{ emoji: '😊' }],
  },
  {
    id: 'mock-sent-2',
    targetInstagramId: 'hello_world_kr',
    message: '지난번에 잠깐 이야기했는데 기억하실지 모르겠어요.',
    createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    reactions: [],
  },
];

const DEV_MOCK_RECEIVED = [
  {
    id: 'mock-recv-1',
    fromInstagramId: 'unknown_sender',
    targetInstagramId: 'myid',
    message: '항상 멀리서 응원하고 있어요. 한번쯤 이야기해 볼 수 있으면 좋겠어요.',
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    reactions: [],
  },
  {
    id: 'mock-recv-2',
    fromInstagramId: 'unknown_sender_2',
    targetInstagramId: 'myid',
    message: '같은 동네에 사는 것 같아서요. 인연이 닿으면 좋겠습니다.',
    createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
    reactions: [{ emoji: '❤️' }],
  },
];

// ──────────────────────────────────────────────────────────────────────
// 메세지 아이콘 컴포넌트 — TDS 스타일 squircle 박스 + 인라인 SVG
// ──────────────────────────────────────────────────────────────────────
function MessageIcon({ type = 'received' }) {
  if (type === 'sent') {
    // 보낸 메세지: 핑크 squircle + 편지봉투 SVG (letter-heart는 매칭 아이콘과 동일하므로 구분)
    return (
      <div className="message-row-icon-box message-row-icon-box--sent">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          {/* 봉투 몸체 */}
          <rect x="2" y="5" width="18" height="13" rx="2.5" fill="#e05ca3" />
          {/* 봉투 뚜껑 (V자) */}
          <path d="M2 7.5L11 13.5L20 7.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </div>
    );
  }

  // 받은 메세지: 회색 squircle + 말풍선 SVG
  return (
    <div className="message-row-icon-box message-row-icon-box--received">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M2 5a3 3 0 013-3h12a3 3 0 013 3v8a3 3 0 01-3 3H8.5L5 19v-3A3 3 0 012 13V5z"
          fill="#8b95a1"
        />
        <circle cx="8.5" cy="9" r="1.1" fill="white" />
        <circle cx="11" cy="9" r="1.1" fill="white" />
        <circle cx="13.5" cy="9" r="1.1" fill="white" />
      </svg>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// SentMessageDetailSheet — 보낸 메세지 상세 (반응 수신 확인용)
// ──────────────────────────────────────────────────────────────────────
function SentMessageDetailSheet({ message, onClose }) {
  if (!message) return null;
  const reaction = message.reactions?.[0]?.emoji ?? null;

  return (
    <>
      <div className="msg-sheet-overlay" onClick={onClose} />
      <div className="msg-sheet">
        {/* 드래그 핸들 */}
        <div className="msg-sheet-handle" />

        {/* 수신자 배지 */}
        <div className="msg-sheet-badge-row">
          <span className="msg-sheet-badge msg-sheet-badge--sent">
            <img
              src="https://static.toss.im/icons/png/4x/icon-letter-heart.png"
              alt=""
              style={{ width: 12, height: 12, marginRight: 4, verticalAlign: 'middle' }}
            />
            To: @{message.targetInstagramId}
          </span>
          <span className="msg-sheet-date">{formatDate(message.createdAt)}</span>
        </div>

        {/* 메세지 카드 */}
        <div className="msg-sheet-card">
          <p className="msg-sheet-text">{message.message}</p>
        </div>

        {/* 반응 섹션 */}
        <div className="msg-sheet-react-section">
          <span className="msg-sheet-react-label">상대방의 반응</span>
          {reaction ? (
            <div className="msg-sent-reaction-chip">
              <span>{reaction}</span>
              <span className="msg-sent-reaction-text">반응했어요</span>
            </div>
          ) : (
            <div className="msg-no-reaction">
              <img
                src="https://static.toss.im/icons/png/4x/icon-clock-mono.png"
                alt=""
                style={{ width: 14, height: 14, marginRight: 4, opacity: 0.4, verticalAlign: 'middle' }}
              />
              아직 반응이 없어요
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────
// MessageDetailSheet — 받은 메세지 상세 바텀시트
// ──────────────────────────────────────────────────────────────────────
function MessageDetailSheet({ message, onClose, onReact }) {
  const EMOJIS = ['❤️', '😊', '🤔', '😳', '🥹'];
  const currentEmoji = message?.reactions?.[0]?.emoji ?? null;

  if (!message) return null;

  return (
    <>
      <div className="msg-sheet-overlay" onClick={onClose} />
      <div className="msg-sheet">
        {/* 드래그 핸들 */}
        <div className="msg-sheet-handle" />

        {/* 발신자 배지 */}
        <div className="msg-sheet-badge-row">
          <span className="msg-sheet-badge msg-sheet-badge--received">
            <img
              src="https://static.toss.im/icons/png/4x/icon-person-circle-mono.png"
              alt=""
              style={{ width: 12, height: 12, marginRight: 4, verticalAlign: 'middle', opacity: 0.6 }}
            />
            알 수 없는 누군가로부터
          </span>
          <span className="msg-sheet-date">{formatDate(message.createdAt)}</span>
        </div>

        {/* 메세지 카드 */}
        <div className="msg-sheet-card">
          <p className="msg-sheet-text">{message.message}</p>
        </div>

        {/* 반응하기 섹션 */}
        <div className="msg-sheet-react-section">
          <span className="msg-sheet-react-label">반응하기</span>
          <div className="msg-sheet-emoji-row">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                className={`msg-sheet-emoji-btn${currentEmoji === emoji ? ' active' : ''}`}
                onClick={() => onReact(message.id, emoji)}
                aria-label={emoji}
              >
                <span className="msg-sheet-emoji-glyph">{emoji}</span>
                {currentEmoji === emoji && (
                  <span className="msg-sheet-emoji-check">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────
// InstagramAuthCta — 받은 메세지 탭 미인증 CTA
// ──────────────────────────────────────────────────────────────────────
function InstagramAuthCta({ onVerify }) {
  return (
    <div className="msg-auth-cta">
      <div className="msg-auth-cta-title">메세지 확인을 위해선 인증이 필요해요</div>
      <div className="msg-auth-cta-desc">
        본인 계정이 맞는지 확인하기 위해<br />인스타그램 인증이 필요해요.
      </div>
      <button className="msg-auth-cta-btn" onClick={onVerify}>
        인스타그램 인증하기
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// MessagesPage
// ──────────────────────────────────────────────────────────────────────
export function MessagesPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('sent'); // 'sent' | 'received'
  const [sentMessages, setSentMessages] = useState([]);
  const [receivedMessages, setReceivedMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  // 받은 메세지 상세 시트
  const [selectedReceivedMsg, setSelectedReceivedMsg] = useState(null);
  // 보낸 메세지 상세 시트
  const [selectedSentMsg, setSelectedSentMsg] = useState(null);
  // 인증 시트
  const [showAuthSheet, setShowAuthSheet] = useState(false);
  // 인증 상태 (시트에서 인증 후 즉시 반영)
  const [verifiedId, setVerifiedId] = useState(() => localStorage.getItem(IG_VERIFIED_KEY));
  const isVerified = !!verifiedId;

  // 배지 클리어: 페이지 진입 시 cleared_at 갱신
  useEffect(() => {
    localStorage.setItem(MSG_BADGE_CLEARED_AT_KEY, new Date().toISOString());
  }, []);

  const loadMessages = useCallback(async (currentVerifiedId) => {
    const vid = currentVerifiedId ?? verifiedId;
    setIsLoading(true);
    try {
      if (IS_DEV) {
        setSentMessages(DEV_MOCK_SENT);
        if (vid) setReceivedMessages(DEV_MOCK_RECEIVED);
      } else {
        const sent = await api.getSentMessages();
        setSentMessages(sent);
        if (vid) {
          const received = await api.getReceivedMessages(vid);
          setReceivedMessages(received);
        }
      }
    } catch (err) {
      console.error('메세지 로드 실패:', err);
    } finally {
      setIsLoading(false);
    }
  }, [verifiedId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const handleReact = async (alarmId, emoji) => {
    // optimistic update
    setReceivedMessages(prev =>
      prev.map(m =>
        m.id === alarmId ? { ...m, reactions: [{ emoji }] } : m
      )
    );
    setSelectedReceivedMsg(prev =>
      prev?.id === alarmId ? { ...prev, reactions: [{ emoji }] } : prev
    );

    if (!IS_DEV) {
      try {
        await api.reactToMessage(alarmId, emoji);
      } catch (err) {
        console.error('반응 저장 실패:', err);
      }
    }
  };

  const handleAuthSuccess = (username) => {
    const newVerifiedId = username;
    localStorage.setItem(IG_VERIFIED_KEY, newVerifiedId);
    setVerifiedId(newVerifiedId);
    setShowAuthSheet(false);
    loadMessages(newVerifiedId);
  };

  return (
    <div className="messages-page">
      {/* 상단 바 */}
      <div className="messages-top-bar">
        <button className="messages-back-btn" onClick={() => navigate(-1)} aria-label="뒤로">
          <img
            src="https://static.toss.im/icons/png/4x/icon-arrow-left-mono.png"
            alt="뒤로"
            style={{ width: 20, height: 20 }}
          />
        </button>
        <span className="messages-top-title">메세지 확인</span>
        <span style={{ width: 40 }} />
      </div>

      {/* 탭 */}
      <div className="messages-tabs">
        <button
          className={`messages-tab${activeTab === 'sent' ? ' active' : ''}`}
          onClick={() => setActiveTab('sent')}
        >
          내가 보낸 메세지
        </button>
        <button
          className={`messages-tab${activeTab === 'received' ? ' active' : ''}`}
          onClick={() => setActiveTab('received')}
        >
          받은 메세지
        </button>
      </div>

      {/* 보낸 메세지 탭 */}
      {activeTab === 'sent' && (
        <div className="messages-content">
          {isLoading ? (
            <div className="messages-loading">불러오는 중...</div>
          ) : sentMessages.length === 0 ? (
            <div className="messages-empty">보낸 메세지가 없어요</div>
          ) : (
            sentMessages.map((msg) => (
              <div
                key={msg.id}
                className="message-row message-row-tappable"
                onClick={() => setSelectedSentMsg(msg)}
              >
                <MessageIcon type="sent" />
                <div className="message-row-body">
                  <div className="message-row-top">To: @{msg.targetInstagramId}</div>
                  <div className="message-row-preview">{truncateText(msg.message)}</div>
                  <div className="message-row-bottom">
                    {msg.reactions?.[0]?.emoji
                      ? `${msg.reactions[0].emoji} 반응`
                      : '반응 없음'}
                    <span className="message-row-dot">·</span>
                    {formatDate(msg.createdAt)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 받은 메세지 탭 */}
      {activeTab === 'received' && (
        <div className="messages-content">
          {!isVerified ? (
            <InstagramAuthCta onVerify={() => setShowAuthSheet(true)} />
          ) : isLoading ? (
            <div className="messages-loading">불러오는 중...</div>
          ) : receivedMessages.length === 0 ? (
            <div className="messages-empty">받은 메세지가 없어요</div>
          ) : (
            receivedMessages.map((msg) => (
              <div
                key={msg.id}
                className="message-row message-row-tappable"
                onClick={() => setSelectedReceivedMsg(msg)}
              >
                <MessageIcon type="received" />
                <div className="message-row-body">
                  <div className="message-row-top">알 수 없는 누군가</div>
                  <div className="message-row-preview">{truncateText(msg.message)}</div>
                  <div className="message-row-bottom">
                    {msg.reactions?.[0]?.emoji
                      ? `${msg.reactions[0].emoji} 반응함`
                      : ''}
                    {msg.reactions?.[0]?.emoji && <span className="message-row-dot">·</span>}
                    {formatDate(msg.createdAt)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 받은 메세지 상세 시트 */}
      {selectedReceivedMsg && (
        <MessageDetailSheet
          message={selectedReceivedMsg}
          onClose={() => setSelectedReceivedMsg(null)}
          onReact={handleReact}
        />
      )}

      {/* 보낸 메세지 상세 시트 */}
      {selectedSentMsg && (
        <SentMessageDetailSheet
          message={selectedSentMsg}
          onClose={() => setSelectedSentMsg(null)}
        />
      )}

      {/* 인스타그램 인증 시트 (받은 메세지 탭 CTA에서 진입) */}
      <InstagramAuthSheet
        open={showAuthSheet}
        onClose={() => setShowAuthSheet(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}

export default MessagesPage;
