import fetch from 'node-fetch';
import { createHash } from 'node:crypto';
import { getHttpsAgent } from './tossAuth.js';
import { MESSAGE_PASS_PRODUCTS } from '../config/messagePassProducts.js';
import { ALARM_REWARDS } from '../config/alarmRewards.js';

export class MessagePassError extends Error {
  constructor(message, status = 400, code = 'MESSAGE_PASS_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function passProducts(env = process.env) {
  return MESSAGE_PASS_PRODUCTS.map(product => ({
    ...product,
    sku: env[product.id === 'single' ? 'TOSS_MESSAGE_PASS_SINGLE_SKU' : 'TOSS_MESSAGE_PASS_BUNDLE_SKU'] || null,
  }));
}

export function messagePassSalesEnabled(env = process.env) {
  const products = passProducts(env);
  return env.MESSAGE_PASSES_ENABLED === 'true' && products.every(p => p.sku) && products[0].sku !== products[1].sku;
}

export async function verifiedRecipient(db, userId) {
  const session = await db.verificationSession.findFirst({
    where: { userId, status: 'verified' }, orderBy: { updatedAt: 'desc' },
  });
  if (!session) throw new MessagePassError('인스타그램 인증을 먼저 완료해 주세요.', 403, 'INSTAGRAM_REQUIRED');
  return session.instagramUsername;
}

// Only the fields needed by the recipient leave the server. Never serialize Alarm/User.
export function receivedMessage(message, unlocked = false) {
  const locked = message.requiresPass && !unlocked;
  return {
    id: message.id, createdAt: message.createdAt, locked, opened: unlocked,
    message: locked ? null : message.message,
    reactions: message.reaction ? [{ emoji: message.reaction.emoji }] : [],
  };
}

export async function verifyTossPassOrder(orderId, tossUserId, { request = fetch, agent = getHttpsAgent(), allowRefunded = false } = {}) {
  if (!agent) throw new MessagePassError('결제 확인을 준비 중이에요.', 503);
  const response = await request('https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/order/get-order-status', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-toss-user-key': tossUserId },
    body: JSON.stringify({ orderId }), agent, signal: AbortSignal.timeout(10000),
  });
  const payload = await response.json();
  const order = payload.success;
  if (!response.ok || payload.resultType !== 'SUCCESS' || order?.orderId !== orderId) {
    throw new MessagePassError('결제를 확인하지 못했어요. 닫았다가 다시 열어 주세요.', 503);
  }
  // This field was introduced 2026-11-17; missing/unknown must never grant a purchase.
  if (order.purchaserMatched !== true) throw new MessagePassError('이 계정의 구매 내역을 확인할 수 없어요.', 403);
  if (![...['PAYMENT_COMPLETED', 'PURCHASED'], ...(allowRefunded ? ['REFUNDED'] : [])].includes(order.status)) {
    throw new MessagePassError('완료된 결제가 아니에요. 열람권은 지급되지 않았어요.', 409);
  }
  return order;
}

export async function lockWallet(tx, userId) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
  return tx.user.findUniqueOrThrow({ where: { id: userId } });
}

function instagramRewardReference(user) {
  return `instagram_reward:${createHash('sha256').update(user.tossUserId).digest('hex')}`;
}

export async function instagramRewardStatus(db, user) {
  const [claimed, verified] = await Promise.all([
    db.messagePassEntry.findUnique({ where: { reference: instagramRewardReference(user) } }),
    db.verificationSession.findFirst({ where: { userId: user.id, status: 'verified' } }),
  ]);
  return { claimed: !!claimed, verified: !!verified };
}

export async function claimInstagramReward(db, user) {
  return db.$transaction(async tx => {
    const wallet = await lockWallet(tx, user.id);
    const status = await instagramRewardStatus(tx, user);
    if (status.claimed) return { ...status, balance: wallet.messagePassBalance, alreadyGranted: true };
    if (!status.verified) throw new MessagePassError('인스타그램 인증을 먼저 완료해 주세요.', 403, 'INSTAGRAM_REQUIRED');
    // The receipt survives withdrawal, so reconnecting the same Toss account cannot claim again.
    await tx.messagePassEntry.create({ data: { userId: user.id, delta: 1, reason: 'instagram_reward', reference: instagramRewardReference(user) } });
    await tx.user.update({ where: { id: user.id }, data: { messagePassBalance: { increment: 1 } } });
    return { claimed: true, verified: true, balance: wallet.messagePassBalance + 1, alreadyGranted: false };
  });
}

