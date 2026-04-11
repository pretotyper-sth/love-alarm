import { useState, useEffect, useRef } from 'react';
import { Button } from '@toss/tds-mobile';
import { api } from '../utils/api';
import { logScreen, logClick } from '../utils/analytics';
import './LikeCountSheet.css';

const IG_VERIFIED_KEY = 'love_alarm_instagram_verified_username';
const CHECKIN30_CLAIMED_KEY = 'love_alarm_checkin30_claimed';
const REWARDED_AD_GROUP_ID = 'ait.v2.live.a0fa3947ad744201';
const IS_DEV = import.meta.env.DEV;
const MIN_SUBMITTABLE_ID_LENGTH = 1;

function isAdFree() {
  if (localStorage.getItem(CHECKIN30_CLAIMED_KEY) === 'true') return true;
  try {
    const user = JSON.parse(localStorage.getItem('love_alarm_user') || '{}');
    return user.adFree === true;
  } catch {
    return false;
  }
}

const isInvalidInstagramId = (text) => {
  const trimmed = text.trim().toLowerCase();
  if (!trimmed) return false;
  if (trimmed.length > 30) return true;
  return !/^[a-z0-9._]+$/.test(trimmed);
};

export function LikeCountSheet({ open, onClose, onResult }) {
  const cachedTarget = localStorage.getItem('love_alarm_like_count_target') || '';
  const verifiedUsername = localStorage.getItem(IG_VERIFIED_KEY) || '';

  const [instagramId, setInstagramId] = useState(cachedTarget || '');
  const [isLoading, setIsLoading] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const isAdLoadedRef = useRef(false);
  const adCleanupRef = useRef(null);

  useEffect(() => {
    if (open) {
      const fresh = localStorage.getItem('love_alarm_like_count_target') || '';
      setInstagramId(fresh || '');
      setSubmitMessage('');
      isAdLoadedRef.current = isAdFree();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    logScreen('like_count_sheet_screen');
  }, [open]);

  useEffect(() => {
    if (!open || isAdFree()) return undefined;

    let cancelled = false;

    const preloadAd = async () => {
      try {
        const { GoogleAdMob } = await import('@apps-in-toss/web-framework');

        if (GoogleAdMob.loadAppsInTossAdMob.isSupported() !== true) {
          if (!cancelled) isAdLoadedRef.current = true;
          return;
        }

        adCleanupRef.current = GoogleAdMob.loadAppsInTossAdMob({
          options: { adGroupId: REWARDED_AD_GROUP_ID },
          onEvent: (event) => {
            if (event.type === 'loaded') {
              if (!cancelled) isAdLoadedRef.current = true;
              adCleanupRef.current?.();
              adCleanupRef.current = null;
            }
          },
          onError: () => {
            if (!cancelled) isAdLoadedRef.current = true;
            adCleanupRef.current?.();
            adCleanupRef.current = null;
          },
        });
      } catch {
        if (!cancelled) isAdLoadedRef.current = true;
      }
    };

    preloadAd();

    return () => {
      cancelled = true;
      adCleanupRef.current?.();
      adCleanupRef.current = null;
    };
  }, [open]);

  const hasError = isInvalidInstagramId(instagramId);
  const trimmedInstagramId = instagramId.trim();
  const canLoadVerifiedId =
    !!verifiedUsername && trimmedInstagramId.toLowerCase() !== verifiedUsername.toLowerCase();

  const isActionReady = !isLoading && trimmedInstagramId.length >= MIN_SUBMITTABLE_ID_LENGTH;

  const handleCheck = async () => {
    const trimmed = instagramId.trim().toLowerCase();
    if (!trimmed) {
      setSubmitMessage('인스타그램 ID를 입력해 주세요');
      return;
    }
    if (hasError) {
      setSubmitMessage('인스타그램 ID 형식에 맞춰 정확하게 입력해 주세요');
      return;
    }

    setIsLoading(true);
    setSubmitMessage('');
    try {
      if (!isAdFree()) {
        const adResult = await showRewardedAd({ isAdLoadedRef });
        if (!adResult.rewarded) {
          if (adResult.cancelled) {
            setSubmitMessage('광고를 끝까지 봐 주세요');
          }
          return;
        }
      }

      // dev 환경: 실제 API 대신 mock 카운트 반환
      const count = IS_DEV
        ? Math.floor(Math.random() * 10) + 1
        : (await api.getLikeCount(trimmed)).count;

      logClick('like_count_result', { count });

      localStorage.setItem('love_alarm_like_count_target', trimmed);
      localStorage.setItem('love_alarm_like_count_result', String(count));
      localStorage.setItem('love_alarm_like_count_checked_at', new Date().toISOString());

      onResult({ targetId: trimmed, count });
      onClose();
    } catch (error) {
      setSubmitMessage(error?.message || '지금은 결과를 불러오지 못했어요. 다시 시도해 주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="lcs-overlay" onClick={onClose} />
      <div className="lcs-sheet">
        <div className="lcs-handle" />

        <div className="lcs-header">
          <h2 className="lcs-title">좋아하는 사람 수 확인하기</h2>
          <p className="lcs-desc">
            인스타그램 ID를 입력하고 짧은 광고를 보면<br />
            지금 몇 명이 좋아하는지 알 수 있어요.
          </p>
        </div>

        <div className="lcs-body">
          <div className="lcs-field">
            <label className="lcs-label">인스타그램 ID</label>
            <div className={`lcs-input-wrap${hasError ? ' error' : ''}`}>
              <input
                className="lcs-input"
                type="text"
                placeholder="예: abcd1234"
                value={instagramId}
                onChange={(e) => {
                  setSubmitMessage('');
                  setInstagramId(e.target.value.toLowerCase());
                }}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <button
                type="button"
                className={`lcs-clear${instagramId ? ' is-visible' : ''}`}
                onClick={() => {
                  setSubmitMessage('');
                  setInstagramId('');
                }}
                aria-label="지우기"
                tabIndex={instagramId ? 0 : -1}
              >
                ×
              </button>
            </div>
            {hasError && (
              <p className="lcs-field-msg error">인스타그램 ID 형식에 맞춰 정확하게 입력해 주세요</p>
            )}
            {!hasError && submitMessage && (
              <p className="lcs-field-msg error">{submitMessage}</p>
            )}
            {verifiedUsername && (
              <button
                type="button"
                className={`lcs-verified-action${canLoadVerifiedId ? '' : ' is-active'}`}
                onClick={() => {
                  setSubmitMessage('');
                  setInstagramId(verifiedUsername);
                }}
              >
                인증된 ID 불러오기
                <span className="lcs-verified-action-id">@{verifiedUsername}</span>
              </button>
            )}
          </div>
        </div>

        <div className="lcs-actions">
          <Button
            size="xlarge"
            display="block"
            onClick={handleCheck}
            disabled={!isActionReady}
            loading={isLoading}
          >
            {isAdFree() ? '확인하기' : '광고 보고 확인하기'}
          </Button>
          <button className="lcs-cancel" onClick={onClose}>
            나중에 하기
          </button>
        </div>
      </div>
    </>
  );
}

async function showRewardedAd({ isAdLoadedRef }) {
  try {
    const { GoogleAdMob } = await import('@apps-in-toss/web-framework');

    if (GoogleAdMob.showAppsInTossAdMob.isSupported() !== true) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { rewarded: true, skipped: true };
    }

    if (!isAdLoadedRef.current) {
      await new Promise((resolve, reject) => {
        const cleanup = GoogleAdMob.loadAppsInTossAdMob({
          options: { adGroupId: REWARDED_AD_GROUP_ID },
          onEvent: (e) => {
            if (e.type === 'loaded') {
              cleanup?.();
              resolve();
            }
          },
          onError: (err) => {
            cleanup?.();
            reject(err);
          },
        });
      });
    }

    return await new Promise((resolve, reject) => {
      let rewarded = false;
      let dismissed = false;

      const finish = () => {
        cleanup?.();
        isAdLoadedRef.current = false;
        resolve({ rewarded });
      };

      logClick('like_count_ad_start');
      const cleanup = GoogleAdMob.showAppsInTossAdMob({
        options: { adGroupId: REWARDED_AD_GROUP_ID },
        onEvent: (e) => {
          if (e.type === 'userEarnedReward') {
            rewarded = true;
            logClick('like_count_ad_complete');
          }
          if (e.type === 'dismissed') {
            dismissed = true;
            // 일부 환경에서는 rewarded 이벤트가 dismissed 직전/직후로 들어올 수 있어 한 틱 기다린다.
            setTimeout(() => {
              if (dismissed) finish();
            }, 150);
          }
          if (e.type === 'failedToShow') {
            cleanup?.();
            reject(new Error('광고를 표시하지 못했어요. 다시 시도해 주세요.'));
          }
        },
        onError: (err) => { cleanup?.(); reject(err); },
      });
    });
  } catch (error) {
    if (error?.code === 'USER_CANCELLED' || error?.message?.includes('cancel')) {
      return { rewarded: false, cancelled: true };
    }
    if (error?.code === 'AD_NOT_READY' || error?.code === 'AD_LOAD_FAILED') {
      return { rewarded: true, skipped: true };
    }
    if (error instanceof Error) throw error;
    throw new Error('광고를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
}
