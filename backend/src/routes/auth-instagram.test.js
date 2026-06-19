import test from 'node:test';
import assert from 'node:assert/strict';
import userRoutes from './users.js';
import verifyInstagramRoutes from './verifyInstagram.js';
import { sendInstagramDm } from '../services/instagramMessaging.js';
import { handleInstagramWebhookPayload } from '../services/instagramWebhookHandler.js';

function getRouteHandler(router, method, path) {
  const layer = router.stack.find(
    (entry) => entry.route?.path === path && entry.route.methods?.[method],
  );
  assert.ok(layer, `Route ${method.toUpperCase()} ${path} not found`);
  return layer.route.stack[0].handle;
}

function createMockResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test('instagram confirm stores verified username on user', async () => {
  const handler = getRouteHandler(verifyInstagramRoutes, 'post', '/confirm');

  const prisma = {
    user: {
      findUnique: async () => ({ id: 'user-1', tossUserId: 'toss-1' }),
      update: (args) => Promise.resolve(args),
    },
    verificationSession: {
      findFirst: async () => ({
        id: 'session-1',
        userId: 'user-1',
        status: 'code_sent',
        expiresAt: new Date(Date.now() + 60_000),
        code: '123456',
        igUserId: '17840000000000000',
        instagramUsername: 'verified_name',
      }),
      update: (args) => Promise.resolve(args),
    },
    $transaction: async (operations) => Promise.all(operations),
  };

  const req = {
    body: {
      tossUserId: 'toss-1',
      sessionId: 'session-1',
      code: '123456',
    },
    prisma,
  };
  const res = createMockResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.instagramUsername, 'verified_name');
});

test('instagram disconnect uses latest verified username to clear alarms', async () => {
  const handler = getRouteHandler(userRoutes, 'delete', '/:id/instagram-auth');

  const captured = {
    alarmFindManyWhere: null,
  };

  const prisma = {
    user: {
      findUnique: async () => ({ id: 'user-1', instagramId: '17840000000000000' }),
      update: (args) => Promise.resolve({ id: 'user-1', instagramId: null, ...args.data }),
    },
    verificationSession: {
      findFirst: async () => ({
        id: 'session-1',
        userId: 'user-1',
        status: 'verified',
        instagramUsername: 'verified_name',
      }),
      updateMany: (args) => Promise.resolve(args),
    },
    alarm: {
      findMany: async (args) => {
        captured.alarmFindManyWhere = args.where;
        return [];
      },
    },
    $transaction: async (operations) => Promise.all(operations),
    match: {
      deleteMany: async () => ({}),
    },
  };

  const req = {
    params: { id: 'user-1' },
    body: { verifiedUsername: 'other_name' },
    prisma,
    io: { to: () => ({ emit: () => {} }) },
    userSockets: new Map(),
  };
  const res = createMockResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(captured.alarmFindManyWhere.fromInstagramId, 'verified_name');
  assert.equal(res.body.user.instagramId, null);
});

test('instagram DM sends through configured business account endpoint', async () => {
  const previousFetch = global.fetch;
  const previousBusinessId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const previousToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const captured = {};

  global.fetch = async (url, options) => {
    captured.url = String(url);
    captured.body = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ recipient_id: 'sender-1', message_id: 'message-1' }),
    };
  };
  process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = '17841439221705541';
  process.env.INSTAGRAM_ACCESS_TOKEN = 'token-1';

  try {
    const result = await sendInstagramDm('sender-1', 'hello');

    assert.equal(result.ok, true);
    assert.match(captured.url, /\/17841439221705541\/messages\?/);
    assert.equal(captured.body.recipient.id, 'sender-1');
    assert.equal(captured.body.message.text, 'hello');
  } finally {
    global.fetch = previousFetch;
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = previousBusinessId;
    process.env.INSTAGRAM_ACCESS_TOKEN = previousToken;
  }
});

