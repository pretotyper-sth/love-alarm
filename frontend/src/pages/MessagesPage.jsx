import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Top, Skeleton, Spacing } from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { api } from '../utils/api';
import {
  loadReadReceivedMessageIds,
  markReceivedMessageAsReported,
  markReceivedMessageAsRead,
  pruneReadReceivedMessageIds,
  pruneReportedReceivedMessageIds,
} from '../utils/messages';
import { logScreen, logClick } from '../utils/analytics';
import { InstagramAuthSheet } from '../components/InstagramAuthSheet';
import { MessagePassSheet } from '../components/MessagePassSheet';
import './MessagesPage.css';

const IG_VERIFIED_KEY = 'love_alarm_instagram_verified_username';
const MSG_BADGE_COUNT_KEY = 'love_alarm_msg_badge_count';

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

// ──────────────────────────────────────────────────────────────────────
// 메시지 아이콘 컴포넌트 — TDS Asset squircle 스타일 (2D 이모지)
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

// 이모지 → 토스 2D 에셋 매핑
const EMOJI_ASSET_MAP = {
  '❤️': { url: 'https://static.toss.im/2d-emojis/png/4x/u2764.png', label: '좋아해요' },
  '😊': { url: 'https://static.toss.im/2d-emojis/png/4x/u1F60A.png', label: '고마워요' },
  '🤔': { url: 'https://static.toss.im/2d-emojis/png/4x/u1F914.png', label: '누구지?' },
  '😳': { url: 'https://static.toss.im/2d-emojis/png/4x/u1F633.png', label: '두근두근' },
  '🥹': { url: 'https://static.toss.im/2d-emojis/png/4x/u1F979.png', label: '감동이에요' },
};

