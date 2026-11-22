import test from 'node:test';
import assert from 'node:assert/strict';
import { createMessageRouter } from './messages.js';

test('reaction retries and later choices preserve the first reaction', async () => {
  const router = createMessageRouter();
  const handler = router.stack.find(layer => layer.route?.path === '/:messageId/reaction').route.stack[0].handle;
  let stored;
  const prisma = {
    verificationSession: { findFirst: async () => ({ instagramUsername: 'recipient' }) },
    messageDelivery: { findUnique: async () => ({ id: 'message', targetInstagramId: 'recipient', unlocks: [{ id: 'unlock' }] }) },
    messageReaction: {
      createMany: async ({ data, skipDuplicates }) => { assert.equal(skipDuplicates, true); stored ??= data[0]; },
      findUniqueOrThrow: async () => stored,
    },
  };
  for (const emoji of ['❤️', '😊', '❤️']) {
    let response;
    await handler({ body: { emoji }, user: { id: 'user' }, params: { messageId: 'message' }, prisma }, { json: data => { response = data; } }, error => { throw error; });
    assert.equal(response.reaction.emoji, '❤️');
  }
});
