import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { checkinMessagePass, instagramRewardStatus, alarmRegistrationRewards } from './messagePasses.js';

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
      findUnique: async ({ where }) => entries.get(where.reference) || null,
      findMany: async ({ where }) => [...entries.values()].filter(entry => (where.OR || [where]).some(filter => filter.reference.in?.includes(entry.reference) || (filter.reference.startsWith && entry.reference.startsWith(filter.reference.startsWith)))),
      upsert: async ({ where, create }) => { if (!entries.has(where.reference)) entries.set(where.reference, create); },
      count: async ({ where }) => [...entries.keys()].filter(key => key.startsWith(where.reference.startsWith)).length,
      create: async ({ data }) => { assert.equal(entries.has(data.reference), false); entries.set(data.reference, data); },
    },
    verificationSession: { findFirst: async () => null },
    alarm: { findMany: async () => [] },
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
  const summary = await checkinMessagePass(db, user, { now: new Date('2026-11-15T00:00:00Z'), includeRewards: true });
  assert.deepEqual(summary.instagram, { claimed: false, verified: false });
  assert.equal(summary.checkin.days, 6); assert.equal(summary.balance, 0);
  assert.equal(summary.alarms.count, 0);
  const account = createHash('sha256').update(user.tossUserId).digest('hex');
  for (const reference of [`instagram_reward:${account}`, `alarm_reward:${account}:first_alarm`]) entries.set(reference, { reference });
  tx.verificationSession.findFirst = async () => ({ instagramUsername: 'verified' });
  tx.alarm.findMany = async () => [{ targetInstagramId: 'one' }, { targetInstagramId: 'two' }, { targetInstagramId: 'ONE' }];
  const combined = await checkinMessagePass(db, user, { now: new Date('2026-11-15T00:00:00Z'), includeRewards: true });
  assert.deepEqual(combined.instagram, await instagramRewardStatus(tx, user));
  assert.deepEqual(combined.alarms, await alarmRegistrationRewards(tx, user));
  assert.equal(combined.alarms.count, 2);
  assert.equal(combined.alarms.rewards[0].claimed, true);
  assert.equal(combined.balance, 0);
});
