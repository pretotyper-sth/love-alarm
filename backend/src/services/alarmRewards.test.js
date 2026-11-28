import test from 'node:test';
import assert from 'node:assert/strict';
import { alarmRegistrationRewards, claimAlarmRegistrationReward } from './messagePasses.js';

test('alarm missions count distinct targets including deleted alarms and grant each milestone only once per Toss account', async () => {
  const user = { id: 'owner', tossUserId: 'stable-toss-account', messagePassBalance: 0 };
  const alarms = [], receipts = new Map();
  let locks = 0;
  const tx = {
    $queryRaw: async () => { locks++; },
    user: {
      findUniqueOrThrow: async () => ({ ...user }),
      update: async ({ data }) => { user.messagePassBalance += data.messagePassBalance.increment; },
    },
    alarm: { findMany: async ({ where }) => { assert.deepEqual(where, { userId: user.id }); return alarms; } },
    messagePassEntry: {
      findMany: async ({ where }) => [...receipts.values()].filter(entry => where.reference.in.includes(entry.reference)),
      create: async ({ data }) => { assert.equal(receipts.has(data.reference), false); receipts.set(data.reference, data); },
    },
  };
  const db = { ...tx, $transaction: async fn => fn(tx) };
  await assert.rejects(claimAlarmRegistrationReward(db, user, 'unknown'), { status: 400 });
  await assert.rejects(claimAlarmRegistrationReward(db, user, 'first_alarm'), { status: 409 });
  assert.equal(user.messagePassBalance, 0);
  alarms.push({ targetInstagramId: ' Person_One ', deletedAt: new Date() }, { targetInstagramId: 'person_one' });
  assert.equal((await alarmRegistrationRewards(db, user)).count, 1);
  assert.equal((await claimAlarmRegistrationReward(db, user, 'first_alarm')).balance, 1);
  assert.equal((await claimAlarmRegistrationReward(db, user, 'first_alarm')).alreadyGranted, true);
  await assert.rejects(claimAlarmRegistrationReward(db, user, 'three_alarms'), { status: 409 });
  alarms.push({ targetInstagramId: 'person_two', deletedAt: new Date() }, { targetInstagramId: 'person_three' });
  assert.equal((await claimAlarmRegistrationReward(db, user, 'three_alarms')).balance, 2);
  assert.equal((await claimAlarmRegistrationReward(db, user, 'three_alarms')).alreadyGranted, true);
  assert.equal(receipts.size, 2);
  assert.ok(locks >= 6);
  // Retained receipts prevent rejoining with another internal ID from claiming either mission again.
  for (const receipt of receipts.values()) receipt.userId = null;
  user.id = 'rejoined'; user.messagePassBalance = 0; alarms.length = 0;
  assert.ok((await alarmRegistrationRewards(db, user)).rewards.every(mission => mission.claimed && !mission.canClaim));
  assert.equal((await claimAlarmRegistrationReward(db, user, 'first_alarm')).balance, 0);
});
