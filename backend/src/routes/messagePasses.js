import { Router } from 'express';
import { requireSession } from '../middleware/session.js';
import { grantMessagePasses, messagePassSalesEnabled, passProducts, syncMessagePassRefund, instagramRewardStatus, claimInstagramReward } from '../services/messagePasses.js';

export function createMessagePassRouter({ verifyOrder } = {}) {
  const router = Router();
  router.use(requireSession);
  router.get('/instagram-reward', async (req, res, next) => {
    try { res.json(await instagramRewardStatus(req.prisma, req.user)); } catch (error) { next(error); }
  });
  router.post('/instagram-reward', async (req, res, next) => {
    try { res.json(await claimInstagramReward(req.prisma, req.user)); } catch (error) { next(error); }
  });
  router.get('/', async (req, res, next) => {
    try {
      const [entries, user] = await Promise.all([
        req.prisma.messagePassEntry.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
        req.prisma.user.findUniqueOrThrow({ where: { id: req.user.id } }),
      ]);
      res.json({ balance: user.messagePassBalance, enabled: messagePassSalesEnabled(), products: passProducts(), entries });
    } catch (error) { next(error); }
  });
  router.post('/grant', async (req, res, next) => {
    try {
      // Recovery remains available when new sales have been disabled.
      res.json(await grantMessagePasses(req.prisma, req.user, req.body.orderId, verifyOrder));
    } catch (error) { next(error); }
  });
  router.post('/refund-status', async (req, res, next) => {
    try {
      if (typeof req.body.orderId !== 'string') return res.status(400).json({ error: '주문 정보가 필요해요.' });
      res.json(await syncMessagePassRefund(req.prisma, req.user, req.body.orderId, verifyOrder));
    } catch (error) { next(error); }
  });
  return router;
}
export default createMessagePassRouter();
