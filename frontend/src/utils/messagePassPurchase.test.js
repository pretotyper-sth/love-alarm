import test from 'node:test';
import assert from 'node:assert/strict';
import { purchaseMessagePass, restoreMessagePassOrders } from './messagePassPurchase.js';

test('purchase waits for server grant and SDK success, then cleans up', async () => {
  let callbacks; let cleaned = 0; let grants = 0;
  const purchase = purchaseMessagePass({ IAP: { createOneTimePurchaseOrder: options => { callbacks = options; return () => cleaned++; } }, sku: 'single', grant: async () => { grants++; return { balance: 1 }; } });
  assert.equal(await callbacks.options.processProductGrant({ orderId: 'order' }), true);
  assert.equal(cleaned, 0);
  await callbacks.onEvent({ type: 'success', data: { orderId: 'order' } });
  assert.equal((await purchase.promise).balance, 1);
  assert.equal(grants, 1); assert.equal(cleaned, 1);
  await callbacks.onEvent({ type: 'success' });
  assert.equal(grants, 1);
});
test('grant failure returns false and cancel never opens a message', async () => {
  let callbacks;
  const purchase = purchaseMessagePass({ IAP: { createOneTimePurchaseOrder: options => { callbacks = options; return () => {}; } }, sku: 'single', grant: async () => { throw new Error('offline'); } });
  assert.equal(await callbacks.options.processProductGrant({ orderId: 'order' }), false);
  const rejection = assert.rejects(purchase.promise, error => error.canceled === true);
  callbacks.onError({ code: 'USER_CANCELED' });
  await rejection;
});
test('unmount cancels UI callbacks while an already paid grant may finish safely', async () => {
  let callbacks;
  const purchase = purchaseMessagePass({ IAP: { createOneTimePurchaseOrder: options => { callbacks = options; return () => {}; } }, sku: 'single', grant: async () => ({ balance: 5 }) });
  const rejected = assert.rejects(purchase.promise, error => error.canceled);
  purchase.cancel();
  await rejected;
  assert.equal(await callbacks.options.processProductGrant({ orderId: 'paid' }), true);
  await callbacks.onEvent({ type: 'success' });
});
test('restore only finalizes configured pass products after server grant, and paginates refunds', async () => {
  const granted = [], completed = [], refunds = [], pages = [];
  const result = await restoreMessagePassOrders({
    IAP: {
      getPendingOrders: async () => ({ orders: [{ sku: 'single', orderId: 'paid' }, { sku: 'single', orderId: 'offline' }, { sku: 'slot', orderId: 'unrelated' }] }),
      completeProductGrant: async ({ params }) => { completed.push(params.orderId); return true; },
      getCompletedOrRefundedOrders: async (arg) => { pages.push(arg?.key); return arg?.key ? { orders: [{ sku: 'single', orderId: 'refund2', status: 'REFUNDED' }] } : { hasNext: true, nextKey: 'page2', orders: [{ sku: 'single', orderId: 'refund1', status: 'REFUNDED' }] }; },
    }, skus: ['single'],
    grant: async orderId => { if (orderId === 'offline') throw new Error('offline'); granted.push(orderId); },
    syncRefund: async orderId => refunds.push(orderId),
  });
  assert.deepEqual(granted, ['paid']); assert.deepEqual(completed, ['paid']);
  assert.deepEqual(pages, [undefined, 'page2']); assert.deepEqual(refunds, ['refund1', 'refund2']);
  assert.deepEqual(result, { restored: 1, failed: 1 });
});
