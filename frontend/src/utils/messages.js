import { storage } from './storage';

export const READ_RECEIVED_MESSAGE_IDS_KEY = 'love_alarm_read_received_message_ids';
export const REPORTED_RECEIVED_MESSAGE_IDS_KEY = 'love_alarm_reported_received_message_ids';

export function loadReadReceivedMessageIds() {
  const ids = storage.get(READ_RECEIVED_MESSAGE_IDS_KEY);
  return Array.isArray(ids) ? ids : [];
}

export function saveReadReceivedMessageIds(ids) {
  storage.set(READ_RECEIVED_MESSAGE_IDS_KEY, ids);
}

export function markReceivedMessageAsRead(messageId) {
  const currentIds = loadReadReceivedMessageIds();
  if (currentIds.includes(messageId)) {
    return currentIds;
  }

  const nextIds = [...currentIds, messageId];
  saveReadReceivedMessageIds(nextIds);
  return nextIds;
}

export function pruneReadReceivedMessageIds(validMessageIds) {
  const validIdSet = new Set(validMessageIds);
  const nextIds = loadReadReceivedMessageIds().filter((id) => validIdSet.has(id));
  saveReadReceivedMessageIds(nextIds);
  return nextIds;
}

export function countUnreadReceivedMessages(messages) {
  const readIdSet = new Set(loadReadReceivedMessageIds());
  const reportedIdSet = new Set(loadReportedReceivedMessageIds());
  return messages.filter((message) => !readIdSet.has(message.id) && !reportedIdSet.has(message.id)).length;
}

export function loadReportedReceivedMessageIds() {
  const ids = storage.get(REPORTED_RECEIVED_MESSAGE_IDS_KEY);
  return Array.isArray(ids) ? ids : [];
}

export function saveReportedReceivedMessageIds(ids) {
  storage.set(REPORTED_RECEIVED_MESSAGE_IDS_KEY, ids);
}

export function markReceivedMessageAsReported(messageId) {
  const currentIds = loadReportedReceivedMessageIds();
  if (currentIds.includes(messageId)) {
    return currentIds;
  }

  const nextIds = [...currentIds, messageId];
  saveReportedReceivedMessageIds(nextIds);
  return nextIds;
}

export function pruneReportedReceivedMessageIds(validMessageIds) {
  const validIdSet = new Set(validMessageIds);
  const nextIds = loadReportedReceivedMessageIds().filter((id) => validIdSet.has(id));
  saveReportedReceivedMessageIds(nextIds);
  return nextIds;
}
