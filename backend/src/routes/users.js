import { Router } from 'express';

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

export default router;

