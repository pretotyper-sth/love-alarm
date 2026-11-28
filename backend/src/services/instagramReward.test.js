import test from 'node:test';
import assert from 'node:assert/strict';
import { claimInstagramReward, instagramRewardStatus, openReceivedMessage, resolveMessageReport } from './messagePasses.js';

test('verified Toss account receives one reward, spends it before purchases, and restores it only once', async () => {
  const user = { id: 'recipient', tossUserId: '123456', messagePassBalance: 0 };
  const entries = new Map(), unlocks = new Map();
  let verified = false, locks = 0, paidRemaining = 1;
  const report = { id: 'report', userId: user.id, messageId: 'one', status: 'pending' };
  const tx = {
    $queryRaw: async () => { locks++; },
    user: {
      findUniqueOrThrow: async () => ({ ...user }),
      update: async ({ data }) => { user.messagePassBalance += data.messagePassBalance.increment || -data.messagePassBalance.decrement; },
    },
    verificationSession: { findFirst: async () => verified ? { instagramUsername: 'recipient_ig' } : null },
    messagePassEntry: {
      findUnique: async ({ where }) => entries.get(where.reference) || null,
      create: async ({ data }) => { assert.equal(entries.has(data.reference), false); entries.set(data.reference, data); },
      aggregate: async ({ where }) => ({ _sum: { delta: [...entries.values()].filter(e => e.userId === user.id && where.reason.in.includes(e.reason)).reduce((n, e) => n + e.delta, 0) } }),
    },
    messageDelivery: { findUnique: async ({ where }) => ({ id: where.id, message: 'secret', requiresPass: true, targetInstagramId: 'recipient_ig' }) },
    messageUnlock: {
      findUnique: async ({ where }) => unlocks.get(where.userId_messageId.messageId) || null,
      create: async ({ data }) => { unlocks.set(data.messageId, data); },
    },
    messagePassOrder: {
      findFirst: async () => ({ orderId: 'paid-order', sku: 'paid-sku' }),
      update: async () => { paidRemaining--; },
    },
    messageReport: {
      findUnique: async ({ where }) => where.id ? report : null,
      update: async ({ data }) => Object.assign(report, data),
    },
  };
  const db = { ...tx, $transaction: async fn => fn(tx) };
  await assert.rejects(claimInstagramReward(db, user), { code: 'INSTAGRAM_REQUIRED' });
  assert.equal(user.messagePassBalance, 0);
  verified = true;
  assert.equal((await claimInstagramReward(db, user)).balance, 1);
  assert.equal((await claimInstagramReward(db, user)).alreadyGranted, true);
  assert.equal(user.messagePassBalance, 1);
  user.messagePassBalance++; // One purchased pass alongside the reward.
  const verifyPurchase = async () => ({ sku: 'paid-sku' });
  assert.equal((await openReceivedMessage(db, user.id, 'one', () => assert.fail('reward does not verify a purchase'))).balance, 1);
  assert.equal(unlocks.get('one').orderId, undefined);
  assert.equal(paidRemaining, 1);
  assert.equal((await openReceivedMessage(db, user.id, 'one', verifyPurchase)).balance, 1);
  assert.equal((await openReceivedMessage(db, user.id, 'two', verifyPurchase)).balance, 0);
  assert.equal(paidRemaining, 0);
  await resolveMessageReport(db, report.id, true);
  await resolveMessageReport(db, report.id, true);
  assert.equal(user.messagePassBalance, 1);
  assert.equal((await openReceivedMessage(db, user.id, 'three', () => assert.fail('restored reward is free'))).balance, 0);
  await assert.rejects(openReceivedMessage(db, user.id, 'four', verifyPurchase), { code: 'PASS_REQUIRED' });
  assert.ok(locks >= 8);
  // Withdrawal clears the owner but preserves the receipt. A new internal ID cannot claim again.
  for (const entry of entries.values()) entry.userId = null;
  user.id = 'rejoined'; user.messagePassBalance = 0;
  assert.equal((await instagramRewardStatus(db, user)).claimed, true);
  assert.equal((await claimInstagramReward(db, user)).balance, 0);
});
