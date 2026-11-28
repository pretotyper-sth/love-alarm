import test from 'node:test';
import assert from 'node:assert/strict';
import { issueSession, verifySession } from '../middleware/session.js';
import { receivedMessage, messagePassSalesEnabled, verifyTossPassOrder, grantMessagePasses } from './messagePasses.js';

test('signed sessions reject tampering, expiry, and another audience', () => {
  const session = issueSession('user-1', 1000);
  assert.equal(verifySession(session.token, 1001), 'user-1');
  assert.equal(verifySession(`${session.token}x`, 1001), null);
  assert.equal(verifySession(session.token, session.expiresAt), null);
  assert.equal(verifySession('user-1'), null);
});
test('locked messages contain neither body nor sender/account identifiers', () => {
  const response = receivedMessage({ id: 'm', message: 'secret', targetInstagramId: 'recipient', fromInstagramId: 'sender', userId: 'sender-user', requiresPass: true, createdAt: 'today' });
  assert.deepEqual(response, { id: 'm', createdAt: 'today', locked: true, opened: false, message: null, reactions: [] });
  assert.equal(receivedMessage({ requiresPass: false, message: 'legacy' }).message, 'legacy');
  assert.equal(receivedMessage({ requiresPass: true, message: 'purchased' }, true).message, 'purchased');
  assert.equal(receivedMessage({ requiresPass: true }, true).opened, true);
  assert.equal(receivedMessage({ requiresPass: false }).opened, false);
});
test('sales stay off until both distinct console SKUs are configured', () => {
  assert.equal(messagePassSalesEnabled({ MESSAGE_PASSES_ENABLED: 'true' }), false);
  assert.equal(messagePassSalesEnabled({ MESSAGE_PASSES_ENABLED: 'true', TOSS_MESSAGE_PASS_SINGLE_SKU: 'same', TOSS_MESSAGE_PASS_BUNDLE_SKU: 'same' }), false);
  assert.equal(messagePassSalesEnabled({ MESSAGE_PASSES_ENABLED: 'true', TOSS_MESSAGE_PASS_SINGLE_SKU: 'one', TOSS_MESSAGE_PASS_BUNDLE_SKU: 'five' }), true);
});
test('Toss verification requires completed status and explicit buyer match', async () => {
  for (const purchaserMatched of [false, null, undefined]) {
    await assert.rejects(verifyTossPassOrder('order-123', 'toss-user', { agent: {}, request: async () => ({ ok: true, json: async () => ({ resultType: 'SUCCESS', success: { orderId: 'order-123', status: 'PURCHASED', purchaserMatched } }) }) }), { status: 403 });
  }
  for (const status of ['REFUNDED', 'NOT_FOUND', 'FAILED', 'ORDER_IN_PROGRESS']) {
    await assert.rejects(verifyTossPassOrder('order-123', 'toss-user', { agent: {}, request: async () => ({ ok: true, json: async () => ({ resultType: 'SUCCESS', success: { orderId: 'order-123', status, purchaserMatched: true } }) }) }), { status: 409 });
  }
  let headers;
  const order = await verifyTossPassOrder('order-123', 'toss-user', { agent: {}, request: async (_url, options) => {
    headers = options.headers;
    return { ok: true, json: async () => ({ resultType: 'SUCCESS', success: { orderId: 'order-123', sku: 'single', status: 'PAYMENT_COMPLETED', purchaserMatched: true } }) };
  } });
  assert.equal(headers['x-toss-user-key'], 'toss-user');
  assert.equal(order.sku, 'single');
});
test('unrecognized product never starts a wallet transaction', async () => {
  await assert.rejects(grantMessagePasses({ $transaction: () => assert.fail('must not grant') }, { id: 'u', tossUserId: 't' }, 'order-123', async () => ({ sku: 'slot-product' })), /열람권 상품/);
});

test('production login can issue and verify sessions with the existing deployment secret', () => {
  const saved = { NODE_ENV: process.env.NODE_ENV, SESSION_SECRET: process.env.SESSION_SECRET, JWT_SECRET: process.env.JWT_SECRET };
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.SESSION_SECRET;
    process.env.JWT_SECRET = 'existing-production-secret-for-test';
    const session = issueSession('existing-user');
    assert.equal(verifySession(session.token), 'existing-user');
    delete process.env.JWT_SECRET;
    assert.throws(() => issueSession('user'), /Configure SESSION_SECRET/);
    process.env.JWT_SECRET = 'short';
    assert.throws(() => issueSession('user'), /Configure SESSION_SECRET/);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
