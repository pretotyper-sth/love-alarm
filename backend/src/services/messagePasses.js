import fetch from 'node-fetch';
import { getHttpsAgent } from './tossAuth.js';

export class MessagePassError extends Error {
  constructor(message, status = 400, code = 'MESSAGE_PASS_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function passProducts(env = process.env) {
  return [
    { id: 'single', name: '메시지 열람권 1장', quantity: 1, amount: 1100, sku: env.TOSS_MESSAGE_PASS_SINGLE_SKU || null },
    { id: 'bundle', name: '메시지 열람권 5장', quantity: 5, amount: 4400, sku: env.TOSS_MESSAGE_PASS_BUNDLE_SKU || null },
  ];
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
    id: message.id, createdAt: message.createdAt, locked,
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
    throw new MessagePassError('결제를 확인하지 못했어요. 구매 복원을 눌러 주세요.', 503);
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
      order = await tx.messagePassOrder.findFirst({ where: { userId, remaining: { gt: 0 }, refundedAt: null }, orderBy: { createdAt: 'asc' } });
      if (!order) throw new MessagePassError('구매 내역을 다시 확인해 주세요.', 409);
      // A refunded purchase must not unlock content, even when the client skips restoration.
      const checked = await verifyOrder(order.orderId, wallet.tossUserId);
      if (checked.sku !== order.sku) throw new MessagePassError('구매 상품을 확인할 수 없어요.', 409);
    }
    if (!unlocked) {
      await tx.messageUnlock.create({ data: { userId, messageId, charged, orderId: order?.orderId } });
      if (charged) {
        await tx.messagePassOrder.update({ where: { orderId: order.orderId }, data: { remaining: { decrement: 1 } } });
        await tx.user.update({ where: { id: userId }, data: { messagePassBalance: { decrement: 1 } } });
        await tx.messagePassEntry.create({ data: { userId, delta: -1, reason: 'open', reference: `open:${userId}:${messageId}` } });
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
    const restore = uphold && unlock?.charged && order && !order.refundedAt;
    if (restore) {
      await tx.messagePassOrder.update({ where: { orderId: order.orderId }, data: { remaining: { increment: 1 } } });
      await tx.user.update({ where: { id: current.userId }, data: { messagePassBalance: { increment: 1 } } });
      await tx.messagePassEntry.create({ data: { userId: current.userId, delta: 1, reason: 'report_restore', reference: `report:${reportId}` } });
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
