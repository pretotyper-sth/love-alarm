import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import authRoutes from './auth.js';
import userRoutes from './users.js';
import alarmRoutes from './alarms.js';
import messageRoutes from './messages.js';
import messagePassRoutes from './messagePasses.js';
import verifyRoutes from './verifyInstagram.js';
import tossAuth from '../services/tossAuth.js';
import { issueSession } from '../middleware/session.js';

// Exercises the released client's HTTP contract, including its lack of Authorization.
test('legacy app restoration and session-app cutover', async t => {
  const saved = Object.fromEntries(['NODE_ENV', 'SESSION_SECRET', 'JWT_SECRET', 'ALLOW_LEGACY_API'].map(key => [key, process.env[key]]));
  t.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  process.env.NODE_ENV = 'production';
  delete process.env.SESSION_SECRET;
  process.env.JWT_SECRET = 'existing-deployment-secret-for-login-test';
  delete process.env.ALLOW_LEGACY_API;
  t.mock.method(console, 'warn', () => {});
  t.mock.method(tossAuth, 'getAccessToken', async () => ({ accessToken: 'verified-toss-token' }));
  t.mock.method(tossAuth, 'getUserInfo', async () => ({ userKey: 'toss-owner' }));

  const owner = { id: 'owner', tossUserId: 'toss-owner', instagramId: 'recipient', maxSlots: 2 };
  let lastAlarmQuery;
  let lastVerificationOwner;
  let createdReport;
  const freeAlarm = { id: 'free', userId: owner.id, targetInstagramId: 'recipient', fromInstagramId: 'sender', message: 'free message', status: 'waiting', reactions: [], deliveries: [] };
  const paidAlarm = { ...freeAlarm, id: 'paid', message: 'paid message', deliveries: [{ requiresPass: true }] };
  const prisma = {
    user: { findUnique: async ({ where }) => where.id === owner.id || where.tossUserId === owner.tossUserId ? owner : null },
    alarm: {
      findMany: async query => {
        lastAlarmQuery = query;
        return [freeAlarm, paidAlarm].filter(alarm => !query.where.deliveries || !alarm.deliveries.some(delivery => delivery.requiresPass));
      },
      findFirst: async ({ where }) => {
        if (where.deliveries && where.id === 'paid') return null;
        return where.id === 'free' ? freeAlarm : null;
      },
      update: async ({ where }) => ({ id: where.id }),
    },
    messageDelivery: { updateMany: async () => ({ count: 0 }) },
    verificationSession: {
      updateMany: async () => ({ count: 1 }),
      create: async ({ data }) => {
        lastVerificationOwner = data.userId;
        return { id: 'verification', ...data };
      },
    },
    messageReaction: { upsert: async ({ create }) => create },
    feedback: { create: async ({ data }) => { createdReport = data; return { id: 'report' }; } },
    $transaction: async operations => Promise.all(operations),
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.prisma = prisma; next(); });
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/alarms', alarmRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/message-passes', messagePassRoutes);
  app.use('/api/verify/instagram', verifyRoutes);
  app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = async (path, { method = 'GET', body, headers = {} } = {}) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, cacheControl: res.headers.get('cache-control'), data: await res.json() };
  };
  const sessionHeaders = { Authorization: `Bearer ${issueSession(owner.id).token}`, 'X-Love-Alarm-Auth': 'session-v1' };

  await t.test('existing Toss login still succeeds using the existing deployment secret', async () => {
    const result = await request('/auth/toss-login', { method: 'POST', body: { authorizationCode: 'code', referrer: 'DEFAULT' } });
    assert.equal(result.status, 200);
    assert.equal(result.data.user.id, owner.id);
    assert.equal(result.data.isNewUser, false);
    assert.ok(result.data.session.token);
    assert.equal((await request('/auth/login', { method: 'POST', body: { tossUserId: owner.tossUserId } })).status, 403);
  });

  await t.test('reopening the released app no longer fails its profile lookup', async () => {
    for (let reopen = 0; reopen < 3; reopen++) {
      const result = await request('/users/owner');
      assert.equal(result.status, 200);
      assert.equal(result.data.user.id, owner.id);
      assert.equal(result.cacheControl, 'no-store');
      assert.equal((await request('/alarms?userId=owner')).status, 200);
      assert.equal((await request('/messages/sent?userId=owner')).status, 200);
    }
    assert.equal((await request('/users/deleted-account')).status, 404);
  });

  await t.test('legacy message lists retain the old shape without exposing paid deliveries', async () => {
    for (const path of ['/messages/sent?userId=owner', '/messages/received?instagram_id=Recipient']) {
      const result = await request(path);
      assert.equal(result.status, 200);
      assert.deepEqual(result.data.messages.map(message => message.id), ['free']);
      assert.deepEqual(lastAlarmQuery.where.deliveries, { none: { requiresPass: true } });
    }
    assert.equal(lastAlarmQuery.where.targetInstagramId, 'recipient');
    assert.equal((await request('/messages/sent')).status, 400);
    assert.equal((await request('/messages/received?instagram_id[]=recipient')).status, 400);
  });

  await t.test('legacy alarm deletion and Instagram verification retain their request formats', async () => {
    assert.equal((await request('/alarms/free', { method: 'DELETE' })).status, 200);
    const result = await request('/verify/instagram/start', { method: 'POST', body: { tossUserId: owner.tossUserId, instagramUsername: '@Recipient' } });
    assert.equal(result.status, 200);
    assert.equal(lastVerificationOwner, owner.id);
    assert.equal(result.data.instagramUsername, 'recipient');
  });

  await t.test('legacy reactions and reports use alarm IDs but cannot target paid messages', async () => {
    const reaction = { method: 'POST', body: { emoji: '❤️' } };
    assert.equal((await request('/messages/free/reaction', reaction)).status, 200);
    assert.equal((await request('/messages/paid/reaction', reaction)).status, 404);
    const report = { method: 'POST', body: { reason: '스팸 또는 광고 같아요', userId: owner.id, instagramId: 'recipient' } };
    assert.equal((await request('/messages/free/report', report)).status, 201);
    assert.equal(createdReport.category, '신고');
    assert.equal((await request('/messages/paid/report', report)).status, 404);
  });

  await t.test('new app cannot fall back to legacy access with missing or invalid credentials', async () => {
    for (const headers of [{ 'X-Love-Alarm-Auth': 'session-v1' }, { Authorization: 'Bearer forged' }]) {
      for (const path of ['/users/owner', '/alarms?userId=owner', '/messages/sent?userId=owner']) {
        assert.equal((await request(path, { headers })).status, 401);
      }
    }
    assert.equal((await request('/users/owner', { headers: sessionHeaders })).status, 200);
    assert.equal((await request('/users/someone-else', { headers: sessionHeaders })).status, 403);
    assert.equal((await request('/alarms?userId=someone-else', { headers: sessionHeaders })).status, 403);
    assert.equal((await request('/messages/sent?userId=someone-else', { headers: sessionHeaders })).status, 403);
  });

  await t.test('payment, message unlock, and moderation APIs never permit legacy access', async () => {
    assert.equal((await request('/message-passes')).status, 401);
    for (const path of ['/message-passes/grant', '/message-passes/refund-status', '/messages/free/open']) {
      assert.equal((await request(path, { method: 'POST', body: { orderId: 'order' } })).status, 401);
    }
    assert.equal((await request('/messages/reports')).status, 403);
  });

  await t.test('one environment setting disables all legacy paths while the new app stays signed in', async () => {
    process.env.ALLOW_LEGACY_API = 'false';
    for (const path of ['/users/owner', '/alarms?userId=owner', '/messages/sent?userId=owner', '/messages/received?instagram_id=recipient']) {
      assert.equal((await request(path)).status, 401);
    }
    assert.equal((await request('/verify/instagram/start', { method: 'POST', body: { tossUserId: owner.tossUserId, instagramUsername: 'recipient' } })).status, 401);
    assert.equal((await request('/users/owner', { headers: sessionHeaders })).status, 200);
    assert.equal((await request('/alarms?userId=owner', { headers: sessionHeaders })).status, 200);
  });
});