export async function checkinMessagePass(db, user, { claim = false, now = new Date() } = {}) {
  const account = createHash('sha256').update(user.tossUserId).digest('hex');
  const date = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return db.$transaction(async tx => {
    const wallet = await lockWallet(tx, user.id);
    // Stable account receipts preserve attendance and claimed cycles across devices and rejoining.
    const reference = `checkin:${account}:${date}`;
    await tx.messagePassEntry.upsert({ where: { reference }, create: { userId: user.id, delta: 0, reason: 'checkin', reference }, update: {} });
    const days = await tx.messagePassEntry.count({ where: { reference: { startsWith: `checkin:${account}:` } } });
    let claimed = await tx.messagePassEntry.count({ where: { reference: { startsWith: `checkin_reward:${account}:` } } });
    let granted = false;
    if (claim) {
      if (days < (claimed + 1) * 3) throw new MessagePassError('3일 출석하면 받을 수 있어요.', 409);
      await tx.messagePassEntry.create({ data: { userId: user.id, delta: 1, reason: 'checkin_reward', reference: `checkin_reward:${account}:${claimed + 1}` } });
      await tx.user.update({ where: { id: user.id }, data: { messagePassBalance: { increment: 1 } } });
      claimed++; granted = true;
    }
    return { days, progress: Math.min(days - claimed * 3, 3), canClaim: days >= (claimed + 1) * 3, balance: wallet.messagePassBalance + Number(granted), granted };
  });
}

function alarmRewardReference(user, missionId) {
  return `alarm_reward:${createHash('sha256').update(user.tossUserId).digest('hex')}:${missionId}`;
}

export async function alarmRegistrationRewards(db, user) {
  const [alarms, receipts] = await Promise.all([
    // Soft-deleted alarms remain eligible, so deleting and re-registering a target adds no progress.
    db.alarm.findMany({ where: { userId: user.id }, select: { targetInstagramId: true } }),
    db.messagePassEntry.findMany({ where: { reference: { in: ALARM_REWARDS.map(mission => alarmRewardReference(user, mission.id)) } }, select: { reference: true } }),
  ]);
  const count = new Set(alarms.map(alarm => alarm.targetInstagramId.trim().toLowerCase())).size;
  return { count, rewards: ALARM_REWARDS.map(mission => {
    const claimed = receipts.some(receipt => receipt.reference === alarmRewardReference(user, mission.id));
    return { ...mission, progress: Math.min(count, mission.goal), claimed, canClaim: count >= mission.goal && !claimed };
  }) };
}

export async function claimAlarmRegistrationReward(db, user, missionId) {
  if (!ALARM_REWARDS.some(mission => mission.id === missionId)) throw new MessagePassError('보상을 확인해 주세요.');
  return db.$transaction(async tx => {
    const wallet = await lockWallet(tx, user.id);
    const status = await alarmRegistrationRewards(tx, user);
    const mission = status.rewards.find(item => item.id === missionId);
    if (mission.claimed) return { ...status, balance: wallet.messagePassBalance, alreadyGranted: true };
    if (!mission.canClaim) throw new MessagePassError('알람 등록 조건을 먼저 달성해 주세요.', 409);
    await tx.messagePassEntry.create({ data: { userId: user.id, delta: mission.quantity, reason: 'alarm_reward', reference: alarmRewardReference(user, missionId) } });
    await tx.user.update({ where: { id: user.id }, data: { messagePassBalance: { increment: mission.quantity } } });
    return { ...status, rewards: status.rewards.map(item => item.id === missionId ? { ...item, claimed: true, canClaim: false } : item), balance: wallet.messagePassBalance + mission.quantity, alreadyGranted: false };
  });
}

export async function grantMessagePasses(db, user, orderId, verifyOrder = verifyTossPassOrder) {
  if (typeof orderId !== 'string' || !/^[\w-]{8,100}$/.test(orderId)) throw new MessagePassError('주문 정보를 확인해 주세요.');
  const order = await verifyOrder(orderId, user.tossUserId);
  const product = passProducts().find(p => p.sku && p.sku === order.sku);
  if (!product) throw new MessagePassError('열람권 상품이 아니에요.');
  return db.$transaction(async tx => {
    await lockWallet(tx, user.id);
    const existing = await tx.messagePassOrder.findUnique({ where: { orderId } });
    if (existing && existing.userId !== user.id) throw new MessagePassError('다른 계정의 주문이에요.', 403);
    if (!existing) {
      await tx.messagePassOrder.create({ data: { orderId, userId: user.id, sku: product.sku, quantity: product.quantity, remaining: product.quantity, amount: product.amount } });
      await tx.user.update({ where: { id: user.id }, data: { messagePassBalance: { increment: product.quantity } } });
      await tx.messagePassEntry.create({ data: { userId: user.id, delta: product.quantity, reason: 'purchase', reference: `purchase:${orderId}` } });
    }
    const wallet = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
    return { balance: wallet.messagePassBalance, alreadyGranted: !!existing };
  });
}

