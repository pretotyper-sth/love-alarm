import { useState, useEffect } from 'react';
import { Button } from '@toss/tds-mobile';
import { api } from '../utils/api';
import './LikeCountSheet.css';

const IG_VERIFIED_KEY = 'love_alarm_instagram_verified_username';
const CHECKIN30_CLAIMED_KEY = 'love_alarm_checkin30_claimed';
const REWARDED_AD_GROUP_ID = 'ait.v2.live.a0fa3947ad744201';
const IS_DEV = import.meta.env.DEV;

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

  useEffect(() => {
    if (open) {
      const fresh = localStorage.getItem('love_alarm_like_count_target') || '';
      setInstagramId(fresh || '');
    }
  }, [open]);

  const hasError = isInvalidInstagramId(instagramId);
  const canLoadVerifiedId =
    !!verifiedUsername && instagramId.trim().toLowerCase() !== verifiedUsername.toLowerCase();

  const handleCheck = async () => {
    const trimmed = instagramId.trim().toLowerCase();
    if (!trimmed || hasError) return;

    setIsLoading(true);
    try {
      if (!isAdFree()) {
        const adResult = await showRewardedAd();
        if (!adResult.rewarded) {
          setIsLoading(false);
          return;
        }
      }

      // dev 환경: 실제 API 대신 mock 카운트 반환
      const count = IS_DEV
        ? Math.floor(Math.random() * 10) + 1
        : (await api.getLikeCount(trimmed)).count;

      localStorage.setItem('love_alarm_like_count_target', trimmed);
      localStorage.setItem('love_alarm_like_count_result', String(count));
      localStorage.setItem('love_alarm_like_count_checked_at', new Date().toISOString());

      onResult({ targetId: trimmed, count });
      onClose();
    } catch {
      // 조용히 실패
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
                onChange={(e) => setInstagramId(e.target.value.toLowerCase())}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              {instagramId && (
                <button
                  className="lcs-clear"
                  onClick={() => setInstagramId('')}
                  aria-label="지우기"
                  tabIndex={-1}
                >
                  ×
                </button>
              )}
            </div>
            {hasError && (
              <p className="lcs-field-msg error">인스타그램 ID 형식에 맞춰 정확하게 입력해 주세요</p>
            )}
            {verifiedUsername && (
              <button
                type="button"
                className={`lcs-verified-action${canLoadVerifiedId ? '' : ' is-active'}`}
                onClick={() => setInstagramId(verifiedUsername)}
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
            disabled={!instagramId.trim() || hasError || isLoading}
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

async function showRewardedAd() {
  try {
    const { GoogleAdMob } = await import('@apps-in-toss/web-framework');

    if (GoogleAdMob.showAppsInTossAdMob.isSupported() !== true) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { rewarded: true, skipped: true };
    }

    await new Promise((resolve, reject) => {
      const cleanup = GoogleAdMob.loadAppsInTossAdMob({
        options: { adGroupId: REWARDED_AD_GROUP_ID },
        onEvent: (e) => { if (e.type === 'loaded') { cleanup?.(); resolve(); } },
        onError: (err) => { cleanup?.(); reject(err); },
      });
    });

    return await new Promise((resolve, reject) => {
      let rewarded = false;
      const cleanup = GoogleAdMob.showAppsInTossAdMob({
        options: { adGroupId: REWARDED_AD_GROUP_ID },
        onEvent: (e) => {
          if (e.type === 'userEarnedReward') rewarded = true;
          if (e.type === 'dismissed') { cleanup?.(); resolve({ rewarded }); }
        },
        onError: (err) => { cleanup?.(); reject(err); },
      });
    });
  } catch {
    return { rewarded: true, skipped: true };
  }
}
