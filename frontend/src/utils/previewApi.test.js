import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreviewApi } from './previewApi.js';
import { purchaseMessagePass } from './messagePassPurchase.js';
import { isReceivedMessageUnread } from './messages.js';

function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}

test('alarm rewards retain distinct registration progress through deletion and cannot be reclaimed', async () => {
  const api = createPreviewApi(memoryStorage());
  await assert.rejects(api.getAlarmRewards(), { status: 401 });
  await api.login();
  await assert.rejects(api.claimAlarmReward('first_alarm'), { status: 409 });
  const first = await api.createAlarm('me', 'person_one');
  assert.equal((await api.claimAlarmReward('first_alarm')).balance, 1);
  await api.deleteAlarm(first.alarm.id);
  const repeated = await api.createAlarm('me', 'PERSON_ONE');
  assert.equal((await api.getAlarmRewards()).count, 1);
  await api.deleteAlarm(repeated.alarm.id);
  await api.createAlarm('me', 'person_two');
  await api.createAlarm('me', 'person_three');
  assert.equal((await api.claimAlarmReward('three_alarms')).balance, 2);
  assert.equal((await api.claimAlarmReward('first_alarm')).balance, 2);
  assert.equal((await api.claimAlarmReward('three_alarms')).alreadyGranted, true);
  await api.verifyInstagramStart('me');
  await api.verifyInstagramConfirm('preview-verification', '123456');
  assert.equal((await api.openReceivedMessage('preview-message-1')).balance, 1);
  await api.withdrawAccount(); await api.login();
  assert.ok((await api.getAlarmRewards()).rewards.every(mission => mission.claimed));
});

test('preview three-day reward repeats without consecutive visits or duplicate daily credit', async () => {
  let date = new Date('2026-11-01T14:00:00Z');
  const api = createPreviewApi(memoryStorage(), () => date);
  await assert.rejects(api.checkinMessagePass(), { status: 401 });
  await api.login();
  assert.equal((await api.checkinMessagePass()).progress, 1);
  assert.equal((await api.checkinMessagePass()).progress, 1);
  await assert.rejects(api.claimCheckinPass(), { status: 409 });
  for (let day = 2; day <= 6; day++) {
    date = new Date(Date.UTC(2026, 10, day * 2));
    const state = await api.checkinMessagePass();
    if (day % 3 === 0) {
      assert.equal(state.canClaim, true);
      const claimed = await api.claimCheckinPass();
      assert.equal(claimed.balance, day / 3); assert.equal(claimed.progress, 0);
      await assert.rejects(api.claimCheckinPass(), { status: 409 });
    }
  }
});

test('Instagram reward requires verification, grants once, and opens a paid message without purchase', async () => {
  const api = createPreviewApi(memoryStorage());
  await assert.rejects(api.claimInstagramReward(), { status: 401 });
  await api.login();
  await assert.rejects(api.claimInstagramReward(), { code: 'INSTAGRAM_REQUIRED' });
  await api.verifyInstagramStart('reward_account');
  await api.verifyInstagramConfirm('preview-verification', '123456');
  assert.equal((await api.claimInstagramReward()).balance, 1);
  assert.equal((await api.claimInstagramReward()).alreadyGranted, true);
  assert.equal((await api.openReceivedMessage('preview-message-1')).balance, 0);
  await assert.rejects(api.openReceivedMessage('preview-message-2'), { code: 'PASS_REQUIRED' });
  await api.withdrawAccount();
  await api.login();
  assert.equal((await api.getInstagramReward()).claimed, true);
});

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

