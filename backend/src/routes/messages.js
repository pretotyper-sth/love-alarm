import express from 'express';
const router = express.Router();

// ==================== GET /api/messages/sent ====================
// 내가 보낸 메세지 목록 (userId 기반, 인증 불필요)
// 메세지가 있는 알람만 반환
router.get('/sent', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId가 필요합니다.' });
    }

    const messages = await req.prisma.alarm.findMany({
      where: {
        userId,
        message: { not: null },
        deletedAt: null,
      },
      include: {
        reactions: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ messages });
  } catch (error) {
    console.error('보낸 메세지 조회 실패:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ==================== GET /api/messages/received ====================
// 받은 메세지 목록 (인증된 instagramId 기반)
router.get('/received', async (req, res) => {
  try {
    const { instagram_id } = req.query;
    if (!instagram_id) {
      return res.status(400).json({ error: 'instagram_id가 필요합니다.' });
    }

    const normalizedId = instagram_id.trim().toLowerCase();

    const messages = await req.prisma.alarm.findMany({
      where: {
        targetInstagramId: normalizedId,
        message: { not: null },
        deletedAt: null,
      },
      include: {
        reactions: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ messages });
  } catch (error) {
    console.error('받은 메세지 조회 실패:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ==================== POST /api/messages/:alarmId/reaction ====================
// 받은 메세지에 이모지 반응 (upsert)
router.post('/:alarmId/reaction', async (req, res) => {
  try {
    const { alarmId } = req.params;
    const { emoji } = req.body;

    const ALLOWED_EMOJIS = ['❤️', '😊', '🤔', '😳', '🥹'];
    if (!emoji || !ALLOWED_EMOJIS.includes(emoji)) {
      return res.status(400).json({ error: '유효하지 않은 이모지입니다.' });
    }

    // 알람 존재 확인
    const alarm = await req.prisma.alarm.findUnique({
      where: { id: alarmId },
    });
    if (!alarm) {
      return res.status(404).json({ error: '메세지를 찾을 수 없습니다.' });
    }

    // upsert: 이미 반응이 있으면 업데이트, 없으면 생성
    const reaction = await req.prisma.messageReaction.upsert({
      where: { alarmId },
      update: { emoji, updatedAt: new Date() },
      create: { alarmId, emoji },
    });

    return res.json({ reaction });
  } catch (error) {
    console.error('반응 저장 실패:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

export default router;
