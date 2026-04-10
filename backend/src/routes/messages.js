import express from 'express';
const router = express.Router();

// ==================== GET /api/messages/sent ====================
// 내가 보낸 메시지 목록 (userId 기반, 인증 불필요)
// 메시지가 있는 알람만 반환
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
    console.error('보낸 메시지 조회 실패:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ==================== GET /api/messages/received ====================
// 받은 메시지 목록 (인증된 instagramId 기반)
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
    console.error('받은 메시지 조회 실패:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ==================== POST /api/messages/:alarmId/reaction ====================
// 받은 메시지에 이모지 반응 (upsert)
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
      return res.status(404).json({ error: '메시지를 찾을 수 없습니다.' });
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

// ==================== POST /api/messages/:alarmId/report ====================
// 받은 메시지 신고
router.post('/:alarmId/report', async (req, res) => {
  try {
    const { alarmId } = req.params;
    const { reason, userId, instagramId } = req.body;

    const ALLOWED_REASONS = [
      '불쾌하거나 과도하게 성적인 내용',
      '욕설, 혐오, 위협이 느껴져요',
      '스팸 또는 광고 같아요',
      '원치 않는 연락이라 불편해요',
    ];

    if (!reason || !ALLOWED_REASONS.includes(reason)) {
      return res.status(400).json({ error: '유효한 신고 사유를 선택해 주세요.' });
    }

    const alarm = await req.prisma.alarm.findUnique({
      where: { id: alarmId },
      include: { user: true },
    });

    if (!alarm || !alarm.message || alarm.deletedAt) {
      return res.status(404).json({ error: '신고할 메시지를 찾을 수 없습니다.' });
    }

    if (instagramId) {
      const normalizedInstagramId = instagramId.trim().toLowerCase();
      if (normalizedInstagramId !== alarm.targetInstagramId) {
        return res.status(403).json({ error: '이 메시지를 신고할 권한이 없습니다.' });
      }
    }

    const feedback = await req.prisma.feedback.create({
      data: {
        category: '신고',
        userId: userId || null,
        content: [
          '[받은 메시지 신고]',
          `alarmId: ${alarm.id}`,
          `reason: ${reason}`,
          `reportedInstagramId: ${alarm.targetInstagramId}`,
          `senderInstagramId: ${alarm.fromInstagramId}`,
          `message: ${alarm.message}`,
        ].join('\n'),
      },
    });

    return res.status(201).json({
      success: true,
      message: '신고가 접수되었습니다.',
      reportId: feedback.id,
    });
  } catch (error) {
    console.error('메시지 신고 실패:', error);
    return res.status(500).json({ error: '신고 접수에 실패했습니다.' });
  }
});

export default router;
