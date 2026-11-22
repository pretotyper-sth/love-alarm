import { Router } from 'express';
import { requireSession } from '../middleware/session.js';
import { messagePassSalesEnabled, lockWallet } from '../services/messagePasses.js';
import { checkMatching } from '../services/matching.js';
import { notifyConnectionSuccess, sendMessageReceivedNotification } from '../services/pushNotification.js';

const router = Router();
router.use((req, res, next) => {
  if (req.method === 'GET' && req.path === '/count') return next();
  return requireSession(req, res, next);
});
router.use((req, res, next) => {
  const claimedIds = [req.query.userId, req.body?.userId];
  if (claimedIds.some(id => id && id !== req.user?.id)) return res.status(403).json({ error: '본인 알람만 확인할 수 있어요.' });
  next();
});

/**
 * GET /api/alarms?userId=xxx
 * 사용자의 알람 목록 조회
 */
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId가 필요합니다.' });
    }

    // Soft Delete: deletedAt이 null인 것만 조회
    const alarms = await req.prisma.alarm.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ alarms });
  } catch (error) {
    console.error('Get alarms error:', error);
    res.status(500).json({ error: '알람 조회 중 오류가 발생했습니다.' });
  }
});

/**
 * POST /api/alarms
 * 새 알람 생성 (좋아하는 사람 등록)
 */
router.post('/', async (req, res) => {
  try {
    const { userId, fromInstagramId } = req.body;
    const targetInstagramId = typeof req.body.targetInstagramId === 'string' ? req.body.targetInstagramId.trim().toLowerCase() : '';
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : null;
    if (message && message.length > 1000) return res.status(400).json({ error: '메시지는 1,000자 이내로 작성해 주세요.' });

    if (!userId || !fromInstagramId || !targetInstagramId) {
      return res.status(400).json({ error: 'userId, fromInstagramId, targetInstagramId가 필요합니다.' });
    }

    const user = await req.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    if (fromInstagramId === targetInstagramId) {
      return res.status(400).json({ error: '자기 자신에게는 알람을 등록할 수 없습니다.' });
    }

    const alarm = await req.prisma.$transaction(async tx => {
      // Serialize retries so one send cannot create two separately payable deliveries.
      await lockWallet(tx, userId);
      const existingAlarm = await tx.alarm.findUnique({ where: { userId_targetInstagramId: { userId, targetInstagramId } } });
      let alarm;

      if (existingAlarm) {
        if (existingAlarm.deletedAt) {
          // Soft-deleted 상태 → 복구
          alarm = await tx.alarm.update({
            where: { id: existingAlarm.id },
            data: {
              deletedAt: null,
              fromInstagramId,
              status: 'waiting',
              message: message ?? null,
              updatedAt: new Date(),
            },
          });
        } else {
          throw Object.assign(new Error('이미 등록된 알람입니다.'), { status: 409 });
        }
      } else {
        alarm = await tx.alarm.create({
          data: { userId, fromInstagramId, targetInstagramId, message: message ?? null },
        });
      }

      if (typeof alarm.message === 'string' && alarm.message.trim()) {
        await tx.messageDelivery.create({ data: {
          alarmId: alarm.id, targetInstagramId: targetInstagramId.trim().toLowerCase(),
          message: alarm.message, requiresPass: messagePassSalesEnabled(),
        } });
      }
      return alarm;
    });

    const matchResult = await checkMatching(req.prisma, user, fromInstagramId, targetInstagramId);

    if (matchResult.matched && matchResult.targetUserId) {
      // WebSocket 알림 (실시간)
      const targetSocketId = req.userSockets.get(matchResult.targetUserId);
      if (targetSocketId) {
        req.io.to(targetSocketId).emit('matched', {
          message: '매칭 성공! 🎉',
          matchedWith: user.instagramId,
        });
      }

      // 푸시 알림 발송 (새 매칭인 경우에만)
      if (matchResult.reason === 'new_match' && matchResult.targetUser) {
        // 비동기로 푸시 발송 (응답 지연 방지)
        notifyConnectionSuccess(user, matchResult.targetUser).catch(() => {});
      }
    }

    // 메시지가 포함된 알람이면 대상 유저에게 메시지 수신 알림 발송
    if (alarm.message) {
      req.prisma.user.findMany({
        where: { instagramId: targetInstagramId.toLowerCase() },
      }).then(targetUsers => {
        for (const tu of targetUsers) {
          sendMessageReceivedNotification(tu).catch(() => {});
        }
      }).catch(() => {});
    }

    res.status(201).json({
      alarm,
      matched: matchResult.matched,
      match: matchResult.match,
    });
  } catch (error) {
    if (!error.status) console.error('Create alarm error:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : '알람 생성 중 오류가 발생했습니다.' });
  }
});

/**
 * DELETE /api/alarms/:id
 * 알람 Soft Delete
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const alarmToDelete = await req.prisma.alarm.findFirst({
      where: {
        id,
        userId: req.user.id,
        deletedAt: null,
      },
      include: { user: true },
    });

    if (!alarmToDelete) {
      return res.status(404).json({ error: '알람을 찾을 수 없습니다.' });
    }

    if (alarmToDelete.status === 'matched' && alarmToDelete.fromInstagramId) {
      const reverseAlarm = await req.prisma.alarm.findFirst({
        where: {
          fromInstagramId: alarmToDelete.targetInstagramId,
          targetInstagramId: alarmToDelete.fromInstagramId,
          deletedAt: null,
        },
        include: { user: true },
      });

      if (reverseAlarm) {
        await req.prisma.alarm.update({
          where: { id: reverseAlarm.id },
          data: { status: 'waiting' },
        });

        await req.prisma.match.deleteMany({
          where: {
            OR: [
              { user1Id: alarmToDelete.userId, user2Id: reverseAlarm.userId },
              { user1Id: reverseAlarm.userId, user2Id: alarmToDelete.userId },
            ],
          },
        });

        const targetSocketId = req.userSockets.get(reverseAlarm.userId);
        if (targetSocketId) {
          req.io.to(targetSocketId).emit('matchCanceled', {
            message: '매칭이 해제되었습니다',
            canceledBy: alarmToDelete.fromInstagramId,
          });
        }
      }
    }

    // Soft Delete
    await req.prisma.$transaction([
      req.prisma.alarm.update({ where: { id }, data: { deletedAt: new Date() } }),
      req.prisma.messageDelivery.updateMany({ where: { alarmId: id, deletedAt: null }, data: { deletedAt: new Date() } }),
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete alarm error:', error);
    res.status(500).json({ error: '알람 삭제 중 오류가 발생했습니다.' });
  }
});

/**
 * GET /api/alarms/count?instagram_id=xxx
 * 특정 인스타그램 ID를 타겟으로 등록한 살아있는 알람 수 조회 (인증 불필요)
 */
router.get('/count', async (req, res) => {
  try {
    const { instagram_id } = req.query;

    if (!instagram_id) {
      return res.status(400).json({ error: 'instagram_id가 필요합니다.' });
    }

    const count = await req.prisma.alarm.count({
      where: {
        targetInstagramId: instagram_id.trim().toLowerCase(),
        deletedAt: null,
      },
    });

    res.json({ count });
  } catch (error) {
    console.error('Like count error:', error);
    res.status(500).json({ error: '조회 중 오류가 발생했습니다.' });
  }
});

export default router;
