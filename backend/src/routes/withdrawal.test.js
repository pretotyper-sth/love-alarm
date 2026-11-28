import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import router from './auth.js';
import tossAuth, { disconnectTossUser } from '../services/tossAuth.js';
import { issueSession } from '../middleware/session.js';

test('withdrawal requires a session and deletes only its owner after Toss disconnect succeeds', async t => {
  const user = { id: 'owner', tossUserId: '123456' };
  let deleted = false, failDisconnect = false;
  const writes = [];
  t.mock.method(tossAuth, 'disconnectTossUser', async key => { assert.equal(key, user.tossUserId); if (failDisconnect) throw Object.assign(new Error('unavailable'), { status: 503 }); });
  const db = {
    user: { findUnique: async ({ where }) => where.id === user.id && !deleted ? user : null },
    $transaction: async fn => fn({
      alarm: { findMany: async ({ where }) => { assert.equal(where.userId, user.id); return [{ fromInstagramId: 'owner_ig', targetInstagramId: 'other_ig' }]; }, updateMany: async query => { writes.push(query); assert.deepEqual(query.data, { status: 'waiting' }); assert.equal(query.where.userId.not, user.id); } },
      messageDelivery: { updateMany: async query => { assert.equal(query.where.alarm.userId, user.id); writes.push(query); } },
      analyticsEvent: { updateMany: async query => { assert.deepEqual(query, { where: { userId: user.id }, data: { userId: null } }); } },
      feedback: { deleteMany: async query => { assert.equal(query.where.userId, user.id); } },
      user: { deleteMany: async query => { assert.deepEqual(query, { where: { id: user.id } }); deleted = true; } },
    }),
  };
  const app = express(); app.use(express.json()); app.use((req, _res, next) => { req.prisma = db; next(); }); app.use('/auth', router);
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.message }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/auth/account`;
  const token = issueSession(user.id).token;
  for (const headers of [{}, { Authorization: 'Bearer invalid' }]) {
    assert.equal((await fetch(url, { method: 'DELETE', headers })).status, 401);
  }
  failDisconnect = true;
  assert.equal((await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })).status, 503);
  assert.equal(deleted, false); assert.equal(writes.length, 0);
  failDisconnect = false;
  assert.equal((await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'other-account' }) })).status, 200);
  assert.equal(deleted, true); assert.equal(writes.length, 2);
  assert.equal((await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })).status, 401);
});

test('Toss disconnect uses mTLS and the authenticated user key; failures do not report success', async () => {
  const agent = {};
  await disconnectTossUser('123456', { agent, request: async (url, options) => {
    assert.match(url, /access\/remove-by-user-key$/); assert.equal(options.agent, agent);
    assert.deepEqual(JSON.parse(options.body), { userKey: 123456 });
    return { ok: true, json: async () => ({ resultType: 'SUCCESS' }) };
  } });
  await assert.rejects(disconnectTossUser('bad-key', { agent }), { status: 400 });
  await assert.rejects(disconnectTossUser('123456', { agent, request: async () => ({ ok: false, json: async () => ({ resultType: 'FAIL' }) }) }), { status: 503 });
});
