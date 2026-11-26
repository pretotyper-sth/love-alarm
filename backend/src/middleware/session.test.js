import test from 'node:test';
import assert from 'node:assert/strict';
import { issueSession, requireSession } from './session.js';

function request(token, findUnique = async () => ({ id: 'private-user-id' })) {
  return {
    baseUrl: '/api/users',
    method: 'GET',
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
    prisma: { user: { findUnique } },
  };
}

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

for (const reason of ['missing_session', 'invalid_or_expired_session', 'account_missing']) {
  test(`rejected authentication logs ${reason} without account or credential data`, async t => {
    const log = t.mock.method(console, 'warn', () => {});
    const session = issueSession('private-user-id');
    const token = reason === 'missing_session' ? undefined
      : reason === 'invalid_or_expired_session' ? `${session.token}tampered` : session.token;
    const req = request(token, async () => null);
    const res = response();
    await requireSession(req, res, () => assert.fail('must reject'));
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.code, 'LOGIN_REQUIRED');
    assert.deepEqual(log.mock.calls[0].arguments, ['[auth] session rejected', {
      resource: '/api/users', method: 'GET', reason,
    }]);
    assert.equal(JSON.stringify(log.mock.calls[0].arguments).includes('private-user-id'), false);
    assert.equal(JSON.stringify(log.mock.calls[0].arguments).includes(session.token), false);
  });
}

test('valid authentication continues without a rejection log', async t => {
  const log = t.mock.method(console, 'warn', () => {});
  const req = request(issueSession('private-user-id').token);
  const res = response();
  let continued = false;
  await requireSession(req, res, () => { continued = true; });
  assert.equal(continued, true);
  assert.equal(req.user.id, 'private-user-id');
  assert.equal(res.statusCode, 200);
  assert.equal(log.mock.callCount(), 0);
});

test('database errors remain server errors rather than rejected sessions', async t => {
  const log = t.mock.method(console, 'warn', () => {});
  const error = new Error('database unavailable');
  const req = request(issueSession('private-user-id').token, async () => { throw error; });
  let forwarded;
  await requireSession(req, response(), err => { forwarded = err; });
  assert.equal(forwarded, error);
  assert.equal(log.mock.callCount(), 0);
});
