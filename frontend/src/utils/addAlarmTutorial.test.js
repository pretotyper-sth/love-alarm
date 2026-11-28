import test from 'node:test';
import assert from 'node:assert/strict';
import { createAddAlarmTutorial } from './addAlarmTutorial.js';

function storage() {
  const rows = new Map();
  return { getItem: key => rows.get(key) ?? null, setItem: (key, value) => rows.set(key, value) };
}

test('existing accounts never see the tutorial even without browser history', () => {
  const tutorial = createAddAlarmTutorial(storage());
  assert.equal(tutorial.claim('existing'), false); // Restored login.
  for (const isNewUser of [false, undefined, null, 'true']) {
    tutorial.start({ user: { id: 'existing' }, isNewUser });
    assert.equal(tutorial.claim('existing'), false);
  }
});

test('confirmed signup shows once and cannot repeat on remount or app restart', () => {
  const saved = storage(), tutorial = createAddAlarmTutorial(saved);
  tutorial.start({ user: { id: 'new' }, isNewUser: true });
  assert.equal(tutorial.claim('different-account'), false);
  assert.equal(tutorial.claim('new'), true);
  assert.equal(tutorial.claim('new'), false); // Includes repeated effect execution.
  tutorial.start({ user: { id: 'new' }, isNewUser: true });
  assert.equal(tutorial.claim('new'), false);
  assert.equal(createAddAlarmTutorial(saved).claim('new'), false);
  assert.equal(createAddAlarmTutorial(storage()).claim('new'), false);
});

test('logout clears eligibility; visiting the add form consumes it without a later home tutorial', () => {
  const tutorial = createAddAlarmTutorial(storage());
  tutorial.start({ user: { id: 'new' }, isNewUser: true });
  tutorial.clear();
  assert.equal(tutorial.claim('new'), false);
  tutorial.start({ user: { id: 'next' }, isNewUser: true });
  assert.equal(tutorial.claim('next'), true); // Add form entered directly.
  assert.equal(tutorial.claim('next'), false); // Returning home.
});

test('unavailable storage skips the tutorial without failing login', () => {
  const tutorial = createAddAlarmTutorial({ getItem: () => { throw new Error('blocked'); } });
  tutorial.start({ user: { id: 'new' }, isNewUser: true });
  assert.equal(tutorial.claim('new'), false);
});
