import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers';
import { createAccountData } from './accountData.js';

function setup() {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  let user = { id: 'a' }, time = 1000, calls = 0, walletCalls = 0;
  const state = { instagram: { verified: true, claimed: false }, alarms: { count: 1, rewards: [] }, checkin: { days: 1, progress: 1, canClaim: false }, balance: 3 };
  const base = {
    hasSession: () => !!user, getCurrentUser: () => user,
    getRewardSummary: async () => { calls++; return structuredClone(state); },
    getMessagePassWallet: async () => { walletCalls++; return { balance: state.balance, products: [], entries: [] }; },
    claimInstagramReward: async () => { state.instagram.claimed = true; state.balance++; return { ...state.instagram, balance: state.balance }; },
    openReceivedMessage: async () => { state.balance--; return { balance: state.balance, message: { opened: true } }; },
    logout: () => { user = null; },
    withdrawAccount: async () => ({ success: true }),
  };
  return { base, state, storage, current: () => user, switchUser: id => { user = id ? { id } : null; }, calls: () => calls, walletCalls: () => walletCalls,
    advance: ms => { time += ms; }, cache: createAccountData(base, storage, () => time) };
}

test('one prefetched snapshot serves rewards and withdrawal immediately, deduplicating concurrent reads', async () => {
  const f = setup();
  assert.equal(f.cache.getSnapshot(), null);
  await Promise.all(Array.from({ length: 5 }, () => f.cache.api.getRewardSummary()));
  assert.equal(f.calls(), 1);
  assert.equal(f.cache.getSnapshot().instagram.verified, true);
  assert.equal(f.cache.getSnapshot().balance, 3);
  await f.cache.api.getRewardSummary(); assert.equal(f.calls(), 1);
  f.advance(10001); await f.cache.api.getRewardSummary(); assert.equal(f.calls(), 2);
  const reopened = createAccountData(f.base, f.storage, () => 11001);
  assert.equal(reopened.getSnapshot().balance, 3);
});

test('claim and open responses update the shared balance; a slower earlier snapshot cannot roll them back', async () => {
  const f = setup(); await f.cache.api.getRewardSummary();
  let complete;
  const old = structuredClone(f.state);
  f.base.getRewardSummary = () => new Promise(resolve => { complete = resolve; });
  const refresh = f.cache.api.getRewardSummary({ force: true });
  await new Promise(resolve => setImmediate(resolve));
  await f.cache.api.claimInstagramReward();
  assert.equal(f.cache.getSnapshot().balance, 4);
  assert.equal(f.cache.getSnapshot().instagram.claimed, true);
  complete(old); await refresh;
  assert.equal(f.cache.getSnapshot().balance, 4);
  await f.cache.api.openReceivedMessage('message');
  assert.equal(f.cache.getSnapshot().balance, 3);
});

test('concurrent wallet reads coalesce and a delayed pre-spend wallet cannot overwrite the latest balance', async () => {
  const f = setup(); await f.cache.api.getRewardSummary();
  let complete;
  f.base.getMessagePassWallet = () => new Promise(resolve => { complete = resolve; });
  const one = f.cache.api.getMessagePassWallet(), two = f.cache.api.getMessagePassWallet();
  await new Promise(resolve => setImmediate(resolve));
  await f.cache.api.openReceivedMessage('message');
  complete({ balance: 3, products: [] });
  assert.equal((await one).balance, 2); assert.equal((await two).balance, 2);
  assert.equal(f.cache.getSnapshot().balance, 2);
});

test('logout clears account data; delayed replies cannot expose one account to another', async () => {
  const f = setup(); await f.cache.api.getRewardSummary();
  let complete;
  f.base.getRewardSummary = () => new Promise(resolve => { complete = resolve; });
  const pending = f.cache.api.getRewardSummary({ force: true });
  await new Promise(resolve => setImmediate(resolve));
  f.cache.api.logout(); f.switchUser('b');
  assert.equal(f.cache.getSnapshot(), null);
  complete(structuredClone(f.state)); await pending;
  assert.equal(f.cache.getSnapshot(), null);
  f.switchUser('a'); assert.equal(f.cache.getSnapshot(), null);
});

test('failed initial summaries remain retryable even if wallet data arrives separately', async () => {
  const f = setup();
  const original = f.base.getRewardSummary;
  f.base.getRewardSummary = async () => { throw new Error('offline'); };
  await assert.rejects(f.cache.api.getRewardSummary(), /offline/);
  await f.cache.api.getMessagePassWallet();
  assert.equal(f.cache.getSnapshot().error, true);
  assert.equal(f.cache.getSnapshot().instagram, undefined);
  f.base.getRewardSummary = original;
  await f.cache.api.getRewardSummary({ force: true });
  assert.equal(f.cache.getSnapshot().error, false);
});

test('storage restrictions do not block fetching or authenticated actions', async () => {
  const f = setup();
  const blocked = () => { throw new Error('blocked'); };
  const cache = createAccountData(f.base, { getItem: blocked, setItem: blocked, removeItem: blocked });
  await cache.api.getRewardSummary(); await cache.api.claimInstagramReward();
  assert.equal(cache.getSnapshot().balance, 4);
  cache.api.logout(); assert.equal(cache.getSnapshot(), null);
});

test('overlapping mutations reconcile with one fresh snapshot instead of showing an out-of-order balance', async () => {
  const f = setup(); await f.cache.api.getRewardSummary();
  const finish = [];
  f.base.openReceivedMessage = () => new Promise(resolve => finish.push(resolve));
  const first = f.cache.api.openReceivedMessage('first');
  const second = f.cache.api.openReceivedMessage('second');
  f.state.balance = 1;
  finish[1]({ balance: 1 }); await second;
  assert.equal(f.cache.getSnapshot().balance, null);
  finish[0]({ balance: 2 }); await first;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.cache.getSnapshot().balance, 1);
  assert.equal(f.calls(), 2);
});

test('a KST date change refreshes attendance even inside the normal freshness window', async () => {
  const f = setup();
  let time = Date.parse('2026-11-28T14:59:59Z');
  const cache = createAccountData(f.base, f.storage, () => time);
  await cache.api.getRewardSummary();
  time += 2000;
  await cache.api.getRewardSummary();
  assert.equal(f.calls(), 2);
});