export async function openReceivedMessage(db, userId, messageId, verifyOrder = verifyTossPassOrder) {
  return db.$transaction(async tx => {
    const wallet = await lockWallet(tx, userId);
    const recipient = await verifiedRecipient(tx, userId);
    const message = await tx.messageDelivery.findUnique({ where: { id: messageId }, include: { reaction: true } });
    if (!message) throw new MessagePassError('메시지를 찾을 수 없어요.', 404);
    const key = { userId_messageId: { userId, messageId } };
    const unlocked = await tx.messageUnlock.findUnique({ where: key });
    if (message.targetInstagramId !== recipient && !unlocked) throw new MessagePassError('메시지를 찾을 수 없어요.', 404);
    const reported = await tx.messageReport.findUnique({ where: key });
    if (reported) throw new MessagePassError('신고하여 숨긴 메시지예요.', 404);
    if (message.deletedAt && !unlocked) throw new MessagePassError('삭제된 메시지예요. 열람권은 사용하지 않았어요.', 410);
    const charged = !unlocked && message.requiresPass;
    if (charged && wallet.messagePassBalance < 1) throw new MessagePassError('열람권이 필요해요.', 402, 'PASS_REQUIRED');
    let order;
    if (charged) {
      const rewards = await tx.messagePassEntry.aggregate({ where: { userId, reason: { in: ['instagram_reward', 'checkin_reward', 'alarm_reward', 'open_reward', 'report_restore_reward'] } }, _sum: { delta: true } });
      if ((rewards._sum.delta || 0) < 1) {
        order = await tx.messagePassOrder.findFirst({ where: { userId, remaining: { gt: 0 }, refundedAt: null }, orderBy: { createdAt: 'asc' } });
        if (!order) throw new MessagePassError('구매 내역을 다시 확인해 주세요.', 409);
        // A refunded purchase must not unlock content, even when the client skips restoration.
        const checked = await verifyOrder(order.orderId, wallet.tossUserId);
        if (checked.sku !== order.sku) throw new MessagePassError('구매 상품을 확인할 수 없어요.', 409);
      }
    }
    if (!unlocked) {
      await tx.messageUnlock.create({ data: { userId, messageId, charged, orderId: order?.orderId } });
      if (charged) {
        if (order) await tx.messagePassOrder.update({ where: { orderId: order.orderId }, data: { remaining: { decrement: 1 } } });
        await tx.user.update({ where: { id: userId }, data: { messagePassBalance: { decrement: 1 } } });
        await tx.messagePassEntry.create({ data: { userId, delta: -1, reason: order ? 'open' : 'open_reward', reference: `open:${userId}:${messageId}` } });
      }
    }
    return { message: receivedMessage(message, true), balance: wallet.messagePassBalance - Number(charged) };
  }, { timeout: 20000 });
}

export async function resolveMessageReport(db, reportId, uphold) {
  const report = await db.messageReport.findUnique({ where: { id: reportId } });
  if (!report) throw new MessagePassError('신고를 찾을 수 없어요.', 404);
  return db.$transaction(async tx => {
    await lockWallet(tx, report.userId);
    const current = await tx.messageReport.findUnique({ where: { id: reportId } });
    if (current.status !== 'pending') return current;
    const unlock = await tx.messageUnlock.findUnique({ where: { userId_messageId: { userId: current.userId, messageId: current.messageId } } });
    const order = unlock?.orderId ? await tx.messagePassOrder.findUnique({ where: { orderId: unlock.orderId } }) : null;
    const restore = uphold && unlock?.charged && (!unlock.orderId || (order && !order.refundedAt));
    if (restore) {
      if (order) await tx.messagePassOrder.update({ where: { orderId: order.orderId }, data: { remaining: { increment: 1 } } });
      await tx.user.update({ where: { id: current.userId }, data: { messagePassBalance: { increment: 1 } } });
      await tx.messagePassEntry.create({ data: { userId: current.userId, delta: 1, reason: order ? 'report_restore' : 'report_restore_reward', reference: `report:${reportId}` } });
    }
    return tx.messageReport.update({ where: { id: reportId }, data: { status: uphold ? 'upheld' : 'rejected', restoredAt: restore ? new Date() : null } });
  });
}

export async function syncMessagePassRefund(db, user, orderId, verifyOrder = verifyTossPassOrder) {
  const stored = await db.messagePassOrder.findUnique({ where: { orderId } });
  if (!stored || stored.userId !== user.id) throw new MessagePassError('구매 내역을 찾을 수 없어요.', 404);
  if (stored.refundedAt) return { refunded: true };
  const checked = await verifyOrder(orderId, user.tossUserId, { allowRefunded: true });
  if (checked.sku !== stored.sku) throw new MessagePassError('구매 상품을 확인할 수 없어요.', 409);
  if (checked.status !== 'REFUNDED') return { refunded: false };
  return db.$transaction(async tx => {
    await lockWallet(tx, user.id);
    const order = await tx.messagePassOrder.findUnique({ where: { orderId } });
    if (order.refundedAt) return { refunded: true };
    await tx.user.update({ where: { id: user.id }, data: { messagePassBalance: { decrement: order.remaining } } });
    await tx.messagePassOrder.update({ where: { orderId }, data: { remaining: 0, refundedAt: new Date() } });
    await tx.messagePassEntry.create({ data: { userId: user.id, delta: -order.remaining, reason: 'refund', reference: `refund:${orderId}` } });
    return { refunded: true };
  });
}
