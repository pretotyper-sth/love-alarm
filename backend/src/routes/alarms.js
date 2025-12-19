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

    // Soft Delete: deletedAt이 null인 것만 조회
    const alarms = await req.prisma.alarm.findMany({
      where: { 
        userId,
        deletedAt: null,  // 👈 삭제되지 않은 알람만
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
 * 
 * Body: { userId: string, fromInstagramId: string, targetInstagramId: string }
 */
router.post('/', async (req, res) => {
  try {
    const { userId, fromInstagramId, targetInstagramId } = req.body;

    if (!userId || !fromInstagramId || !targetInstagramId) {
      return res.status(400).json({ error: 'userId, fromInstagramId, targetInstagramId가 필요합니다.' });
    }

    // 현재 사용자 확인
    const user = await req.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    // 자기 자신에게 알람 등록 방지
    if (fromInstagramId === targetInstagramId) {
      return res.status(400).json({ error: '자기 자신에게는 알람을 등록할 수 없습니다.' });
    }

    // Soft Delete: 기존 알람 확인 (삭제된 것 포함)
    const existingAlarm = await req.prisma.alarm.findUnique({
      where: {
        userId_targetInstagramId: { userId, targetInstagramId },
      },
    });

    let alarm;

    if (existingAlarm) {
      if (existingAlarm.deletedAt) {
        // 👉 Soft-deleted 상태 → 복구!
        alarm = await req.prisma.alarm.update({
          where: { id: existingAlarm.id },
          data: { 
            deletedAt: null, 
            fromInstagramId,
            status: 'waiting',  // 상태 초기화
            updatedAt: new Date(),
          },
        });
        console.log(`♻️ 알람 복구: ${alarm.id}`);
      } else {
        // 👉 이미 활성 알람 있음 → 에러
        return res.status(409).json({ error: '이미 등록된 알람입니다.' });
      }
    } else {
      // 👉 신규 생성
      alarm = await req.prisma.alarm.create({
        data: { userId, fromInstagramId, targetInstagramId },
      });
    }

    // 매칭 확인 (fromInstagramId 기반)
    const matchResult = await checkMatching(req.prisma, user, fromInstagramId, targetInstagramId);

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

    // 1. 삭제할 알람 조회 (이미 삭제된 것 제외)
    const alarmToDelete = await req.prisma.alarm.findFirst({
      where: { 
        id,
        deletedAt: null,  // 👈 활성 알람만
      },
      include: { user: true },
    });

    if (!alarmToDelete) {
      return res.status(404).json({ error: '알람을 찾을 수 없습니다.' });
    }

    // 2. 매칭 상태였다면 상대방 알람도 초기화
    if (alarmToDelete.status === 'matched' && alarmToDelete.fromInstagramId) {
      // 상대방의 알람 찾기 (fromInstagramId 기반, 활성 알람만)
      const reverseAlarm = await req.prisma.alarm.findFirst({
        where: {
          fromInstagramId: alarmToDelete.targetInstagramId,
          targetInstagramId: alarmToDelete.fromInstagramId,
          deletedAt: null,  // 👈 활성 알람만
        },
        include: { user: true },
      });

      if (reverseAlarm) {
        // 상대방의 알람 상태를 'waiting'으로 변경
        await req.prisma.alarm.update({
          where: { id: reverseAlarm.id },
          data: { status: 'waiting' },
        });

        // 관련 Match 삭제
        await req.prisma.match.deleteMany({
          where: {
            OR: [
              { user1Id: alarmToDelete.userId, user2Id: reverseAlarm.userId },
              { user1Id: reverseAlarm.userId, user2Id: alarmToDelete.userId },
            ],
          },
        });

        // 🔌 WebSocket: 상대방에게 매칭 해제 실시간 알림
        const targetSocketId = req.userSockets.get(reverseAlarm.userId);
        if (targetSocketId) {
          req.io.to(targetSocketId).emit('matchCanceled', {
            message: '매칭이 해제되었습니다',
            canceledBy: alarmToDelete.fromInstagramId,
          });
          console.log(`🔔 매칭 해제 알림 전송: ${reverseAlarm.userId}`);
        }
      }
    }

    // 3. Soft Delete: deletedAt 설정 (실제 삭제 X)
    await req.prisma.alarm.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    console.log(`🗑️ 알람 Soft Delete: ${id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete alarm error:', error);
    res.status(500).json({ error: '알람 삭제 중 오류가 발생했습니다.' });
  }
});

export default router;

