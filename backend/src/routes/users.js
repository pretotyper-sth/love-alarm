import { Router } from 'express';
import { sendConnectionSuccessNotification } from '../services/pushNotification.js';

const router = Router();

/**
 * GET /api/users/:id
 * 사용자 정보 조회
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await req.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: '사용자 조회 중 오류가 발생했습니다.' });
  }
});

/**
 * PUT /api/users/:id/instagram
 * 인스타그램 ID 등록/수정
 * 
 * Body: { instagramId: string }
 * 
 * 참고: 인스타그램 ID 중복 허용 (여러 사용자가 같은 ID 사용 가능)
 * - 실제 소유자 확인은 인스타그램 OAuth 연동 시 구현
 */
router.put('/:id/instagram', async (req, res) => {
  try {
    const { id } = req.params;
    const { instagramId } = req.body;

    if (!instagramId) {
      return res.status(400).json({ error: 'instagramId가 필요합니다.' });
    }

    const user = await req.prisma.user.update({
      where: { id },
      data: { instagramId },
    });

    res.json({ user });
  } catch (error) {
    console.error('Update instagram error:', error);
    res.status(500).json({ error: '인스타그램 ID 수정 중 오류가 발생했습니다.' });
  }
});

/**
 * PATCH /api/users/:id/settings
 * 알림 설정 변경
 * 
 * Body: { pushEnabled?: boolean, tossAppEnabled?: boolean }
 */
router.patch('/:id/settings', async (req, res) => {
  try {
    const { id } = req.params;
    const { pushEnabled, tossAppEnabled } = req.body;

    // 최소 하나의 설정값이 있어야 함
    if (pushEnabled === undefined && tossAppEnabled === undefined) {
      return res.status(400).json({ error: '변경할 설정이 없습니다.' });
    }

    const updateData = {};
    if (pushEnabled !== undefined) updateData.pushEnabled = pushEnabled;
    if (tossAppEnabled !== undefined) updateData.tossAppEnabled = tossAppEnabled;

    const user = await req.prisma.user.update({
      where: { id },
      data: updateData,
    });

    console.log(`🔔 알림 설정 변경: ${id}, push=${user.pushEnabled}, tossApp=${user.tossAppEnabled}`);

    res.json({ user });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: '설정 변경 중 오류가 발생했습니다.' });
  }
});

/**
 * POST /api/users/:id/test-push
 * [개발용] 푸시 알림 테스트
 * 
 * 1계정으로 푸시 알림 테스트할 때 사용
 */
router.post('/:id/test-push', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await req.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    console.log(`🧪 푸시 테스트 시작: ${user.tossUserId}`);
    console.log(`   - pushEnabled: ${user.pushEnabled}`);
    console.log(`   - tossAppEnabled: ${user.tossAppEnabled}`);

    // 강제로 알림 발송 테스트 (설정 무시)
    const testUser = { ...user, pushEnabled: true, tossAppEnabled: true };
    const result = await sendConnectionSuccessNotification(testUser);

    console.log(`🧪 푸시 테스트 결과:`, result);

    res.json({ 
      success: result.success, 
      result,
      user: {
        id: user.id,
        tossUserId: user.tossUserId,
        pushEnabled: user.pushEnabled,
        tossAppEnabled: user.tossAppEnabled,
      }
    });
  } catch (error) {
    console.error('Test push error:', error);
    res.status(500).json({ error: error.message || '푸시 테스트 중 오류가 발생했습니다.' });
  }
});

/**
 * POST /api/users/:id/purchase-slot
 * 알람 슬롯 구매 (결제 성공 후 호출)
 * 
 * 결제 연동 전: 바로 슬롯 증가
 * 결제 연동 후: 결제 검증 후 슬롯 증가
 */
router.post('/:id/purchase-slot', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await req.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    // 슬롯 1개 증가
    const updatedUser = await req.prisma.user.update({
      where: { id },
      data: { maxSlots: user.maxSlots + 1 },
    });

    console.log(`🎫 슬롯 구매 완료: ${id}, ${user.maxSlots} -> ${updatedUser.maxSlots}`);

    res.json({ user: updatedUser, newMaxSlots: updatedUser.maxSlots });
  } catch (error) {
    console.error('Purchase slot error:', error);
    res.status(500).json({ error: '슬롯 구매 중 오류가 발생했습니다.' });
  }
});

export default router;

