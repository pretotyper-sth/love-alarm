import { useState, useEffect, useCallback } from 'react';
import { Top, Spacing } from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { api } from '../utils/api';
import {
  loadReadReceivedMessageIds,
  loadReportedReceivedMessageIds,
  markReceivedMessageAsReported,
  markReceivedMessageAsRead,
  pruneReadReceivedMessageIds,
  pruneReportedReceivedMessageIds,
} from '../utils/messages';
import { InstagramAuthSheet } from '../components/InstagramAuthSheet';
import './MessagesPage.css';

const IS_DEV = import.meta.env.DEV;
const IG_VERIFIED_KEY = 'love_alarm_instagram_verified_username';
const REPORT_REASON_OPTIONS = [
  '불쾌하거나 과도하게 성적인 내용',
  '욕설, 혐오, 위협이 느껴져요',
  '스팸 또는 광고 같아요',
  '원치 않는 연락이라 불편해요',
];

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
// 메세지 아이콘 컴포넌트 — TDS Asset squircle 스타일 (2D 이모지)
// ──────────────────────────────────────────────────────────────────────
// Toss 2D 이모지 💌 (u1F48C) — 보낸/받은 공통, 배경색으로 구분
const MSG_EMOJI_URL = 'https://static.toss.im/2d-emojis/png/4x/u1F48C.png';

