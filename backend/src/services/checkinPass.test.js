import test from 'node:test';
import assert from 'node:assert/strict';
import { checkinMessagePass } from './messagePasses.js';

test('KST checkins deduplicate daily, allow gaps, reward each three days, and survive rejoining', async () => {
  const entries = new Map();
  const user = { id: 'user', tossUserId: 'stable-account', messagePassBalance: 0 };
  let locks = 0;
  const tx = {
    $queryRaw: async () => { locks++; },
    user: {
      findUniqueOrThrow: async () => ({ ...user }),
      update: async ({ data }) => { user.messagePassBalance += data.messagePassBalance.increment; },
    },
    messagePassEntry: {
      upsert: async ({ where, create }) => { if (!entries.has(where.reference)) entries.set(where.reference, create); },
      count: async ({ where }) => [...entries.keys()].filter(key => key.startsWith(where.reference.startsWith)).length,
      create: async ({ data }) => { assert.equal(entries.has(data.reference), false); entries.set(data.reference, data); },
    },
  };
  const db = { $transaction: async fn => fn(tx) };
  const visit = (now, claim = false) => checkinMessagePass(db, user, { now: new Date(now), claim });
  assert.equal((await visit('2026-11-01T14:59:59Z')).progress, 1);
  assert.equal((await visit('2026-11-01T14:59:59Z')).days, 1);
  await assert.rejects(visit('2026-11-01T14:59:59Z', true), { status: 409 });
  assert.equal((await visit('2026-11-01T15:00:00Z')).days, 2);
  for (const day of [6]) await visit(`2026-11-${String(day).padStart(2, '0')}T00:00:00Z`);
  const first = await visit('2026-11-06T00:00:00Z', true);
  assert.equal(first.balance, 1); assert.equal(first.progress, 0); assert.equal(first.canClaim, false);
  await assert.rejects(visit('2026-11-06T00:00:00Z', true), { status: 409 });
  for (const day of [8, 11, 15]) await visit(`2026-11-${String(day).padStart(2, '0')}T00:00:00Z`);
  assert.equal((await visit('2026-11-15T00:00:00Z', true)).balance, 2);
  for (const entry of entries.values()) entry.userId = null;
  user.id = 'rejoined'; user.messagePassBalance = 0;
  assert.equal((await visit('2026-11-15T00:00:00Z')).progress, 0);
  await assert.rejects(visit('2026-11-15T00:00:00Z', true), { status: 409 });
  assert.equal([...entries.values()].filter(e => e.reason === 'checkin_reward').length, 2);
  assert.ok(locks > 6);
});
