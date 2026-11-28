import { useEffect, useRef } from 'react';
import { Button } from '@toss/tds-mobile';
import { SheetCloseButton } from './SheetControls';
import { useBackDismiss } from '../utils/backNavigation';
import './WithdrawalSheet.css';

export function WithdrawalSheet({ open, busy, balance, loadError, error, onClose, onWithdraw, onRetry }) {
  const closeButton = useRef(null);
  useBackDismiss(open, () => { if (!busy) onClose(); });
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus?.({ preventScroll: true });
    };
  }, [open]);

  return <>
    <div className={`withdrawal-overlay${open ? ' show' : ''}`} onClick={() => { if (!busy) onClose(); }} aria-hidden="true" />
    <section className={`withdrawal-sheet${open ? ' show' : ''}`} role="dialog" aria-modal="true" aria-labelledby="withdrawal-title"
      aria-hidden={!open} inert={open ? undefined : ''} aria-busy={busy} onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); if (!busy) onClose(); }
        if (event.key !== 'Tab') return;
        const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled)')];
        const first = controls[0], last = controls.at(-1);
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
        <div className="withdrawal-content">
          <div className="sheet-title-row withdrawal-title-row">
            <h2 id="withdrawal-title">정말 탈퇴할까요?</h2>
            <SheetCloseButton buttonRef={closeButton} onClose={onClose} disabled={busy} source="withdrawal" label="회원 탈퇴 화면 닫기" />
          </div>
          <p>계정과 등록한 알람, 인스타그램 인증 정보가 삭제돼요. 탈퇴 후에는 복구할 수 없어요.</p>
          <ul>
            <li>남은 열람권과 열람한 메시지도 복구할 수 없어요.</li>
            <li>상대방이 이미 열어본 메시지는 남을 수 있어요.</li>
            <li>결제 기록은 환불·정산 처리를 위해 보관해요.</li>
          </ul>
          {balance == null && <div className="withdrawal-warning" role="status">{loadError ? <>보유 메시지 열람권을 확인하지 못했어요. <button onClick={onRetry}>다시 확인</button></> : '보유 메시지 열람권을 확인하고 있어요.'}</div>}
          {balance > 0 && <p className="withdrawal-warning">보유 열람권 {balance}장이 있어요. 구매 관련 문의는 탈퇴 전에 ‘의견 보내기’로 보내 주세요.</p>}
          {error && <p className="withdrawal-error" role="alert">{error}</p>}
          <div className="withdrawal-actions">
            <button className="auth-manage-card-btn auth-manage-card-btn--ghost" onClick={onClose} disabled={busy}>계속 이용하기</button>
            <Button size="large" onClick={onWithdraw} loading={busy} disabled={busy || balance == null}>탈퇴하기</Button>
          </div>
        </div>
    </section>
  </>;
}
