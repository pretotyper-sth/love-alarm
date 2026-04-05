import { Router } from 'express';
import { normalizeInstagramUsername } from '../utils/instagramUsername.js';

const router = Router();

const SESSION_TTL_MS = 10 * 60 * 1000;

/**
 * POST /api/verify/instagram/start
 * Body: { tossUserId: string, instagramUsername: string }
 */
router.post('/start', async (req, res) => {
  try {
    const { tossUserId, instagramUsername } = req.body || {};

    if (!tossUserId || !instagramUsername) {
      return res.status(400).json({ error: 'tossUserId와 instagramUsername이 필요합니다.' });
    }

    const normalized = normalizeInstagramUsername(instagramUsername);
    if (!normalized) {
      return res.status(400).json({ error: 'instagramUsername이 올바르지 않습니다.' });
    }

    const user = await req.prisma.user.findUnique({
      where: { tossUserId: String(tossUserId) },
    });

    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다. 먼저 로그인해 주세요.' });
    }

    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await req.prisma.verificationSession.updateMany({
      where: {
        userId: user.id,
        instagramUsername: normalized,
        status: 'pending',
      },
      data: { status: 'expired' },
    });

    const session = await req.prisma.verificationSession.create({
      data: {
        userId: user.id,
        instagramUsername: normalized,
        status: 'pending',
        expiresAt,
      },
    });

    res.json({
      sessionId: session.id,
      expiresAt: session.expiresAt.toISOString(),
      instagramUsername: normalized,
    });
  } catch (error) {
    console.error('[verify/instagram/start]', error);
    res.status(500).json({ error: '세션을 만들 수 없습니다.' });
  }
});

/**
 * POST /api/verify/instagram/confirm
 * Body: { tossUserId: string, sessionId: string, code: string }
 */
router.post('/confirm', async (req, res) => {
  try {
    const { tossUserId, sessionId, code } = req.body || {};

    if (!tossUserId || !sessionId || !code) {
      return res.status(400).json({ error: 'tossUserId, sessionId, code가 필요합니다.' });
    }

    const codeStr = String(code).trim();
    if (!/^\d{6}$/.test(codeStr)) {
      return res.status(400).json({ error: '인증번호는 6자리 숫자여야 합니다.' });
    }

    const user = await req.prisma.user.findUnique({
      where: { tossUserId: String(tossUserId) },
    });

    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    const session = await req.prisma.verificationSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
    });

    if (!session) {
      return res.status(404).json({ error: '인증 세션을 찾을 수 없습니다.' });
    }

    if (session.status === 'verified') {
      return res.json({ ok: true, alreadyVerified: true, instagramUserId: session.igUserId });
    }

    if (session.status !== 'code_sent') {
      return res.status(400).json({ error: '아직 인증번호가 발송되지 않았거나 만료되었습니다.' });
    }

    if (session.expiresAt < new Date()) {
      await req.prisma.verificationSession.update({
        where: { id: session.id },
        data: { status: 'expired' },
      });
      return res.status(400).json({ error: '인증 시간이 만료되었습니다. 다시 시작해 주세요.' });
    }

    if (session.code !== codeStr) {
      return res.status(400).json({ error: '인증번호가 일치하지 않습니다.' });
    }

    if (!session.igUserId) {
      return res.status(500).json({ error: '세션에 Instagram ID가 없습니다.' });
    }

    await req.prisma.$transaction([
      req.prisma.verificationSession.update({
        where: { id: session.id },
        data: { status: 'verified' },
      }),
      req.prisma.user.update({
        where: { id: user.id },
        data: { instagramId: session.instagramUsername },
      }),
    ]);

    res.json({
      ok: true,
      instagramUserId: session.igUserId,
      instagramUsername: session.instagramUsername,
    });
  } catch (error) {
    console.error('[verify/instagram/confirm]', error);
    res.status(500).json({ error: '인증 확인 중 오류가 발생했습니다.' });
  }
});

export default router;
