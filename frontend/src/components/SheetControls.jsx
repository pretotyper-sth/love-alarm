import { logClick } from '../utils/analytics';
import './SheetControls.css';

export function SheetCloseButton({ onClose, disabled = false, label = '닫기', buttonRef, source }) {
  return <button ref={buttonRef} type="button" className="sheet-close-button" aria-label={label} onClick={() => { logClick('sheet_close_click', { source }); onClose(); }} disabled={disabled}>
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
  </button>;
}

export function SheetLaterButton({ onClose, disabled = false, source }) {
  return <button type="button" className="sheet-later-button" onClick={() => { logClick('sheet_later_click', { source }); onClose(); }} disabled={disabled}>나중에 하기</button>;
}
