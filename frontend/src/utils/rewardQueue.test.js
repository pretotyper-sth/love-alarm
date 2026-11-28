import { setImmediate } from 'node:timers';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRewardQueue } from './rewardQueue.js';

test('rapid distinct reward claims queue in order, deduplicate repeated clicks, and all keep their results', async () => {
  const pending = [], events = [], results = [];
  let release;
  const queue = createRewardQueue(keys => pending.push(keys));
  const first = queue.enqueue('first_alarm', async () => {
    events.push('first:start'); await new Promise(resolve => { release = resolve; });
    events.push('first:end'); results.push('첫 알람 보상');
  });
  const second = queue.enqueue('three_alarms', async () => { events.push('three'); results.push('알람 3명 보상'); });
  assert.equal(queue.enqueue('first_alarm', () => assert.fail('duplicate must not execute')), first);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(pending.at(-1), ['first_alarm', 'three_alarms']);
  assert.deepEqual(events, ['first:start']);
  release(); await Promise.all([first, second]);
  assert.deepEqual(events, ['first:start', 'first:end', 'three']);
  assert.deepEqual(results, ['첫 알람 보상', '알람 3명 보상']);
  assert.deepEqual(pending.at(-1), []);
});

test('a failed claim does not discard the next reward and can be retried', async () => {
  const queue = createRewardQueue();
  const failed = queue.enqueue('one', async () => { throw new Error('network'); });
  const next = queue.enqueue('two', async () => 'granted');
  await assert.rejects(failed, /network/);
  assert.equal(await next, 'granted');
  assert.equal(await queue.enqueue('one', async () => 'retried'), 'retried');
});
