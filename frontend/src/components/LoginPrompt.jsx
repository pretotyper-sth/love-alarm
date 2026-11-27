import { useEffect, useRef, useId } from 'react';
import { Button } from '@toss/tds-mobile';
import './LoginPrompt.css';

export function LoginPrompt({ title, busy, error, onConfirm, onClose }) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const previousFocus = document.activeElement;
    dialogRef.current?.querySelector('button')?.focus();
    return () => previousFocus?.focus?.();
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === 'Escape' && !busy) onClose();
    if (event.key !== 'Tab') return;
    const buttons = [...dialogRef.current.querySelectorAll('button:not(:disabled)')];
    if (!buttons.length) { event.preventDefault(); return; }
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  return (
    <div className="login-prompt-backdrop" onClick={() => { if (!busy) onClose(); }}>
      <section ref={dialogRef} className="login-prompt" role="dialog" aria-modal="true" aria-labelledby={titleId}
        aria-busy={busy} onClick={event => event.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="login-prompt-header"><span>토스 로그인 · 로컬 미리보기</span><button onClick={onClose} disabled={busy}>닫기</button></div>
        <span className="login-prompt-preview">좋아하면 울리는</span>
        <h2 id={titleId}>{title}</h2>
        <p>실제 앱에서는 이 단계에서 토스 로그인 창이 열려요.</p><div className="login-preview-account">미리보기 사용자<span>실제 계정과 연결하지 않아요</span></div>
        {error && <p className="login-prompt-error" role="alert">{error}</p>}
        <Button display="block" size="large" onClick={onConfirm} loading={busy} disabled={busy}>
          가상 로그인 완료
        </Button>
      </section>
    </div>
  );
}