// ──────────────────────────────────────────────────────────────────────
// SentMessageDetailSheet — 보낸 메시지 상세 (반응 수신 확인용)
// ──────────────────────────────────────────────────────────────────────
function SentMessageDetailSheet({ message, onClose }) {
  if (!message) return null;
  const reaction = message.reactions?.[0]?.emoji ?? null;
  const reactionAsset = reaction ? EMOJI_ASSET_MAP[reaction] : null;

  return (
    <>
      <div className="msg-sheet-overlay" onClick={onClose} />
      <div className="msg-sheet">
        <div className="msg-sheet-handle" />

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

        <div className="msg-sheet-card">
          <p className="msg-sheet-text">{message.message}</p>
        </div>

        <div className="msg-sheet-react-section">
          <span className="msg-sheet-react-label">상대방의 반응</span>
          {reactionAsset ? (
            <div className="msg-sent-reaction-card">
              <img
                src={reactionAsset.url}
                alt={reactionAsset.label}
                className="msg-sent-reaction-emoji"
                draggable={false}
              />
              <span className="msg-sent-reaction-label">{reactionAsset.label}</span>
            </div>
          ) : (
            <div className="msg-no-reaction-card">
              <img
                src="https://static.toss.im/2d-emojis/png/4x/u23F3.png"
                alt=""
                className="msg-no-reaction-emoji"
                draggable={false}
              />
              <span className="msg-no-reaction-label">아직 반응이 없어요</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────
// MessageDetailSheet — 받은 메시지 상세 바텀시트
// ──────────────────────────────────────────────────────────────────────
function MessageDetailSheet({ message, onClose, onReact, onReport, reacting }) {
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

        {/* 메시지 카드 */}
        <div className="msg-sheet-card">
          <p className="msg-sheet-text">{message.message}</p>
        </div>

        {/* 반응하기 섹션 */}
        <div className="msg-sheet-react-section">
          <span className="msg-sheet-react-label">반응하기</span>
          <div className="msg-sheet-emoji-row">
            {EMOJIS.map((emoji) => {
              const asset = EMOJI_ASSET_MAP[emoji];
              return (
                <button
                  key={emoji}
                  className={`msg-sheet-emoji-btn${currentEmoji === emoji ? ' active' : ''}`}
                  onClick={() => onReact(message.id, emoji)}
                  aria-label={asset?.label || emoji}
                  aria-pressed={currentEmoji === emoji}
                  disabled={!!currentEmoji || reacting}
                >
                  <img
                    src={asset?.url}
                    alt=""
                    className="msg-sheet-emoji-img"
                    draggable={false}
                  />
                </button>
              );
            })}
          </div>
          <p className="msg-sheet-react-description">이모지를 누르면 보낸 사람에게 반응이 전달돼요.<br />반응은 한 번만 보낼 수 있고, 보낸 뒤에는 바꿀 수 없어요.</p>
        </div>

        <div className="msg-sheet-report-section">
          <div className="msg-sheet-report-copy">
            불쾌하거나 부적절한 메시지라면 신고할 수 있어요.
          </div>
          <button className="msg-sheet-report-trigger" type="button" onClick={() => onReport(message)}>
            이 메시지 신고하기
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
          <h3 className="msg-report-title">이 메시지를 신고할까요?</h3>
          <p className="msg-report-desc">
            신고 사유를 선택해 주세요.
            <br />
            제출하면 이 메시지는 받은 목록에서 숨겨져요.
          </p>
        </div>

        <div className="msg-report-preview">
          <p className="msg-report-preview-text">{message.locked ? '아직 열지 않은 메시지' : truncateText(message.message, 70)}</p>
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
              <span className="msg-report-reason-check" aria-hidden="true" style={{ visibility: selectedReason === reason ? 'visible' : 'hidden' }}>✓</span>
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
// InstagramAuthCta — 받은 메시지 탭 미인증 CTA
// ──────────────────────────────────────────────────────────────────────
function InstagramAuthCta({ onVerify }) {
  return (
    <div className="messages-empty">
      <p className="messages-empty-title">받은 메시지를 확인하려면 인증이 필요해요.</p>
      <p className="messages-empty-desc">본인 확인이 끝나면 바로 볼 수 있어요.</p>
      <button className="messages-empty-btn messages-empty-btn--primary" onClick={onVerify}>
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
  const [activeTab, setActiveTab] = useState('received');
  const [sentMessages, setSentMessages] = useState([]);
  const [receivedMessages, setReceivedMessages] = useState([]);
  const [readReceivedMessageIds, setReadReceivedMessageIds] = useState(() => loadReadReceivedMessageIds());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedReceivedMsg, setSelectedReceivedMsg] = useState(null);
  const [selectedLockedMsg, setSelectedLockedMsg] = useState(null);
  const [selectedSentMsg, setSelectedSentMsg] = useState(null);
  const [showAuthSheet, setShowAuthSheet] = useState(false);
  const [verifiedId, setVerifiedId] = useState(null);
  const [, setWallet] = useState(null);
  const [reportTargetMessage, setReportTargetMessage] = useState(null);
  const [selectedReportReason, setSelectedReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportToast, setReportToast] = useState({ show: false, message: '', type: 'success' });
  const opening = useRef(false);
  const reactionLock = useRef(false);
  const [reacting, setReacting] = useState(false);
  const isVerified = !!verifiedId;

  const loadMessages = useCallback(async () => {
    setIsLoading(true); setLoadError('');
    // Previous versions cached complete received bodies. Never use that cache for access decisions.
    localStorage.removeItem('love_alarm_messages_cache');
    const [sent, received, passes] = await Promise.allSettled([
      api.getSentMessages(), api.getReceivedMessageState(), api.getMessagePassWallet(),
    ]);
    if (sent.status === 'fulfilled') setSentMessages(sent.value);
    if (received.status === 'fulfilled') {
      setVerifiedId(received.value.instagramId);
      localStorage.setItem(IG_VERIFIED_KEY, received.value.instagramId);
      setReceivedMessages(received.value.messages);
      pruneReportedReceivedMessageIds(received.value.messages.map(m => m.id));
      setReadReceivedMessageIds(pruneReadReceivedMessageIds(received.value.messages.map(m => m.id)));
    } else if (received.reason.code === 'INSTAGRAM_REQUIRED') {
      setVerifiedId(null); setReceivedMessages([]);
      localStorage.removeItem(IG_VERIFIED_KEY);
    } else setLoadError(received.reason.message);
    if (passes.status === 'fulfilled') setWallet(passes.value);
    if (sent.status === 'rejected') setLoadError(sent.reason.message);
    setIsLoading(false);
  }, []);

  useEffect(() => { void loadMessages(); }, [loadMessages]);
  useEffect(() => { logScreen('messages_screen', { tab: 'received' }); }, []);

  function showError(message) { setReportToast({ show: true, message, type: 'error' }); }
  function handleTabChange(tab) {
    setActiveTab(tab); logClick('messages_tab_switch', { tab });
  }
  function handleWalletChange(balance) { setWallet(current => ({ ...current, balance })); }
  function handleOpened(message) {
    logClick('message_detail_open', { type: 'received' });
    setReadReceivedMessageIds(markReceivedMessageAsRead(message.id));
    setReceivedMessages(current => current.map(m => m.id === message.id ? message : m));
    setSelectedLockedMsg(null); setSelectedReceivedMsg(message);
    void api.getMessagePassWallet().then(setWallet).catch(() => {});
  }
  async function handleOpenReceivedMessage(message) {
    if (message.locked) { setSelectedLockedMsg(message); return; }
    if (opening.current) return;
    opening.current = true;
    try {
      const result = await api.openReceivedMessage(message.id);
      handleWalletChange(result.balance); handleOpened(result.message);
    } catch (error) { showError(error.message); }
    finally { opening.current = false; }
  }
  useEffect(() => {
    const read = new Set(readReceivedMessageIds);
    const count = receivedMessages.filter(m => !read.has(m.id)).length;
    localStorage.setItem(MSG_BADGE_COUNT_KEY, String(count));
  }, [receivedMessages, readReceivedMessageIds]);

  async function handleReact(messageId, emoji) {
    if (reactionLock.current || selectedReceivedMsg?.reactions?.length) return;
    reactionLock.current = true; setReacting(true);
    try {
      const result = await api.reactToMessage(messageId, emoji);
      emoji = result.reaction.emoji;
      setReceivedMessages(current => current.map(m => m.id === messageId ? { ...m, reactions: [{ emoji }] } : m));
      setSelectedReceivedMsg(current => current?.id === messageId ? { ...current, reactions: [{ emoji }] } : current);
    } catch (error) { showError(error.message); }
    finally { reactionLock.current = false; setReacting(false); }
  }
  function handleAuthSuccess() { setShowAuthSheet(false); void loadMessages(); }
  function handleOpenReportSheet(message) { setReportTargetMessage(message); setSelectedReportReason(''); }
  function handleCloseReportSheet() { if (!isSubmittingReport) setReportTargetMessage(null); }
  async function handleSubmitReport() {
    if (!reportTargetMessage || !selectedReportReason || isSubmittingReport) return;
    setIsSubmittingReport(true);
    try {
      await api.reportMessage(reportTargetMessage.id, selectedReportReason);
      markReceivedMessageAsReported(reportTargetMessage.id);
      setReceivedMessages(current => current.filter(m => m.id !== reportTargetMessage.id));
      setSelectedReceivedMsg(null); setSelectedLockedMsg(null); setReportTargetMessage(null);
      setReportToast({ show: true, message: '신고하고 숨겼어요. 위반이 확인되면 사용한 열람권을 돌려드려요.', type: 'success' });
    } catch (error) { showError(error.message); }
    finally { setIsSubmittingReport(false); }
  }

  return <div className="messages-page">
    <Spacing size={14} />
    <div className="messages-top-section"><Top title={<Top.TitleParagraph size={22} color={adaptive.grey900}>메시지</Top.TitleParagraph>} /></div>
    <Spacing size={12} />
    <div className="messages-segmented-wrap"><div className="messages-segmented" role="tablist" aria-label="메시지 탭">
      <button className={`messages-segmented-item${activeTab === 'sent' ? ' active' : ''}`} onClick={() => handleTabChange('sent')} role="tab" aria-selected={activeTab === 'sent'}>내가 보낸 메시지</button>
      <button className={`messages-segmented-item${activeTab === 'received' ? ' active' : ''}`} onClick={() => handleTabChange('received')} role="tab" aria-selected={activeTab === 'received'}>받은 메시지</button>
    </div></div>
    {loadError && <div className="messages-load-error" role="alert">{loadError}<button className="messages-empty-btn" onClick={loadMessages}>다시 불러오기</button></div>}
    {activeTab === 'sent' && <div className="messages-content">
      {isLoading ? <Skeleton custom={['listWithIcon']} repeatLastItemCount={1} /> : sentMessages.length === 0 ? <div className="messages-empty">
        <p className="messages-empty-title">아직 보낸 메시지가 없어요.</p><p className="messages-empty-desc">알람을 추가할 때 메시지도 함께 보낼 수 있어요.</p>
        <button className="messages-empty-btn" onClick={() => navigate('/add')}>알람 추가하러 가기</button>
      </div> : sentMessages.map(msg => <button key={msg.id} className="message-row message-row-tappable" onClick={() => setSelectedSentMsg(msg)}>
        <MessageIcon type="sent" /><div className="message-row-body"><div className="message-row-top">To: @{msg.targetInstagramId}</div>
        <div className="message-row-preview">{truncateText(msg.message)}</div><div className="message-row-bottom">{msg.reactions?.[0]?.emoji ? `${msg.reactions[0].emoji} 반응` : '반응 없음'} · {formatDate(msg.createdAt)}</div></div>
      </button>)}
    </div>}
    {activeTab === 'received' && <div className="messages-content">
      {isLoading ? <Skeleton custom={['listWithIcon']} repeatLastItemCount={1} /> : !isVerified ? <InstagramAuthCta onVerify={() => setShowAuthSheet(true)} /> : receivedMessages.length === 0 ? <div className="messages-empty">
        <p className="messages-empty-title">아직 받은 메시지가 없어요.</p><p className="messages-empty-desc">누군가 메시지를 보내면 여기서 확인할 수 있어요.</p>
      </div> : receivedMessages.map(msg => <button key={msg.id} className={`message-row message-row-tappable${readReceivedMessageIds.includes(msg.id) ? '' : ' message-row-unread'}`} onClick={() => handleOpenReceivedMessage(msg)}>
        <MessageIcon type="received" /><div className="message-row-body"><div className="message-row-top message-row-top--with-indicator"><span>알 수 없는 누군가</span>
        {!readReceivedMessageIds.includes(msg.id) && <span className="message-row-unread-indicator" aria-hidden="true" />}</div>
        <div className="message-row-preview">{msg.locked ? '열람권으로 메시지를 확인해 보세요' : truncateText(msg.message)}</div>
        <div className="message-row-bottom">{msg.locked ? '잠긴 메시지 · ' : ''}{formatDate(msg.createdAt)}</div></div>
      </button>)}
    </div>}
    {selectedReceivedMsg && <MessageDetailSheet message={selectedReceivedMsg} onClose={() => setSelectedReceivedMsg(null)} onReact={handleReact} reacting={reacting} onReport={handleOpenReportSheet} />}
    {selectedLockedMsg && !reportTargetMessage && <MessagePassSheet key={selectedLockedMsg.id} message={selectedLockedMsg} onOpened={handleOpened} onClose={() => setSelectedLockedMsg(null)} onReport={handleOpenReportSheet} onWalletChange={handleWalletChange} />}
    {reportTargetMessage && <ReportMessageSheet message={reportTargetMessage} selectedReason={selectedReportReason} onSelectReason={setSelectedReportReason} onClose={handleCloseReportSheet} onSubmit={handleSubmitReport} isSubmitting={isSubmittingReport} />}
    {selectedSentMsg && <SentMessageDetailSheet message={selectedSentMsg} onClose={() => setSelectedSentMsg(null)} />}
    <InstagramAuthSheet open={showAuthSheet} onClose={() => setShowAuthSheet(false)} onSuccess={handleAuthSuccess} />
    {reportToast.show && <div className="messages-load-error" role="status">{reportToast.message}<button onClick={() => setReportToast(current => ({ ...current, show: false }))}>닫기</button></div>}
  </div>;
}
export default MessagesPage;
