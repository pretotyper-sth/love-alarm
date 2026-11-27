import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreAuthUser } from './auth.js';

function savedApi(overrides = {}) {
  return {
    getCurrentUser: () => ({ id: 'existing' }),
    hasSession: () => true,
    getUser: async () => ({ id: 'existing' }),
    login: () => assert.fail('browsing must never initiate login'),
    tossLogin: () => assert.fail('browsing must never initiate Toss login'),
    logout: () => {},
    ...overrides,
  };
}

test('first visit and expired saved sessions stay signed out without starting login', async () => {
  assert.equal(await restoreAuthUser(savedApi({ getCurrentUser: () => null, getUser: () => assert.fail('no guest profile request') })), null);
  assert.equal(await restoreAuthUser(savedApi({ hasSession: () => false, getUser: () => assert.fail('no expired profile request') })), null);
});

test('valid saved session restores silently', async () => {
  const user = { id: 'existing', maxSlots: 3 };
  assert.equal(await restoreAuthUser(savedApi({ getUser: async () => user })), user);
});

for (const status of [401, 403, 404]) {
  test(`rejected saved account (${status}) returns to browsing instead of forcing login`, async () => {
    let loggedOut = 0;
    const api = savedApi({ getUser: async () => { throw Object.assign(new Error('rejected'), { status }); }, logout: () => { loggedOut++; } });
    assert.equal(await restoreAuthUser(api), null);
    assert.equal(loggedOut, 1);
  });
}

test('temporary server or network failure keeps an existing session', async () => {
  for (const status of [500, undefined]) {
    const user = { id: 'existing' };
    const api = savedApi({ getCurrentUser: () => user, getUser: async () => { throw Object.assign(new Error('unavailable'), { status }); }, logout: () => assert.fail('must preserve account') });
    assert.equal(await restoreAuthUser(api), user);
  }
});
