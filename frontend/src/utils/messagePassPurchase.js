// Keep SDK lifecycle separate from the screen so restore/cancel/retry can be tested.
export function purchaseMessagePass({ IAP, sku, grant, timeoutMs = 45000 }) {
  let cleanup;
  let finished = false;
  let granted;
  let rejectPurchase;
  let timer;
  const promise = new Promise((resolve, reject) => {
    rejectPurchase = reject;
    const finish = (error, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      cleanup?.();
      if (error) reject(error); else resolve(value);
    };
    timer = setTimeout(() => finish(new Error('구매 확인이 지연되고 있어요. 구매 복원을 눌러 주세요.')), timeoutMs);
    try {
      cleanup = IAP.createOneTimePurchaseOrder({
        options: {
          sku,
          processProductGrant: async ({ orderId }) => {
            try { granted = await grant(orderId); return true; }
            catch { return false; }
          },
        },
        onEvent: async (event) => {
          if (finished || event.type !== 'success') return;
          try {
            const result = granted || await grant(event.data?.orderId);
            finish(null, result);
          } catch (error) { finish(error); }
        },
        onError: error => {
          const code = error?.code || error?.errorCode;
          const canceled = ['USER_CANCELED', 'USER_CANCELLED'].includes(code);
          finish(Object.assign(new Error(canceled ? '결제를 취소했어요.' : '구매를 완료하지 못했어요. 구매 내역을 복원해 주세요.'), { canceled }));
        },
      });
      if (finished) cleanup?.();
    } catch (error) { finish(error); }
  });
  return {
    promise,
    cancel() {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      cleanup?.();
      rejectPurchase(Object.assign(new Error('구매 화면을 닫았어요.'), { canceled: true }));
    },
  };
}

export async function restoreMessagePassOrders({ IAP, skus, grant, syncRefund }) {
  if (typeof IAP?.getPendingOrders !== 'function') return { restored: 0, failed: 0 };
  const result = await IAP.getPendingOrders();
  let restored = 0;
  let failed = 0;
  for (const order of result?.orders || []) {
    if (!skus.includes(order.sku)) continue;
    try {
      await grant(order.orderId);
      const completed = await IAP.completeProductGrant({ params: { orderId: order.orderId } });
      if (completed !== true) throw new Error('grant completion pending');
      restored++;
    } catch { failed++; }
  }
  if (syncRefund && typeof IAP.getCompletedOrRefundedOrders === 'function') {
    let key;
    const visited = new Set();
    do {
      const page = await IAP.getCompletedOrRefundedOrders(key ? { key } : undefined);
      for (const order of page?.orders || []) {
        if (order.status !== 'REFUNDED' || !skus.includes(order.sku)) continue;
        try { await syncRefund(order.orderId); } catch (error) { if (error.status !== 404) failed++; }
      }
      const next = page?.hasNext ? page.nextKey : null;
      if (!next || visited.has(next)) break;
      visited.add(next); key = next;
    } while (key);
  }
  return { restored, failed };
}