for (const productId of ['single', 'bundle']) test(`preview ${productId} purchase uses registered SKU, grants once, and spends once locally`, async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('preview must not send requests'));
  const storage = memoryStorage();
  const api = createPreviewApi(storage);
  await assert.rejects(api.getMessagePassWallet(), { status: 401 });
  await api.login();
  await assert.rejects(api.openReceivedMessage('preview-message-1'), { code: 'INSTAGRAM_REQUIRED' });
  await api.verifyInstagramStart('my_preview_account');
  await api.verifyInstagramConfirm('preview-verification', '123456');
  const before = await api.getReceivedMessageState();
  assert.ok(before.messages.slice(0, 2).every(message => message.locked && message.message === null));
  const wallet = await api.getMessagePassWallet();
  const product = wallet.products.find(item => item.id === productId);
  assert.match(product.sku, /^ait\.0000015595\./);
  await assert.rejects(api.openReceivedMessage(before.messages[0].id), { code: 'PASS_REQUIRED' });
  await assert.rejects(api.grantMessagePassOrder('made-up-order'));
  let orderId;
  await purchaseMessagePass({ IAP: api.messagePassIAP, sku: product.sku, grant: async id => { orderId = id; return api.grantMessagePassOrder(id); } }).promise;
  assert.equal((await api.getMessagePassWallet()).balance, product.quantity);
  assert.equal((await api.grantMessagePassOrder(orderId)).alreadyGranted, true);
  const opened = await api.openReceivedMessage(before.messages[0].id);
  assert.ok(opened.message.message);
  assert.equal(opened.balance, product.quantity - 1);
  assert.equal((await api.openReceivedMessage(before.messages[0].id)).balance, product.quantity - 1);
  const reopened = createPreviewApi(storage);
  assert.equal((await reopened.getMessagePassWallet()).balance, product.quantity - 1);
  assert.equal((await reopened.getReceivedMessageState()).messages[0].locked, false);
  reopened.resetMessagePassPreview();
  assert.equal((await reopened.getMessagePassWallet()).balance, 0);
  assert.ok((await reopened.getReceivedMessageState()).messages.slice(0, 2).every(message => message.locked));
});

test('preview inbox covers locked, free, opened, reacted, long and reported messages without requests', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('preview must not send requests'));
  const storage = memoryStorage();
  const api = createPreviewApi(storage);
  await api.login();
  await api.verifyInstagramStart('preview_account');
  await api.verifyInstagramConfirm('preview-verification', '123456');
  const { messages } = await api.getReceivedMessageState();
  assert.equal(messages.length, 8);
  assert.equal(messages.filter(message => message.locked).length, 3);
  assert.ok(messages.find(message => message.id === 'preview-message-6').message.length > 100);
  assert.equal(messages.find(message => message.id === 'preview-message-5').reactions[0].emoji, '😊');
  await assert.rejects(api.reactToMessage('preview-message-1', '❤️'), /먼저 열어/);
  assert.ok(messages.filter(message => isReceivedMessageUnread(message)).every(message => message.locked));
  assert.ok(messages.filter(message => !message.locked).every(message => message.opened));
  assert.equal((await api.openReceivedMessage('preview-message-3')).balance, 0);
  await assert.rejects(api.reactToMessage('preview-message-3', 'invalid'), /유효하지/);
  assert.equal((await api.reactToMessage('preview-message-3', '❤️')).reaction.emoji, '❤️');
  assert.equal((await api.reactToMessage('preview-message-3', '🤔')).reaction.emoji, '❤️');
  const reopened = createPreviewApi(storage);
  assert.equal((await reopened.openReceivedMessage('preview-message-3')).message.reactions[0].emoji, '❤️');
  await reopened.reportMessage('preview-message-7', '스팸 또는 광고 같아요');
  assert.equal((await createPreviewApi(storage).getReceivedMessageState()).messages.length, 7);
  await assert.rejects(reopened.openReceivedMessage('preview-message-7'), /찾을 수/);
  await assert.rejects(reopened.reactToMessage('preview-message-7', '❤️'), /찾을 수/);
});

test('local withdrawal removes the preview account without network requests and allows a fresh signup', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('preview must not send requests'));
  const saved = memoryStorage(), api = createPreviewApi(saved);
  await assert.rejects(api.withdrawAccount(), { status: 401 });
  await api.login(); await api.createAlarm('me', 'someone', 'hello');
  await api.withdrawAccount();
  assert.equal(api.hasSession(), false); assert.equal(api.getCurrentUser(), null);
  assert.equal((await api.login()).isNewUser, true);
  assert.deepEqual(await api.getAlarms(), []);
});
