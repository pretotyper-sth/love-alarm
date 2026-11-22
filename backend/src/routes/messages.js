import express from 'express';
import { requireSession, requireAdmin } from '../middleware/session.js';
import { verifiedRecipient, receivedMessage, openReceivedMessage, resolveMessageReport, MessagePassError } from '../services/messagePasses.js';

const reasons = ['불쾌하거나 과도하게 성적인 내용', '욕설, 혐오, 위협이 느껴져요', '스팸 또는 광고 같아요', '원치 않는 연락이라 불편해요'];

export function createMessageRouter({ verifyOrder } = {}) {
  const router = express.Router();

  router.post('/reports/:id/resolve', requireAdmin, async (req, res, next) => {
    try {
      if (typeof req.body.uphold !== 'boolean') throw new MessagePassError('신고 인정 여부가 필요합니다.');
      res.json({ report: await resolveMessageReport(req.prisma, req.params.id, req.body.uphold) });
    } catch (error) { next(error); }
  });
  router.get('/reports', requireAdmin, async (req, res, next) => {
    try {
      res.json({ reports: await req.prisma.messageReport.findMany({ where: { status: 'pending' }, include: { message: true }, orderBy: { createdAt: 'asc' }, take: 100 }) });
    } catch (error) { next(error); }
  });
  router.use(requireSession);
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  router.get('/sent', async (req, res, next) => {
    try {
      if (req.query.userId && req.query.userId !== req.user.id) return res.status(403).json({ error: '다른 계정의 메시지는 볼 수 없어요.' });
      const alarms = await req.prisma.alarm.findMany({
        where: { userId: req.user.id, message: { not: null }, deletedAt: null },
        include: { deliveries: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 1, include: { reaction: true } } },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ messages: alarms.map(alarm => ({ id: alarm.id, targetInstagramId: alarm.targetInstagramId, message: alarm.message, createdAt: alarm.createdAt, reactions: alarm.deliveries[0]?.reaction ? [{ emoji: alarm.deliveries[0].reaction.emoji }] : [] })) });
    } catch (error) { next(error); }
  });
  router.get('/received', async (req, res, next) => {
    try {
      const recipient = await verifiedRecipient(req.prisma, req.user.id);
      const messages = await req.prisma.messageDelivery.findMany({
        where: { OR: [{ targetInstagramId: recipient, deletedAt: null }, { unlocks: { some: { userId: req.user.id } } }], reports: { none: { userId: req.user.id } } },
        include: { reaction: true, unlocks: { where: { userId: req.user.id }, select: { id: true } } },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ instagramId: recipient, messages: messages.map(message => receivedMessage(message, message.unlocks.length > 0)) });
    } catch (error) { next(error); }
  });
  router.post('/:messageId/open', async (req, res, next) => {
    try { res.json(await openReceivedMessage(req.prisma, req.user.id, req.params.messageId, verifyOrder)); }
    catch (error) { next(error); }
  });
  router.post('/:messageId/reaction', async (req, res, next) => {
    try {
      if (!['❤️', '😊', '🤔', '😳', '🥹'].includes(req.body.emoji)) throw new MessagePassError('유효하지 않은 이모지예요.');
      const recipient = await verifiedRecipient(req.prisma, req.user.id);
      const message = await req.prisma.messageDelivery.findUnique({ where: { id: req.params.messageId }, include: { unlocks: { where: { userId: req.user.id } } } });
      if (!message || (message.targetInstagramId !== recipient && !message.unlocks.length)) throw new MessagePassError('메시지를 찾을 수 없어요.', 404);
      if (!message.unlocks.length) throw new MessagePassError('메시지를 먼저 열어 주세요.', 403);
      // The unique messageId makes concurrent retries harmless; never overwrite the first choice.
      await req.prisma.messageReaction.createMany({ data: [{ messageId: message.id, emoji: req.body.emoji }], skipDuplicates: true });
      const reaction = await req.prisma.messageReaction.findUniqueOrThrow({ where: { messageId: message.id } });
      res.json({ reaction: { emoji: reaction.emoji } });
    } catch (error) { next(error); }
  });
  router.post('/:messageId/report', async (req, res, next) => {
    try {
      if (!reasons.includes(req.body.reason)) throw new MessagePassError('신고 사유를 선택해 주세요.');
      const recipient = await verifiedRecipient(req.prisma, req.user.id);
      const message = await req.prisma.messageDelivery.findUnique({ where: { id: req.params.messageId }, include: { unlocks: { where: { userId: req.user.id } } } });
      if (!message || (message.targetInstagramId !== recipient && !message.unlocks.length)) throw new MessagePassError('메시지를 찾을 수 없어요.', 404);
      const report = await req.prisma.messageReport.upsert({
        where: { userId_messageId: { userId: req.user.id, messageId: message.id } }, update: {},
        create: { userId: req.user.id, messageId: message.id, reason: req.body.reason },
      });
      res.status(201).json({ success: true, reportId: report.id });
    } catch (error) { next(error); }
  });
  return router;
}
export default createMessageRouter();