function MessageIcon({ type = 'received' }) {
  return (
    <div className={`message-row-icon-box message-row-icon-box--${type}`}>
      <img
        src={MSG_EMOJI_URL}
        alt=""
        className="message-row-icon-img"
        draggable={false}
      />
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
function MessageDetailSheet({ message, onClose, onReact, onReport }) {
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
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
              style={{ marginRight: 4, verticalAlign: 'middle', opacity: 0.6, flexShrink: 0 }}
            >
              <circle cx="6" cy="6" r="5" stroke="#6B7684" strokeWidth="1" />
              <circle cx="6" cy="4.6" r="1.5" fill="#6B7684" />
              <path
                d="M3.8 8.8C4.25 7.85 5.08 7.3 6 7.3C6.92 7.3 7.75 7.85 8.2 8.8"
                stroke="#6B7684"
                strokeWidth="1"
                strokeLinecap="round"
              />
            </svg>
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

        <div className="msg-sheet-report-section">
          <div className="msg-sheet-report-copy">
            불쾌하거나 부적절한 메세지라면 신고할 수 있어요.
          </div>
          <button className="msg-sheet-report-trigger" type="button" onClick={() => onReport(message)}>
            이 메세지 신고하기
          </button>
        </div>
      </div>
    </>
  );
}

function ReportMessageSheet({
  message,
  selectedReason,
  onSelectReason,
  onClose,
  onSubmit,
  isSubmitting,
}) {
  if (!message) return null;

  return (
    <>
      <div className="msg-sheet-overlay msg-sheet-overlay--stacked" onClick={onClose} />
      <div className="msg-sheet msg-sheet--report">
        <div className="msg-sheet-handle" />

        <div className="msg-report-header">
          <h3 className="msg-report-title">이 메세지를 신고할까요?</h3>
          <p className="msg-report-desc">
            신고 사유를 선택해 주세요.
            <br />
            제출하면 이 메세지는 받은 목록에서 숨겨져요.
          </p>
        </div>

        <div className="msg-report-preview">
          <p className="msg-report-preview-text">{truncateText(message.message, 70)}</p>
        </div>

        <div className="msg-report-reason-list">
          {REPORT_REASON_OPTIONS.map((reason) => (
            <button
              key={reason}
              type="button"
              className={`msg-report-reason-item${selectedReason === reason ? ' active' : ''}`}
              onClick={() => onSelectReason(reason)}
            >
              <span>{reason}</span>
              {selectedReason === reason && <span className="msg-report-reason-check">✓</span>}
            </button>
          ))}
        </div>

        <div className="msg-report-action-row">
          <button type="button" className="msg-report-secondary-btn" onClick={onClose} disabled={isSubmitting}>
            취소
          </button>
          <button
            type="button"
            className="msg-report-primary-btn"
            onClick={onSubmit}
            disabled={!selectedReason || isSubmitting}
          >
            {isSubmitting ? '신고 중…' : '신고하고 숨기기'}
          </button>
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
  const [activeTab, setActiveTab] = useState('sent'); // 'sent' | 'received'
  const [sentMessages, setSentMessages] = useState([]);
  const [receivedMessages, setReceivedMessages] = useState([]);
  const [readReceivedMessageIds, setReadReceivedMessageIds] = useState(() => loadReadReceivedMessageIds());
  const [, setReportedReceivedMessageIds] = useState(() => loadReportedReceivedMessageIds());
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
  const [reportTargetMessage, setReportTargetMessage] = useState(null);
  const [selectedReportReason, setSelectedReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportToastMessage, setReportToastMessage] = useState('');

  const loadMessages = useCallback(async (currentVerifiedId) => {
    const vid = currentVerifiedId ?? verifiedId;
    setIsLoading(true);
    try {
      if (IS_DEV) {
        setSentMessages(DEV_MOCK_SENT);
        if (vid) {
          const rawReceivedMessages = DEV_MOCK_RECEIVED;
          const validMessageIds = rawReceivedMessages.map((message) => message.id);
          const nextReportedIds = pruneReportedReceivedMessageIds(validMessageIds);
          setReportedReceivedMessageIds(nextReportedIds);
          setReadReceivedMessageIds(pruneReadReceivedMessageIds(validMessageIds));
          setReceivedMessages(
            rawReceivedMessages.filter((message) => !nextReportedIds.includes(message.id))
          );
        } else {
          setReceivedMessages([]);
        }
      } else {
        const sent = await api.getSentMessages();
        setSentMessages(sent);
        if (vid) {
          const rawReceivedMessages = await api.getReceivedMessages(vid);
          const validMessageIds = rawReceivedMessages.map((message) => message.id);
          const nextReportedIds = pruneReportedReceivedMessageIds(validMessageIds);
          setReportedReceivedMessageIds(nextReportedIds);
          setReadReceivedMessageIds(pruneReadReceivedMessageIds(validMessageIds));
          setReceivedMessages(
            rawReceivedMessages.filter((message) => !nextReportedIds.includes(message.id))
          );
        } else {
          setReceivedMessages([]);
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

  const handleOpenReceivedMessage = (message) => {
    setReadReceivedMessageIds(markReceivedMessageAsRead(message.id));
    setSelectedReceivedMsg(message);
  };

  const handleOpenReportSheet = (message) => {
    setReportTargetMessage(message);
    setSelectedReportReason('');
  };

  const handleCloseReportSheet = () => {
    if (isSubmittingReport) return;
    setReportTargetMessage(null);
    setSelectedReportReason('');
  };

  const handleSubmitReport = async () => {
    if (!reportTargetMessage || !selectedReportReason || isSubmittingReport) return;

    setIsSubmittingReport(true);
    try {
      await api.reportMessage(reportTargetMessage.id, selectedReportReason, verifiedId);

      setReportedReceivedMessageIds(markReceivedMessageAsReported(reportTargetMessage.id));
      setReceivedMessages((prev) => prev.filter((message) => message.id !== reportTargetMessage.id));
      setSelectedReceivedMsg(null);
      setReportTargetMessage(null);
      setSelectedReportReason('');
      setReportToastMessage('신고를 접수했고 받은 메세지에서 숨겼어요');
      window.setTimeout(() => setReportToastMessage(''), 2500);
    } catch (error) {
      setReportToastMessage(error.message || '신고 접수에 실패했어요');
      window.setTimeout(() => setReportToastMessage(''), 2500);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  return (
    <div className="messages-page">
      <Spacing size={14} />

      <div className="messages-top-section">
        <Top
          title={
            <Top.TitleParagraph
              size={22}
              color={adaptive.grey900}
              style={{ fontSize: '22px' }}
            >
              메세지
            </Top.TitleParagraph>
          }
        />
      </div>

      <Spacing size={12} />

      <div className="messages-segmented-wrap">
        <div className="messages-segmented" role="tablist" aria-label="메세지 탭">
          <button
            className={`messages-segmented-item${activeTab === 'sent' ? ' active' : ''}`}
            onClick={() => setActiveTab('sent')}
            role="tab"
            aria-selected={activeTab === 'sent'}
            type="button"
          >
            내가 보낸 메세지
          </button>
          <button
            className={`messages-segmented-item${activeTab === 'received' ? ' active' : ''}`}
            onClick={() => setActiveTab('received')}
            role="tab"
            aria-selected={activeTab === 'received'}
            type="button"
          >
            받은 메세지
          </button>
        </div>
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
                className={`message-row message-row-tappable${readReceivedMessageIds.includes(msg.id) ? '' : ' message-row-unread'}`}
                onClick={() => handleOpenReceivedMessage(msg)}
              >
                <MessageIcon type="received" />
                <div className="message-row-body">
                  <div className="message-row-top message-row-top--with-indicator">
                    <span>알 수 없는 누군가</span>
                    {!readReceivedMessageIds.includes(msg.id) && (
                      <span className="message-row-unread-indicator" aria-hidden="true" />
                    )}
                  </div>
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
          onReport={handleOpenReportSheet}
        />
      )}

      {reportTargetMessage && (
        <ReportMessageSheet
          message={reportTargetMessage}
          selectedReason={selectedReportReason}
          onSelectReason={setSelectedReportReason}
          onClose={handleCloseReportSheet}
          onSubmit={handleSubmitReport}
          isSubmitting={isSubmittingReport}
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

      {reportToastMessage && (
        <div className="messages-inline-toast" role="status" aria-live="polite">
          {reportToastMessage}
        </div>
      )}
    </div>
  );
}

export default MessagesPage;
