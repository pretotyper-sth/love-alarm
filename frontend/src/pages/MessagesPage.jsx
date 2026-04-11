import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Top, Skeleton, Spacing } from '@toss/tds-mobile';
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
import { logScreen, logClick } from '../utils/analytics';
import { InstagramAuthSheet } from '../components/InstagramAuthSheet';
import './MessagesPage.css';

const IS_DEV = import.meta.env.DEV;
const IG_VERIFIED_KEY = 'love_alarm_instagram_verified_username';
const MSG_CACHE_KEY = 'love_alarm_messages_cache';
const MSG_BADGE_COUNT_KEY = 'love_alarm_msg_badge_count';

function isMockId(id) {
  return typeof id === 'string' && id.startsWith('mock-');
}

function getCachedMessages() {
  try {
    const raw = localStorage.getItem(MSG_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setCachedMessages(sent, received) {
  try {
    localStorage.setItem(MSG_CACHE_KEY, JSON.stringify({ sent, received, ts: Date.now() }));
  } catch { /* ignore */ }
}
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
                >
                  <img
                    src={asset?.url}
                    alt=""
                    className="msg-sheet-emoji-img"
                    draggable={false}
                  />
                  {currentEmoji === emoji && (
                    <span className="msg-sheet-emoji-check">✓</span>
                  )}
                </button>
              );
            })}
          </div>
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
  const [activeTab, setActiveTab] = useState('sent'); // 'sent' | 'received'
  const initialActiveTabRef = useRef(activeTab);
  const cachedRef = useRef(getCachedMessages());
  const [sentMessages, setSentMessages] = useState(() => cachedRef.current?.sent ?? []);
  const [receivedMessages, setReceivedMessages] = useState(() => cachedRef.current?.received ?? []);
  const [readReceivedMessageIds, setReadReceivedMessageIds] = useState(() => loadReadReceivedMessageIds());
  const [, setReportedReceivedMessageIds] = useState(() => loadReportedReceivedMessageIds());
  const [isLoading, setIsLoading] = useState(() => !cachedRef.current);
  const prevCountRef = useRef({
    sent: cachedRef.current?.sent?.length ?? 0,
    received: cachedRef.current?.received?.length ?? 0,
  });
  // 받은 메시지 상세 시트
  const [selectedReceivedMsg, setSelectedReceivedMsg] = useState(null);
  // 보낸 메시지 상세 시트
  const [selectedSentMsg, setSelectedSentMsg] = useState(null);
  // 인증 시트
  const [showAuthSheet, setShowAuthSheet] = useState(false);
  // 인증 상태 (시트에서 인증 후 즉시 반영)
  const [verifiedId, setVerifiedId] = useState(() => localStorage.getItem(IG_VERIFIED_KEY));
  const isVerified = !!verifiedId;
  const [reportTargetMessage, setReportTargetMessage] = useState(null);
  const [selectedReportReason, setSelectedReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportToast, setReportToast] = useState({ show: false, message: '', type: 'success' });

  const MOCK_SENT = IS_DEV ? [
    { id: 'mock-s1', targetInstagramId: 'cute_puppy_lover', message: '혹시 강남역 스타벅스에서 자주 보이시는 분 맞나요? 용기 내서 보내봐요 ☕', createdAt: '2026-04-10T09:12:00Z', reactions: [{ emoji: '❤️' }] },
    { id: 'mock-s2', targetInstagramId: 'music_wave_99', message: '같은 수업 듣는 거 맞죠? 한번 말 걸어보고 싶었어요', createdAt: '2026-04-09T18:30:00Z', reactions: [] },
  ] : [];
  const MOCK_RECEIVED = IS_DEV ? [
    { id: 'mock-r1', fromInstagramId: null, message: '항상 밝게 웃으시는 게 좋아서 알람 보내봐요 😊', createdAt: '2026-04-09T20:15:00Z', reactions: [] },
  ] : [];

  const loadMessages = useCallback(async (currentVerifiedId) => {
    const vid = currentVerifiedId ?? verifiedId;
    const hasCache = !!cachedRef.current;
    if (!hasCache) setIsLoading(true);
    try {
      let sent;
      try {
        sent = await api.getSentMessages();
      } catch {
        sent = [];
      }
      const mergedSent = [...sent, ...MOCK_SENT];
      setSentMessages(mergedSent);
      prevCountRef.current.sent = mergedSent.length;
      let filteredReceived;
      if (vid) {
        let rawReceivedMessages;
        try {
          rawReceivedMessages = await api.getReceivedMessages(vid);
        } catch {
          rawReceivedMessages = [];
        }
        const allReceived = [...rawReceivedMessages, ...MOCK_RECEIVED];
        const validMessageIds = allReceived.map((message) => message.id);
        const nextReportedIds = pruneReportedReceivedMessageIds(validMessageIds);
        setReportedReceivedMessageIds(nextReportedIds);
        setReadReceivedMessageIds(pruneReadReceivedMessageIds(validMessageIds));
        filteredReceived = allReceived.filter((message) => !nextReportedIds.includes(message.id));
        setReceivedMessages(filteredReceived);
        prevCountRef.current.received = filteredReceived.length;
      } else {
        filteredReceived = [...MOCK_RECEIVED];
        setReceivedMessages(filteredReceived);
        prevCountRef.current.received = filteredReceived.length;
      }
      setCachedMessages(mergedSent, filteredReceived);
      cachedRef.current = { sent: mergedSent, received: filteredReceived };
    } catch (err) {
      console.error('메시지 로드 실패:', err);
    } finally {
      setIsLoading(false);
    }
  }, [verifiedId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    logScreen('messages_screen', { tab: initialActiveTabRef.current });
  }, []);

  const handleTabChange = (newTab) => {
    if (newTab === activeTab) return;
    setActiveTab(newTab);
    logClick('messages_tab_switch', { tab: newTab });
  };

  const handleReact = async (alarmId, emoji) => {
    logClick('message_reaction_click', { emoji });
    // optimistic update
    setReceivedMessages(prev =>
      prev.map(m =>
        m.id === alarmId ? { ...m, reactions: [{ emoji }] } : m
      )
    );
    setSelectedReceivedMsg(prev =>
      prev?.id === alarmId ? { ...prev, reactions: [{ emoji }] } : prev
    );

    if (!isMockId(alarmId)) {
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
    logClick('message_detail_open', { type: 'received' });
    const nextReadIds = markReceivedMessageAsRead(message.id);
    setReadReceivedMessageIds(nextReadIds);
    setSelectedReceivedMsg(message);
    // 홈 배지 카운트 즉시 동기화 (API 대기 없이 복귀 시 반영)
    const readSet = new Set(nextReadIds);
    const reportedSet = new Set(loadReportedReceivedMessageIds());
    const unread = receivedMessages.filter(m => !readSet.has(m.id) && !reportedSet.has(m.id)).length;
    localStorage.setItem(MSG_BADGE_COUNT_KEY, String(unread));
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

    logClick('message_report_click', { reason: selectedReportReason });
    setIsSubmittingReport(true);
    try {
      if (!isMockId(reportTargetMessage.id)) {
        await api.reportMessage(reportTargetMessage.id, selectedReportReason, verifiedId);
      }

      const nextReportedIds = markReceivedMessageAsReported(reportTargetMessage.id);
      setReportedReceivedMessageIds(nextReportedIds);
      setReceivedMessages((prev) => {
        const next = prev.filter((message) => message.id !== reportTargetMessage.id);
        setCachedMessages(sentMessages, next);
        // 홈 배지 카운트 즉시 동기화
        const readSet = new Set(readReceivedMessageIds);
        const reportedSet = new Set(nextReportedIds);
        const unread = next.filter(m => !readSet.has(m.id) && !reportedSet.has(m.id)).length;
        localStorage.setItem(MSG_BADGE_COUNT_KEY, String(unread));
        return next;
      });
      setSelectedReceivedMsg(null);
      setReportTargetMessage(null);
      setSelectedReportReason('');
      setReportToast({ show: true, message: '신고 및 숨김 처리를 완료했어요', type: 'success' });
      window.setTimeout(() => setReportToast(prev => ({ ...prev, show: false })), 3000);
    } catch (error) {
      setReportToast({ show: true, message: error.message || '신고 접수에 실패했어요', type: 'error' });
      window.setTimeout(() => setReportToast(prev => ({ ...prev, show: false })), 3000);
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
              메시지
            </Top.TitleParagraph>
          }
        />
      </div>

      <Spacing size={12} />

      <div className="messages-segmented-wrap">
        <div className="messages-segmented" role="tablist" aria-label="메시지 탭">
          <button
            className={`messages-segmented-item${activeTab === 'sent' ? ' active' : ''}`}
            onClick={() => handleTabChange('sent')}
            role="tab"
            aria-selected={activeTab === 'sent'}
            type="button"
          >
            내가 보낸 메시지
          </button>
          <button
            className={`messages-segmented-item${activeTab === 'received' ? ' active' : ''}`}
            onClick={() => handleTabChange('received')}
            role="tab"
            aria-selected={activeTab === 'received'}
            type="button"
          >
            받은 메시지
          </button>
        </div>
      </div>

      {/* 보낸 메시지 탭 */}
      {activeTab === 'sent' && (
        <div className="messages-content">
          {isLoading ? (
            <div className="messages-skeleton-wrap">
              <Skeleton custom={['listWithIcon']} repeatLastItemCount={Math.max(prevCountRef.current.sent, 1)} />
            </div>
          ) : sentMessages.length === 0 ? (
            <div className="messages-empty">
              <p className="messages-empty-title">아직 보낸 메시지가 없어요.</p>
              <p className="messages-empty-desc">알람을 추가할 때 메시지도 함께 보낼 수 있어요.</p>
              <button className="messages-empty-btn" onClick={() => navigate('/add')}>
                알람 추가하러 가기
              </button>
            </div>
          ) : (
            sentMessages.map((msg) => (
              <div
                key={msg.id}
                className="message-row message-row-tappable"
                onClick={() => {
                  logClick('message_detail_open', { type: 'sent' });
                  setSelectedSentMsg(msg);
                }}
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

      {/* 받은 메시지 탭 */}
      {activeTab === 'received' && (
        <div className="messages-content">
          {!isVerified ? (
            <InstagramAuthCta
              onVerify={() => {
                logClick('instagram_auth_cta_click');
                setShowAuthSheet(true);
              }}
            />
          ) : isLoading ? (
            <div className="messages-skeleton-wrap">
              <Skeleton custom={['listWithIcon']} repeatLastItemCount={Math.max(prevCountRef.current.received, 1)} />
            </div>
          ) : receivedMessages.length === 0 ? (
            <div className="messages-empty">
              <p className="messages-empty-title">아직 받은 메시지가 없어요.</p>
              <p className="messages-empty-desc">누군가 메시지를 보내면 여기서 확인할 수 있어요.</p>
            </div>
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

      {/* 받은 메시지 상세 시트 */}
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

      {/* 보낸 메시지 상세 시트 */}
      {selectedSentMsg && (
        <SentMessageDetailSheet
          message={selectedSentMsg}
          onClose={() => setSelectedSentMsg(null)}
        />
      )}

      {/* 인스타그램 인증 시트 (받은 메시지 탭 CTA에서 진입) */}
      <InstagramAuthSheet
        open={showAuthSheet}
        onClose={() => setShowAuthSheet(false)}
        onSuccess={handleAuthSuccess}
      />

      <div className="toast-stack messages-toast-stack">
        <div
          className={`custom-toast ${reportToast.show ? 'show' : ''}${reportToast.type === 'error' ? ' error' : ''}`}
          style={{ bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="custom-toast-content">
            <span className="custom-toast-icon">{reportToast.type === 'error' ? '!' : '✓'}</span>
            <span className="custom-toast-text">{reportToast.message}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MessagesPage;
