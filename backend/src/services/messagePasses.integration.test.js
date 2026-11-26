import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { createMessageRouter } from '../routes/messages.js';
import { createMessagePassRouter } from '../routes/messagePasses.js';
import alarmRouter from '../routes/alarms.js';
import userRouter from '../routes/users.js';
import authRouter from '../routes/auth.js';
import { issueSession } from '../middleware/session.js';

// Explicit, disposable database only. Never fall back to DATABASE_URL.
const url = process.env.TEST_DATABASE_URL;
test('message pass API: purchase, unlock, restore, report, and refund against PostgreSQL', { skip: !url }, async t => {
  process.env.ALLOW_LEGACY_API = 'false';
  const db = new PrismaClient({ datasources: { db: { url } } });
  const suffix = randomUUID();
  process.env.TOSS_MESSAGE_PASS_SINGLE_SKU = 'test-pass-single';
  process.env.TOSS_MESSAGE_PASS_BUNDLE_SKU = 'test-pass-bundle';
  process.env.MESSAGE_PASSES_ENABLED = 'true';
  process.env.ADMIN_API_TOKEN = 'test-admin-only';
  const owner = await db.user.create({ data: { tossUserId: `owner-${suffix}` } });
  const sender = await db.user.create({ data: { tossUserId: `sender-${suffix}` } });
  const other = await db.user.create({ data: { tossUserId: `other-${suffix}` } });
  const recipient = `recipient_${suffix}`;
  await db.verificationSession.create({ data: { userId: owner.id, instagramUsername: recipient, status: 'verified', expiresAt: new Date(), igUserId: 'verified-owner' } });
  const message = await db.messageDelivery.create({ data: { targetInstagramId: recipient, message: 'paid body', requiresPass: true } });
  const orders = new Map();
  const orderId = randomUUID();
  orders.set(orderId, { orderId, sku: 'test-pass-bundle', status: 'PAYMENT_COMPLETED', purchaserMatched: true, buyer: owner.tossUserId });
  const verifyOrder = async (id, buyer, { allowRefunded = false } = {}) => {
    const order = orders.get(id);
    if (!order || order.buyer !== buyer) throw Object.assign(new Error('buyer mismatch'), { status: 403 });
    if (!['PAYMENT_COMPLETED', 'PURCHASED', ...(allowRefunded ? ['REFUNDED'] : [])].includes(order.status)) throw Object.assign(new Error('not paid'), { status: 409 });
    return order;
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.prisma = db; req.userSockets = new Map(); req.io = { to: () => ({ emit() {} }) }; next(); });
  app.use('/api/messages', createMessageRouter({ verifyOrder }));
  app.use('/api/message-passes', createMessagePassRouter({ verifyOrder }));
  app.use('/api/alarms', alarmRouter);
  app.use('/api/users', userRouter);
  app.use('/api/auth', authRouter);
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.message, code: error.code }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, { as = owner, method = 'GET', body, admin = false } = {}) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(as ? { Authorization: `Bearer ${admin ? process.env.ADMIN_API_TOKEN : issueSession(as.id).token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: await response.json() };
  }
  try {
    await t.test('cannot read content through unauthenticated or forged sender queries', async () => {
      assert.equal((await request('/messages/received', { as: null })).status, 401);
      assert.equal((await request(`/messages/sent?userId=${sender.id}`)).status, 403);
      assert.equal((await request(`/alarms?userId=${sender.id}`)).status, 403);
      assert.equal((await request(`/alarms?userId=${owner.id}`, { method: 'POST', body: { userId: sender.id } })).status, 403);
      assert.equal((await request(`/users/${sender.id}`)).status, 403);
      assert.equal((await request('/messages/received', { as: other })).status, 403);
      const listing = await request(`/messages/received?instagram_id=someone_else`);
      assert.equal(listing.data.instagramId, recipient);
      assert.equal(listing.data.messages[0].message, null);
      assert.equal(listing.data.messages[0].locked, true);
      assert.equal(JSON.stringify(listing.data).includes('paid body'), false);
      assert.equal((await request(`/messages/${message.id}/open`, { method: 'POST' })).status, 402);
      assert.equal((await request('/auth/login', { as: null, method: 'POST', body: { tossUserId: owner.tossUserId } })).status, 403);
    });
    await t.test('wrong buyer and unknown product cannot obtain passes', async () => {
      assert.equal((await request('/message-passes/grant', { as: other, method: 'POST', body: { orderId } })).status, 403);
      const invalid = randomUUID(); orders.set(invalid, { orderId: invalid, buyer: owner.tossUserId, sku: 'slot', status: 'PURCHASED' });
      assert.equal((await request('/message-passes/grant', { method: 'POST', body: { orderId: invalid } })).status, 400);
    });
    await t.test('replayed purchase callbacks grant exactly five passes', async () => {
      const results = await Promise.all(Array.from({ length: 5 }, () => request('/message-passes/grant', { method: 'POST', body: { orderId } })));
      assert.ok(results.every(r => r.status === 200));
      assert.equal((await request('/message-passes')).data.balance, 5);
      assert.equal(await db.messagePassOrder.count({ where: { orderId } }), 1);
      assert.equal(await db.messagePassEntry.count({ where: { userId: owner.id, reason: 'purchase' } }), 1);
    });
    await t.test('replayed open requests charge once, reopen is free', async () => {
      const results = await Promise.all(Array.from({ length: 5 }, () => request(`/messages/${message.id}/open`, { method: 'POST' })));
      assert.ok(results.every(r => r.status === 200 && r.data.message.message === 'paid body'));
      assert.equal((await request('/message-passes')).data.balance, 4);
      assert.equal(await db.messageUnlock.count({ where: { userId: owner.id, messageId: message.id } }), 1);
      assert.equal((await db.messagePassOrder.findUnique({ where: { orderId } })).remaining, 4);
    });
    await t.test('deleted-before-open never charges; already-opened body survives deletion', async () => {
      const deleted = await db.messageDelivery.create({ data: { targetInstagramId: recipient, message: 'deleted body', deletedAt: new Date() } });
      assert.equal((await request(`/messages/${deleted.id}/open`, { method: 'POST' })).status, 410);
      await db.messageDelivery.update({ where: { id: message.id }, data: { deletedAt: new Date() } });
      assert.equal((await request(`/messages/${message.id}/open`, { method: 'POST' })).data.message.message, 'paid body');
      assert.equal((await request('/message-passes')).data.balance, 4);
    });
    await t.test('ledger failure rolls the debit and unlock back together', async () => {
      const target = await db.messageDelivery.create({ data: { targetInstagramId: recipient, message: 'rollback body' } });
      const reference = `open:${owner.id}:${target.id}`;
      await db.messagePassEntry.create({ data: { userId: owner.id, delta: 0, reason: 'test_conflict', reference } });
      assert.equal((await request(`/messages/${target.id}/open`, { method: 'POST' })).status, 500);
      assert.equal((await request('/message-passes')).data.balance, 4);
      assert.equal((await db.messagePassOrder.findUnique({ where: { orderId } })).remaining, 4);
      assert.equal(await db.messageUnlock.count({ where: { messageId: target.id } }), 0);
      await db.messagePassEntry.delete({ where: { reference } });
    });
    await t.test('report review is admin-only and restores the charged pass exactly once', async () => {
      const report = await request(`/messages/${message.id}/report`, { method: 'POST', body: { reason: '스팸 또는 광고 같아요' } });
      assert.equal(report.status, 201);
      assert.equal((await request(`/messages/reports/${report.data.reportId}/resolve`, { method: 'POST', body: { uphold: true } })).status, 403);
      for (let i = 0; i < 2; i++) assert.equal((await request(`/messages/reports/${report.data.reportId}/resolve`, { admin: true, method: 'POST', body: { uphold: true } })).status, 200);
      assert.equal((await request('/message-passes')).data.balance, 5);
      assert.equal((await request('/messages/received')).data.messages.some(m => m.id === message.id), false);
    });
    await t.test('provider refund revokes remaining passes once, replay cannot grant again', async () => {
      orders.get(orderId).status = 'REFUNDED';
      const target = await db.messageDelivery.create({ data: { targetInstagramId: recipient, message: 'refunded body' } });
      assert.equal((await request(`/messages/${target.id}/open`, { method: 'POST' })).status, 409);
      assert.equal(await db.messageUnlock.count({ where: { messageId: target.id } }), 0);
      assert.equal((await request('/message-passes')).data.balance, 5);
      for (let i = 0; i < 2; i++) assert.equal((await request('/message-passes/refund-status', { method: 'POST', body: { orderId } })).status, 200);
      assert.equal((await request('/message-passes')).data.balance, 0);
      assert.equal((await request('/message-passes/grant', { method: 'POST', body: { orderId } })).status, 409);
    });
    await t.test('one pass cannot pay for two different messages', async () => {
      const otherRecipient = `other_${suffix}`;
      await db.verificationSession.create({ data: { userId: other.id, instagramUsername: otherRecipient, status: 'verified', expiresAt: new Date() } });
      const singleId = randomUUID();
      orders.set(singleId, { orderId: singleId, sku: 'test-pass-single', status: 'PURCHASED', buyer: other.tossUserId });
      await request('/message-passes/grant', { as: other, method: 'POST', body: { orderId: singleId } });
      const targets = await Promise.all(['a', 'b'].map(message => db.messageDelivery.create({ data: { targetInstagramId: otherRecipient, message } })));
      assert.equal((await request(`/messages/${targets[0].id}/open`, { method: 'POST' })).status, 404);
      const opened = await Promise.all(targets.map(target => request(`/messages/${target.id}/open`, { as: other, method: 'POST' })));
      assert.deepEqual(opened.map(r => r.status).sort(), [200, 402]);
      assert.equal((await request('/message-passes', { as: other })).data.balance, 0);
    });
    await t.test('sender retries do not duplicate payable messages, and re-registration preserves opened body', async () => {
      const send = body => request('/alarms', { as: sender, method: 'POST', body: { userId: sender.id, fromInstagramId: 'test_sender', targetInstagramId: recipient, message: body } });
      process.env.MESSAGE_PASSES_ENABLED = 'false';
      const sent = await Promise.all([send('original body'), send('original body')]);
      assert.deepEqual(sent.map(r => r.status).sort(), [201, 409]);
      const alarmId = sent.find(r => r.status === 201).data.alarm.id;
      const delivery = await db.messageDelivery.findFirst({ where: { alarmId } });
      assert.equal((await request(`/messages/${delivery.id}/open`, { method: 'POST' })).data.message.message, 'original body');
      assert.equal((await request(`/alarms/${alarmId}`, { as: sender, method: 'DELETE' })).status, 200);
      process.env.MESSAGE_PASSES_ENABLED = 'true';
      assert.equal((await send('new body')).status, 201);
      const next = await db.messageDelivery.findFirst({ where: { alarmId, deletedAt: null } });
      assert.notEqual(next.id, delivery.id); assert.equal(next.requiresPass, true);
      assert.equal((await request(`/messages/${delivery.id}/open`, { method: 'POST' })).data.message.message, 'original body');
      assert.equal((await request(`/messages/${next.id}/open`, { method: 'POST' })).status, 402);
    });
    await t.test('legacy message is free; account deletion preserves receipts', async () => {
      const legacy = await db.messageDelivery.create({ data: { targetInstagramId: recipient, message: 'free legacy', requiresPass: false } });
      assert.equal((await request(`/messages/${legacy.id}/open`, { method: 'POST' })).status, 200);
      assert.equal((await request('/message-passes')).data.balance, 0);
      await db.user.delete({ where: { id: owner.id } });
      assert.equal((await db.messagePassOrder.findUnique({ where: { orderId } })).userId, null);
      assert.equal((await request('/message-passes')).status, 401);
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
    await db.user.deleteMany({ where: { id: { in: [owner.id, sender.id, other.id] } } });
    await db.$disconnect();
  }
});
