import { SheetCloseButton } from './SheetControls';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@toss/tds-mobile';
import { api } from '../utils/api';
import { purchaseMessagePass, restoreMessagePassOrders } from '../utils/messagePassPurchase';
import { logClick, logImpression } from '../utils/analytics';
import './MessagePassSheet.css';
import { useBackDismiss } from '../utils/backNavigation';

export function MessagePassSheet({ message, onOpened, onClose, onReport, onWalletChange }) {
  const [wallet, setWallet] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [selected, setSelected] = useState('single');
  const [busy, setBusy] = useState(false);
  useBackDismiss(true, () => { if (!busy) onClose(); });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const purchase = useRef(null);
  const operation = useRef(false);
  const mounted = useRef(true);
  const iap = useRef(null);
  const closeButton = useRef(null);

  async function refreshWallet() {
    const next = await api.getMessagePassWallet();
    if (mounted.current) { setWallet(next); onWalletChange(next.balance); }
    return next;
  }

  useEffect(() => {
    mounted.current = true;
    const previousFocus = document.activeElement;
    closeButton.current?.focus();
    const onPageHide = () => purchase.current?.cancel();
    window.addEventListener('pagehide', onPageHide);
    void (async () => {
      try {
        let next = await api.getMessagePassWallet();
        if (!mounted.current) return;
        setWallet(next);
        onWalletChange(next.balance);
        logImpression('message_pass_sheet_view', { pass_balance: next.balance });
        const IAP = api.isPreview ? api.messagePassIAP : (await import('@apps-in-toss/web-framework')).IAP;
        iap.current = IAP;
        try {
          await restoreMessagePassOrders({ IAP, skus: next.products.map(p => p.sku).filter(Boolean), grant: api.grantMessagePassOrder, syncRefund: api.syncMessagePassRefund });
          next = await api.getMessagePassWallet();
          if (!mounted.current) return;
          setWallet(next); onWalletChange(next.balance);
        } catch { /* App startup and the next sheet visit retry pending orders. */ }
        if (!mounted.current || next.balance > 0) return;
        if (typeof IAP?.getProductItemList === 'function') {
          const native = await Promise.race([
            IAP.getProductItemList(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('상품 조회 지연')), 8000)),
          ]);
          if (mounted.current) setCatalog(native?.products || []);
        }
      } catch {
        if (mounted.current) setError('구매 정보를 불러오지 못했어요. 닫았다가 다시 열어 주세요.');
      } finally { if (mounted.current) setLoading(false); }
    })();
    return () => {
      mounted.current = false;
      purchase.current?.cancel();
      window.removeEventListener('pagehide', onPageHide);
      previousFocus?.focus?.();
    };
    // A sheet is mounted for one message. Callback identity must not restart a purchase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openMessage() {
    logClick('message_pass_use_start');
    try {
      const result = await api.openReceivedMessage(message.id);
      logClick('message_pass_use_success', { pass_balance: result.balance });
      if (mounted.current) { onWalletChange(result.balance); onOpened(result.message); }
    } catch (error) { logClick('message_pass_use_fail'); throw error; }
  }

  const product = wallet?.products.find(p => p.id === selected);
  const nativeProduct = catalog.find(p => p.sku === product?.sku);
  const hasPass = wallet?.balance > 0;
  const canPurchase = wallet?.enabled && nativeProduct && typeof iap.current?.createOneTimePurchaseOrder === 'function';

  async function handleOpen() {
    if (operation.current) return;
    operation.current = true;
    setBusy(true); setError('');
    let paid = false;
    try {
      if (!hasPass) {
        if (!canPurchase) throw new Error('열람권 판매를 준비하고 있어요.');
        logClick('message_pass_purchase_start', { product: selected });
        purchase.current = purchaseMessagePass({ IAP: iap.current, sku: product.sku, grant: api.grantMessagePassOrder });
        await purchase.current.promise;
        paid = true;
        if (!mounted.current) return;
        logClick('message_pass_purchase_success', { product: selected });
      }
      await openMessage();
    } catch (failure) {
      if (!hasPass && !paid) logClick(failure.canceled ? 'message_pass_purchase_cancel' : 'message_pass_purchase_fail');
      if (!mounted.current) return;
      if (!failure.canceled) setError(paid ? '구매한 열람권이 있어요. 다시 열어 주세요.' : failure.message);
      try { await refreshWallet(); } catch { /* Preserve the actionable purchase error. */ }
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return <>
    <div className="msg-sheet-overlay" onClick={busy ? undefined : onClose} />
    <section className="msg-sheet message-pass-sheet" role="dialog" aria-modal="true" aria-labelledby="message-pass-title" onKeyDown={event => {
      if (event.key === 'Escape' && !busy) onClose();
      if (event.key === 'Tab') {
        const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href]')];
        if (!controls.length) { event.preventDefault(); return; }
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
      <div className="msg-sheet-handle" aria-hidden="true" />
      <header className="pass-header">
        <div className="sheet-title-row">
          <h2 id="message-pass-title">{hasPass ? '메시지를 열어볼까요?' : '메시지 열람권'}</h2>
          <SheetCloseButton buttonRef={closeButton} onClose={onClose} disabled={busy} label="메시지 열람권 화면 닫기" />
        </div>
        <p className="pass-description">{hasPass ? '한 번 연 메시지는 추가 사용 없이 다시 볼 수 있어요.' : '열람권 1장으로 메시지 1개를 확인해요.'}</p>
      </header>
      <div className="pass-body">
        <div className="pass-message-meta">
          <span>보낸 사람은 익명으로 유지돼요.</span>
          <button onClick={() => onReport(message)} disabled={busy} aria-label="이 메시지 신고하기">신고</button>
        </div>
        {hasPass && <div className="pass-balance"><span>보유 열람권</span><strong>{wallet.balance}장 <span aria-hidden="true">→</span> <span>사용 후 {wallet.balance - 1}장</span></strong></div>}
        {!hasPass && wallet && <div className="pass-products" role="radiogroup" aria-label="열람권 상품">
          {wallet.products.map(item => {
            const native = catalog.find(p => p.sku === item.sku);
            const unavailable = busy || !native || !wallet.enabled;
            return <label key={item.id} className={`pass-product${selected === item.id ? ' selected' : ''}${unavailable ? ' unavailable' : ''}`}>
              <input type="radio" name="message-pass-product" value={item.id} checked={selected === item.id} onChange={() => { setSelected(item.id); logClick('message_pass_product_select', { product: item.id }); }} disabled={unavailable} />
              <span className="pass-radio" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="m2.5 6 2.25 2.25L9.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
              <span className="pass-product-copy"><strong>열람권 {item.quantity}장</strong>{item.quantity > 1 && <small>남은 열람권은 다음에 사용해요</small>}</span>
              <span className="pass-product-price">{native?.displayAmount || `${item.amount.toLocaleString('ko-KR')}원`}</span>
            </label>;
          })}
        </div>}
        {!hasPass && <p className="pass-notice">구매 후 이 메시지에 1장을 바로 사용해요.</p>}
        {error && <p className="pass-error" role="alert">{error}</p>}
        {!loading && !error && !hasPass && !canPurchase && <p className="pass-notice" role="status">지금은 열람권을 구매할 수 없어요. 잠시 후 다시 확인해 주세요.</p>}
      </div>
      <footer className="pass-actions">
        <Button size="xlarge" display="block" disabled={busy || loading || (!hasPass && !canPurchase)} loading={busy} onClick={handleOpen}>
          {busy ? '확인 중…' : hasPass ? '열람권 1장으로 열기' : nativeProduct ? `${nativeProduct.displayAmount} 결제하고 열기` : loading ? '불러오는 중…' : '현재 구매할 수 없어요'}
        </Button>
      </footer>
    </section>
  </>;
}
