import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreviewApi } from './previewApi.js';

function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}

test('preview browsing never logs in and protected actions need explicit login', async () => {
  const api = createPreviewApi(memoryStorage());
  assert.equal(api.getCurrentUser(), null);
  assert.equal(api.hasSession(), false);
  assert.deepEqual(await api.getLikeCount('someone'), { count: 0 });
  for (const action of [() => api.getAlarms(), () => api.createAlarm('me', 'them'), () => api.updateSettings({ pushEnabled: true }), () => api.verifyInstagramStart('me')]) {
    await assert.rejects(action(), { status: 401 });
  }
});

test('mock login can finish an alarm action locally and survive reopening', async t => {
  const storage = memoryStorage();
  t.mock.method(globalThis, 'fetch', () => assert.fail('preview must not send requests'));
  const api = createPreviewApi(storage);
  const { user } = await api.login();
  assert.equal(user.id, 'local-preview-user');
  const { alarm } = await api.createAlarm('my_id', 'their_id', 'hello');
  assert.equal((await api.getAlarms())[0].id, alarm.id);
  const reopened = createPreviewApi(storage);
  assert.equal(reopened.hasSession(), true);
  assert.equal((await reopened.getSentMessages())[0].message, 'hello');
  await reopened.deleteAlarm(alarm.id);
  assert.deepEqual(await reopened.getAlarms(), []);
  reopened.logout();
  assert.equal(reopened.getCurrentUser(), null);
  await assert.rejects(reopened.getAlarms(), { status: 401 });
});
