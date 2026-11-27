import { useEffect, useRef, useState } from 'react';
import { api } from '../utils/api';
import { purchaseMessagePass, restoreMessagePassOrders } from '../utils/messagePassPurchase';
import { logClick } from '../utils/analytics';
import './MessagePassSheet.css';

export function MessagePassSheet({ message, onOpened, onClose, onReport, onWalletChange }) {
  const [wallet, setWallet] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [selected, setSelected] = useState('single');
  const [busy, setBusy] = useState(false);
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
        const next = await api.getMessagePassWallet();
        if (!mounted.current) return;
        setWallet(next);
        onWalletChange(next.balance);
        if (next.balance > 0) return;
        const { IAP } = await import('@apps-in-toss/web-framework');
        iap.current = IAP;
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
    const result = await api.openReceivedMessage(message.id);
    if (mounted.current) { onWalletChange(result.balance); onOpened(result.message); }
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
      logClick(failure.canceled ? 'message_pass_purchase_cancel' : 'message_pass_purchase_fail');
      if (!mounted.current) return;
      if (!failure.canceled) setError(paid ? '구매한 열람권이 있어요. 다시 열어 주세요.' : failure.message);
      try { await refreshWallet(); } catch { /* Preserve the actionable purchase error. */ }
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function handleRestore() {
    if (operation.current) return;
    operation.current = true; setBusy(true); setError('');
    try {
      const { IAP } = await import('@apps-in-toss/web-framework');
      if (typeof IAP?.getPendingOrders !== 'function') throw new Error('토스 앱에서 구매를 복원해 주세요.');
      const current = await refreshWallet();
      const result = await restoreMessagePassOrders({ IAP, skus: current.products.map(p => p.sku).filter(Boolean), grant: api.grantMessagePassOrder, syncRefund: api.syncMessagePassRefund });
      await refreshWallet();
      if (mounted.current) setError(result.failed ? '일부 구매를 확인하지 못했어요. 잠시 후 다시 복원해 주세요.' : result.restored ? '열람권을 복원했어요. 메시지를 열어 주세요.' : '구매 내역을 확인했어요. 보유 열람권을 확인해 주세요.');
    } catch (failure) { if (mounted.current) setError(failure.message); }
    finally { operation.current = false; if (mounted.current) setBusy(false); }
  }

  return <>
    <div className="msg-sheet-overlay" onClick={busy ? undefined : onClose} />
    <section className="msg-sheet message-pass-sheet" role="dialog" aria-modal="true" aria-labelledby="message-pass-title" onKeyDown={event => {
      if (event.key === 'Escape' && !busy) onClose();
      if (event.key === 'Tab') {
        const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled), a[href]')];
        if (!controls.length) { event.preventDefault(); return; }
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
      <div className="msg-sheet-handle" aria-hidden="true" />
      <button ref={closeButton} className="pass-close" onClick={onClose} disabled={busy} aria-label="열람권 화면 닫기">닫기</button>
      <h3 id="message-pass-title">{hasPass ? '열람권 1장으로 열어볼까요?' : '어떤 마음이 담겨 있을까요?'}</h3>
      <p className="pass-description">{hasPass ? '한 번 연 메시지는 추가 사용 없이 다시 볼 수 있어요.' : '열람권으로 메시지 내용을 확인해 보세요.'}</p>
      {hasPass && <p className="pass-balance">보유 {wallet.balance}장 → 사용 후 {wallet.balance - 1}장</p>}
      {!hasPass && wallet && <div className="pass-products" role="radiogroup" aria-label="열람권 상품">
        {wallet.products.map(item => {
          const native = catalog.find(p => p.sku === item.sku);
          return <button key={item.id} role="radio" aria-checked={selected === item.id} className={selected === item.id ? 'selected' : ''} onClick={() => setSelected(item.id)} disabled={busy || !native || !wallet.enabled}>
            <strong>열람권 {item.quantity}장</strong><span>{native?.displayAmount || `${item.amount.toLocaleString()}원`}</span>{item.quantity > 1 && <small>이번 메시지에 1장 사용 · 나머지 {item.quantity - 1}장은 다음에 사용</small>}
          </button>;
        })}
      </div>}
      <p className="pass-notice">{!hasPass && <>구매 후 이 메시지에 1장을 바로 사용해요.<br /></>}보낸 사람은 익명으로 유지돼요.</p>
      {error && <p className="pass-error" role="status">{error}</p>}
      {!loading && !hasPass && !canPurchase && <p className="pass-notice">현재 구매 가능한 열람권이 없어요. 토스 앱에서 다시 확인해 주세요.</p>}
      <button className="messages-empty-btn messages-empty-btn--primary pass-primary" disabled={busy || loading || (!hasPass && !canPurchase)} onClick={handleOpen}>
        {busy ? '확인 중…' : hasPass ? '열람권 1장으로 열기' : nativeProduct ? `${nativeProduct.displayAmount} 결제하고 열기` : loading ? '불러오는 중…' : '현재 구매할 수 없어요'}
      </button>
      <div className="pass-links">
        <button onClick={handleRestore} disabled={busy || loading}>구매 내역 복원</button>
        <button onClick={() => onReport(message)} disabled={busy}>신고하고 숨기기</button>
      </div>
    </section>
  </>;
}
