import test from 'node:test';
import assert from 'node:assert/strict';
import { isReceivedMessageUnread } from './messages.js';

test('server open state wins over a missing or stale local read cache', () => {
  assert.equal(isReceivedMessageUnread({ id: 'paid', opened: true, locked: false }, []), false);
  assert.equal(isReceivedMessageUnread({ id: 'new', opened: false, locked: true }, ['new']), true);
  assert.equal(isReceivedMessageUnread({ id: 'free', opened: false, locked: false }, []), true);
  assert.equal(isReceivedMessageUnread({ id: 'old-client' }, ['old-client']), false);
});
