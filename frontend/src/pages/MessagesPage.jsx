import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
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
    message: '안녕하세요, 우연히 같은 카페에서 자주 마주쳤는데 용기 내어 메세지 남겨요.',
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
        <div className="msg-sheet-from">알 수 없는 누군가로부터</div>
        <div className="msg-sheet-text">{message.message}</div>
        <div className="msg-sheet-time">{formatDate(message.createdAt)}</div>

        <div className="msg-sheet-divider" />

        <div className="msg-sheet-react-label">반응하기</div>
        <div className="msg-sheet-emoji-row">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              className={`msg-sheet-emoji-btn${currentEmoji === emoji ? ' active' : ''}`}
              onClick={() => onReact(message.id, emoji)}
              aria-label={emoji}
            >
              {emoji}
            </button>
          ))}
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
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showAuthSheet, setShowAuthSheet] = useState(false);

  const verifiedId = localStorage.getItem(IG_VERIFIED_KEY);
  const isVerified = !!verifiedId;

  // 배지 클리어: 페이지 진입 시 cleared_at 갱신
  useEffect(() => {
    localStorage.setItem(MSG_BADGE_CLEARED_AT_KEY, new Date().toISOString());
  }, []);

  const loadMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      if (IS_DEV) {
        setSentMessages(DEV_MOCK_SENT);
        if (isVerified) setReceivedMessages(DEV_MOCK_RECEIVED);
      } else {
        const sent = await api.getSentMessages();
        setSentMessages(sent);
        if (isVerified) {
          const received = await api.getReceivedMessages(verifiedId);
          setReceivedMessages(received);
        }
      }
    } catch (err) {
      console.error('메세지 로드 실패:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isVerified, verifiedId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const handleReact = async (alarmId, emoji) => {
    // optimistic update
    setReceivedMessages(prev =>
      prev.map(m =>
        m.id === alarmId
          ? { ...m, reactions: [{ emoji }] }
          : m
      )
    );
    // selectedMessage도 갱신
    setSelectedMessage(prev =>
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

  const handleRowClick = (msg) => {
    setSelectedMessage(msg);
  };

  const handleSheetClose = () => {
    setSelectedMessage(null);
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
              <div key={msg.id} className="message-row">
                <div className="message-row-icon">💌</div>
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
                onClick={() => handleRowClick(msg)}
              >
                <div className="message-row-icon">💌</div>
                <div className="message-row-body">
                  <div className="message-row-top">알 수 없는 누군가</div>
                  <div className="message-row-preview">{truncateText(msg.message)}</div>
                  <div className="message-row-bottom">
                    {msg.reactions?.[0]?.emoji
                      ? `${msg.reactions[0].emoji} 반응함`
                      : ''}
                    <span className="message-row-dot">·</span>
                    {formatDate(msg.createdAt)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 받은 메세지 상세 시트 */}
      {selectedMessage && (
        <MessageDetailSheet
          message={selectedMessage}
          onClose={handleSheetClose}
          onReact={handleReact}
        />
      )}

      {/* 인스타그램 인증 시트 (받은 메세지 탭 CTA에서 진입) */}
      {showAuthSheet && (
        <div>
          {/* InstagramAuthSheet는 동적으로 import */}
          <AuthSheetWrapper
            onClose={() => setShowAuthSheet(false)}
            onSuccess={() => {
              setShowAuthSheet(false);
              loadMessages();
            }}
          />
        </div>
      )}
    </div>
  );
}

// InstagramAuthSheet를 동적으로 로드하는 래퍼
function AuthSheetWrapper({ onClose, onSuccess }) {
  const [AuthSheet, setAuthSheet] = useState(null);

  useEffect(() => {
    import('../components/InstagramAuthSheet').then((mod) => {
      setAuthSheet(() => mod.InstagramAuthSheet);
    });
  }, []);

  if (!AuthSheet) return null;

  return (
    <AuthSheet
      isOpen={true}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}

export default MessagesPage;