test('instagram webhook sends code for matching pending session', async () => {
  const previousToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  process.env.INSTAGRAM_ACCESS_TOKEN = 'token-1';

  const updates = [];
  const sentMessages = [];
  const session = {
    id: 'session-1',
    instagramUsername: 'valid_user',
    status: 'pending',
    expiresAt: new Date(Date.now() + 60_000),
  };
  const prisma = {
    verificationSession: {
      findFirst: async (args) => {
        assert.equal(args.where.instagramUsername, 'valid_user');
        assert.equal(args.where.status, 'pending');
        return session;
      },
      update: async (args) => {
        updates.push(args);
        return { ...session, ...args.data };
      },
    },
  };
  const deps = {
    fetchInstagramUserProfile: async () => ({
      username: 'valid_user',
      isUserFollowBusiness: true,
    }),
    sendInstagramDm: async (recipientId, text) => {
      sentMessages.push({ recipientId, text });
      return { ok: true };
    },
  };

  try {
    await handleInstagramWebhookPayload(prisma, {
      object: 'instagram',
      entry: [
        {
          messaging: [
            { sender: { id: 'sender-1' }, message: { text: '인증' } },
          ],
        },
      ],
    }, deps);

    assert.equal(updates.length, 1);
    assert.equal(updates[0].data.status, 'code_sent');
    assert.match(updates[0].data.code, /^\d{6}$/);
    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0].recipientId, 'sender-1');
    assert.match(sentMessages[0].text, new RegExp(updates[0].data.code));
  } finally {
    process.env.INSTAGRAM_ACCESS_TOKEN = previousToken;
  }
});

test('instagram webhook sends guidance when no pending session exists', async () => {
  const previousToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  process.env.INSTAGRAM_ACCESS_TOKEN = 'token-1';

  const sentMessages = [];
  const prisma = {
    verificationSession: {
      findFirst: async () => null,
    },
  };
  const deps = {
    fetchInstagramUserProfile: async () => ({
      username: 'valid_user',
      isUserFollowBusiness: true,
    }),
    sendInstagramDm: async (recipientId, text) => {
      sentMessages.push({ recipientId, text });
      return { ok: true };
    },
  };

  try {
    await handleInstagramWebhookPayload(prisma, {
      object: 'instagram',
      entry: [
        {
          messaging: [
            { sender: { id: 'sender-1' }, message: { text: '인증' } },
          ],
        },
      ],
    }, deps);

    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0].recipientId, 'sender-1');
    assert.match(sentMessages[0].text, /코드 요청하기/);
  } finally {
    process.env.INSTAGRAM_ACCESS_TOKEN = previousToken;
  }
});

test('instagram webhook keeps session pending when code DM send fails', async () => {
  const previousToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  process.env.INSTAGRAM_ACCESS_TOKEN = 'token-1';

  const expiresAt = new Date(Date.now() + 60_000);
  const updates = [];
  const session = {
    id: 'session-1',
    instagramUsername: 'valid_user',
    status: 'pending',
    expiresAt,
  };
  const prisma = {
    verificationSession: {
      findFirst: async () => session,
      update: async (args) => {
        updates.push(args);
        return { ...session, ...args.data };
      },
    },
  };
  const deps = {
    fetchInstagramUserProfile: async () => ({
      username: 'valid_user',
      isUserFollowBusiness: true,
    }),
    sendInstagramDm: async () => ({ ok: false, error: 'send_failed' }),
  };

  try {
    await handleInstagramWebhookPayload(prisma, {
      object: 'instagram',
      entry: [
        {
          messaging: [
            { sender: { id: 'sender-1' }, message: { text: '인증' } },
          ],
        },
      ],
    }, deps);

    assert.equal(updates.length, 2);
    assert.equal(updates[0].data.status, 'code_sent');
    assert.equal(updates[1].data.status, 'pending');
    assert.equal(updates[1].data.code, null);
    assert.equal(updates[1].data.igUserId, null);
    assert.equal(updates[1].data.expiresAt, expiresAt);
  } finally {
    process.env.INSTAGRAM_ACCESS_TOKEN = previousToken;
  }
});
