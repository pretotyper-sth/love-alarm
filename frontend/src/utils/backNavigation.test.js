import { setImmediate } from 'node:timers';
import test from 'node:test';
import assert from 'node:assert/strict';
import { backDismissStack, isExitRoot, subscribeNativeBack, updateExitNavigationBar } from './backNavigation.js';

test('Toss root explicitly subscribes so every host shows an exit confirmation', () => {
  let calls = 0, removed = 0;
  const graniteEvent = { addEventListener(name, { onEvent }) { assert.equal(name, 'backEvent'); onEvent(); return () => removed++; } };
  for (const path of ['/', '/alarms']) {
    assert.equal(isExitRoot(path), true);
    subscribeNativeBack({ graniteEvent, onBack: () => calls++ })();
  }
  assert.equal(isExitRoot('/more'), false);
  assert.equal(calls, 2); assert.equal(removed, 2);
});

test('GNB dim and restore stay ordered across rapid reopening without changing layout or theme', async () => {
  const applied = [];
  let finishFirst;
  const NavigationBar = { setOptions: async options => {
    applied.push(options);
    if (applied.length === 1) await new Promise(resolve => { finishFirst = resolve; });
  } };
  const first = updateExitNavigationBar(NavigationBar, true);
  const restore = updateExitNavigationBar(NavigationBar, false);
  const reopen = updateExitNavigationBar(NavigationBar, true);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(applied, [{ backgroundColor: '#999999' }]);
  finishFirst(); await Promise.all([first, restore, reopen]);
  assert.deepEqual(applied, [{ backgroundColor: '#999999' }, { backgroundColor: '#ffffff' }, { backgroundColor: '#999999' }]);
  await updateExitNavigationBar(NavigationBar, false);
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
