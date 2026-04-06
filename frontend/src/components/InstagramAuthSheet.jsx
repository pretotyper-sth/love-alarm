import { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Spacing } from '@toss/tds-mobile';
import { api } from '../utils/api';
import './InstagramAuthSheet.css';

const IG_HANDLE = 'lovealarm.kr';

export function InstagramAuthSheet({
  open,
  onClose,
  onSuccess,
  alreadyVerified = false,
  currentVerifiedUsername = '',
}) {
  const [username, setUsername] = useState('');
  const [stage, setStage] = useState('input'); // 'input' | 'waiting'
  const [sessionId, setSessionId] = useState(null);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(600);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const otpRefs = useRef([]);
  const confirmingRef = useRef(false);

  // 열릴 때 상태 초기화
  useEffect(() => {
    if (open) {
      setUsername('');
      setStage('input');
      setSessionId(null);
      setOtp(['', '', '', '', '', '']);
      setCountdown(600);
      setError('');
      setCopied(false);
      confirmingRef.current = false;
    }
  }, [open]);

  // 카운트다운
  useEffect(() => {
    if (stage !== 'waiting' || countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [stage, countdown]);

  useEffect(() => {
    if (stage === 'waiting' && countdown === 0) {
      setStage('input');
      setError('인증 시간이 만료되었습니다. 다시 시작해 주세요.');
    }
  }, [stage, countdown]);

  const formatCountdown = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleRequestCode = async () => {
    const trimmed = username.trim().toLowerCase().replace(/^@/, '');
    if (!trimmed) return;
    if (alreadyVerified && trimmed === currentVerifiedUsername) {
      setError('현재 인증된 ID로는 재인증할 수 없어요.');
      return;
    }

    setIsRequesting(true);
    setError('');
    try {
      const data = await api.verifyInstagramStart(trimmed);
      setSessionId(data.sessionId);
      setStage('waiting');
      setCountdown(600);
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 300);
    } catch (err) {
      setError(err.message || '코드 요청에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleConfirm = useCallback(async (codeStr) => {
    if (confirmingRef.current || !sessionId || !codeStr || codeStr.length !== 6) return;
    confirmingRef.current = true;

    setIsConfirming(true);
    setError('');
    try {
      const data = await api.verifyInstagramConfirm(sessionId, codeStr);
      const verifiedUsername = data.instagramUsername
        || username.trim().toLowerCase().replace(/^@/, '');
      localStorage.setItem('love_alarm_instagram_verified_username', verifiedUsername);
      onSuccess?.(verifiedUsername);
    } catch {
      setError('코드가 일치하지 않거나 만료되었습니다.');
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
      confirmingRef.current = false;
    } finally {
      setIsConfirming(false);
    }
  }, [sessionId, username, onSuccess]);

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
    if (newOtp.every(d => d !== '')) {
      handleConfirm(newOtp.join(''));
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      const newOtp = text.split('');
      setOtp(newOtp);
      otpRefs.current[5]?.focus();
      handleConfirm(text);
    }
  };

  const handleCopyHandle = async () => {
    try {
      await navigator.clipboard.writeText(IG_HANDLE); // @ 없이 복사 (데모 기준)
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 API 미지원 시 무시
    }
  };

  const otpCode = otp.join('');
  const isOtpComplete = otpCode.length === 6 && otp.every(d => d !== '');

  const isInvalidId = (text) => {
    const trimmed = text.trim().toLowerCase();
    if (!trimmed) return false;
    if (trimmed.length > 30) return true;
    return !/^[a-z0-9._]+$/.test(trimmed);
  };

  const idHasError = isInvalidId(username);
  const normalizedUsername = username.trim().toLowerCase().replace(/^@/, '');
  const isSameAsCurrentVerified =
    alreadyVerified &&
    !!currentVerifiedUsername &&
    normalizedUsername.length > 0 &&
    normalizedUsername === currentVerifiedUsername;
  const canRequest =
    username.trim().length > 0 &&
    !idHasError &&
    !isSameAsCurrentVerified &&
    !isRequesting &&
    stage === 'input';

  return (
    <>
      <div className={`ig-auth-overlay ${open ? 'show' : ''}`} onClick={onClose} />
      <div className={`ig-auth-sheet ${open ? 'show' : ''}`} onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="ig-auth-header">
          <h3 className="ig-auth-title">인스타그램 인증</h3>
          <p className="ig-auth-desc">
            {alreadyVerified ? (
              <>
                재인증 시 인증됐던 ID가 변경되고<br />
                기존 ID로 등록했던 알람은 모두 삭제돼요.
              </>
            ) : (
              '한 번만 인증하면 모든 기능을 이용할 수 있어요.'
            )}
          </p>
        </div>

        <div className="ig-auth-body">
          {/* Step 1 */}
          <div className="ig-auth-step">
            <span className="ig-auth-step-num">1</span>
            <div className="ig-auth-step-content">
              <p className="ig-auth-step-label">인스타그램 ID 입력</p>
              <div className="ig-auth-step1-row">
                <input
                  className={`ig-auth-id-input${idHasError ? ' error' : ''}`}
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value.replace(/^@/, ''))}
                  placeholder="예: abcd1234"
                  disabled={stage === 'waiting'}
                  onKeyDown={e => e.key === 'Enter' && canRequest && handleRequestCode()}
                  autoCapitalize="none"
                  autoCorrect="off"
                />
                <button
                  className={`ig-auth-code-btn ${stage === 'waiting' ? 'waiting' : ''}`}
                  onClick={stage === 'input' ? handleRequestCode : undefined}
                  disabled={!canRequest && stage === 'input'}
                >
                  {stage === 'waiting'
                    ? '코드 대기 중'
                    : isRequesting ? '요청 중…' : '코드 요청하기'}
                </button>
              </div>
              {idHasError && (
                <p className="ig-auth-id-error">인스타그램 ID 형식에 맞춰 정확하게 입력해 주세요</p>
              )}
              {!idHasError && isSameAsCurrentVerified && (
                <p className="ig-auth-id-error">현재 인증된 ID로는 재인증할 수 없어요.</p>
              )}
            </div>
          </div>

          {/* Steps 2~4: 코드 요청 후 노출 */}
          {stage === 'waiting' && (
            <>
              {/* Step 2 */}
              <div className="ig-auth-step">
                <span className="ig-auth-step-num">2</span>
                <div className="ig-auth-step-content">
                  <div className="ig-auth-step2-row">
                    <p className="ig-auth-step-label">
                      <span className="ig-auth-handle">@{IG_HANDLE}</span> 을 팔로우해요
                    </p>
                    <button className={`ig-auth-copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopyHandle}>
                      {copied ? '복사됨' : '복사'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="ig-auth-step">
                <span className="ig-auth-step-num">3</span>
                <div className="ig-auth-step-content">
                  <p className="ig-auth-step-label">
                    DM으로 <span className="ig-auth-keyword">'인증'</span> 이라고 보내요
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="ig-auth-step">
                <span className="ig-auth-step-num">4</span>
                <div className="ig-auth-step-content">
                  <p className="ig-auth-step-label">
                    받은 6자리 코드를 입력해요
                    {countdown > 0 && (
                      <span className={`ig-auth-timer${countdown <= 60 ? ' expiring' : ''}`}>
                        {formatCountdown(countdown)}
                      </span>
                    )}
                    {countdown === 0 && (
                      <span className="ig-auth-timer expiring"> 만료됨</span>
                    )}
                  </p>
                  <div className="ig-auth-otp-row" onPaste={handleOtpPaste}>
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        ref={el => (otpRefs.current[i] = el)}
                        className={`ig-auth-otp-box${digit ? ' filled' : ''}${i === 3 ? ' otp-gap' : ''}`}
                        type="tel"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(i, e)}
                        disabled={isConfirming}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* 안내 */}
              <div className="ig-auth-notice">
                <p className="ig-auth-notice-title">※ 다음의 경우 코드가 오지 않아요.</p>
                <p className="ig-auth-notice-item">· 팔로우를 하지 않은 경우</p>
                <p className="ig-auth-notice-item">· '인증'이 아닌 다른 메시지를 보낸 경우</p>
              </div>
            </>
          )}

          {/* 에러 */}
          {error && <p className="ig-auth-error">{error}</p>}
        </div>

        {/* 하단 버튼 */}
        <div className="ig-auth-footer">
          <div className="ig-auth-btn-row">
            <Button
              size="large"
              display="block"
              color="dark"
              variant="weak"
              onClick={onClose}
              disabled={isConfirming}
              style={{ '--button-background-color': '#f2f4f6', '--button-color': '#6b7684' }}
            >
              취소
            </Button>
            {stage === 'waiting' && (
              <Button
                size="large"
                display="block"
                onClick={() => handleConfirm(otpCode)}
                disabled={!isOtpComplete || isConfirming}
                loading={isConfirming}
              >
                확인
              </Button>
            )}
          </div>
        </div>

      </div>
    </>
  );
}
