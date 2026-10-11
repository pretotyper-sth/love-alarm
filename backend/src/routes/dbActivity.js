import { Router } from 'express';
import { recordDbActivity } from '../services/dbActivity.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const result = await recordDbActivity(req.prisma);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[db-activity]', err);
    res.status(500).json({ ok: false });
  }
});

export default router;
