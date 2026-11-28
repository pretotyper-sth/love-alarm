import test from 'node:test';
import assert from 'node:assert/strict';
import { backDismissStack, isExitRoot, subscribeNativeBack } from './backNavigation.js';

test('Toss root leaves exit and GNB dimming to the native host without subscribing', () => {
  const graniteEvent = { addEventListener() { assert.fail('native root must not be intercepted'); } };
  for (const path of ['/', '/alarms']) {
    assert.equal(isExitRoot(path), true);
    subscribeNativeBack({ graniteEvent, path, hasOverlay: false, onBack: assert.fail })();
  }
  assert.equal(isExitRoot('/more'), false);
});

test('child routes and root overlays intercept back; unsubscribe restores host behavior', () => {
  let removed = 0, calls = 0;
  for (const state of [{ path: '/feedback', hasOverlay: false }, { path: '/alarms', hasOverlay: true }]) {
    let onBack;
    const off = subscribeNativeBack({ ...state, onBack: () => calls++, graniteEvent: {
      addEventListener(name, callbacks) { assert.equal(name, 'backEvent'); onBack = callbacks.onEvent; return () => removed++; },
    } });
    onBack(); off();
  }
  assert.equal(calls, 2); assert.equal(removed, 2);
});

test('back consumes only the top overlay, including busy dialogs, before exposing the page', () => {
  const calls = [];
  let updates = 0;
  const unsubscribe = backDismissStack.subscribe(() => updates++);
  const closeSheet = backDismissStack.push(() => calls.push('sheet'));
  const closeReport = backDismissStack.push(() => calls.push('report'));
  assert.equal(backDismissStack.size(), 2);
  assert.equal(backDismissStack.dismiss(), true);
  assert.deepEqual(calls, ['report']);
  closeReport();
  backDismissStack.dismiss(); assert.deepEqual(calls, ['report', 'sheet']);
  const closeBusy = backDismissStack.push(() => {});
  assert.equal(backDismissStack.dismiss(), true);
  assert.deepEqual(calls, ['report', 'sheet']);
  closeBusy(); closeSheet(); unsubscribe();
  assert.equal(backDismissStack.dismiss(), false);
  assert.equal(backDismissStack.size(), 0); assert.equal(updates, 6);
});
