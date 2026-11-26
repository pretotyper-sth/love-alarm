import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshAuthUser } from './auth.js';

test('valid session restores the user without logging in again', async () => {
  const user = { id: 'existing' };
  assert.equal(await refreshAuthUser({ getUser: async () => user }, () => assert.fail('unexpected login')), user);
});

test('rejected session renews Toss login and returns the restored user', async () => {
  const user = { id: 'existing' };
  let logins = 0;
  const api = { getUser: async () => { throw Object.assign(new Error('expired'), { status: 401 }); } };
  assert.equal(await refreshAuthUser(api, async () => { logins++; return user; }), user);
  assert.equal(logins, 1);
});

for (const status of [404, 500, undefined]) {
  test(`lookup failure (${status ?? 'network'}) preserves the error without logging in`, async () => {
    const error = Object.assign(new Error('lookup failed'), { status });
    const api = { getUser: async () => { throw error; } };
    await assert.rejects(refreshAuthUser(api, () => assert.fail('unexpected login')), e => e === error);
  });
}

test('failed session renewal propagates the login error', async () => {
  const error = new Error('Toss unavailable');
  const api = { getUser: async () => { throw Object.assign(new Error('expired'), { status: 401 }); } };
  await assert.rejects(refreshAuthUser(api, async () => { throw error; }), e => e === error && e.status === 401);
});
