import test from 'node:test';
import assert from 'node:assert/strict';
import userRoutes from './users.js';
import verifyInstagramRoutes from './verifyInstagram.js';

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
