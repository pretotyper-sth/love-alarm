import { Router } from 'express';
import { checkMatching } from '../services/matching.js';

const router = Router();

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

    const alarms = await req.prisma.alarm.findMany({
      where: { userId },
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
 * 
 * Body: { userId: string, targetInstagramId: string }
 */
router.post('/', async (req, res) => {
  try {
    const { userId, targetInstagramId } = req.body;

    if (!userId || !targetInstagramId) {
      return res.status(400).json({ error: 'userId와 targetInstagramId가 필요합니다.' });
    }

    // 현재 사용자 확인
    const user = await req.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    // 자기 자신에게 알람 등록 방지
    if (user.instagramId === targetInstagramId) {
      return res.status(400).json({ error: '자기 자신에게는 알람을 등록할 수 없습니다.' });
    }

    // 이미 같은 대상에게 알람이 있는지 확인
    const existingAlarm = await req.prisma.alarm.findUnique({
      where: {
        userId_targetInstagramId: { userId, targetInstagramId },
      },
    });

    if (existingAlarm) {
      return res.status(409).json({ error: '이미 등록된 알람입니다.' });
    }

    // 알람 생성
    const alarm = await req.prisma.alarm.create({
      data: { userId, targetInstagramId },
    });

    // 매칭 확인
    const matchResult = await checkMatching(req.prisma, user, targetInstagramId);

    // 🔌 WebSocket: 매칭 성공 시 상대방에게 실시간 알림
    if (matchResult.matched && matchResult.targetUserId) {
      const targetSocketId = req.userSockets.get(matchResult.targetUserId);
      if (targetSocketId) {
        req.io.to(targetSocketId).emit('matched', {
          message: '매칭 성공! 🎉',
          matchedWith: user.instagramId,
        });
        console.log(`🔔 매칭 알림 전송: ${matchResult.targetUserId}`);
      }
    }

    res.status(201).json({ 
      alarm, 
      matched: matchResult.matched,
      match: matchResult.match,
    });
  } catch (error) {
    console.error('Create alarm error:', error);
    res.status(500).json({ error: '알람 생성 중 오류가 발생했습니다.' });
  }
});

/**
 * DELETE /api/alarms/:id
 * 알람 삭제
 * - 매칭된 상태였다면 상대방 알람도 'waiting'으로 초기화
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 1. 삭제할 알람 조회
    const alarmToDelete = await req.prisma.alarm.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!alarmToDelete) {
      return res.status(404).json({ error: '알람을 찾을 수 없습니다.' });
    }

    // 2. 매칭 상태였다면 상대방 알람도 초기화
    if (alarmToDelete.status === 'matched' && alarmToDelete.user.instagramId) {
      // 상대방 찾기
      const targetUser = await req.prisma.user.findFirst({
        where: { instagramId: alarmToDelete.targetInstagramId },
      });

      if (targetUser) {
        // 상대방의 알람 상태를 'waiting'으로 변경
        await req.prisma.alarm.updateMany({
          where: {
            userId: targetUser.id,
            targetInstagramId: alarmToDelete.user.instagramId,
          },
          data: { status: 'waiting' },
        });

        // 관련 Match 삭제
        await req.prisma.match.deleteMany({
          where: {
            OR: [
              { user1Id: alarmToDelete.userId, user2Id: targetUser.id },
              { user1Id: targetUser.id, user2Id: alarmToDelete.userId },
            ],
          },
        });

        // 🔌 WebSocket: 상대방에게 매칭 해제 실시간 알림
        const targetSocketId = req.userSockets.get(targetUser.id);
        if (targetSocketId) {
          req.io.to(targetSocketId).emit('matchCanceled', {
            message: '매칭이 해제되었습니다',
            canceledBy: alarmToDelete.user.instagramId,
          });
          console.log(`🔔 매칭 해제 알림 전송: ${targetUser.id}`);
        }
      }
    }

    // 3. 알람 삭제
    await req.prisma.alarm.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete alarm error:', error);
    res.status(500).json({ error: '알람 삭제 중 오류가 발생했습니다.' });
  }
});

export default router;

