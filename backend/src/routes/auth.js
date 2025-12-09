import { Router } from 'express';

const router = Router();

/**
 * POST /api/auth/login
 * 토스 계정으로 로그인/회원가입
 * 
 * Body: { tossUserId: string }
 * Response: { user: User, isNewUser: boolean }
 */
router.post('/login', async (req, res) => {
  try {
    const { tossUserId } = req.body;

    if (!tossUserId) {
      return res.status(400).json({ error: 'tossUserId가 필요합니다.' });
    }

    // 기존 사용자 찾기 또는 새로 생성
    let user = await req.prisma.user.findUnique({
      where: { tossUserId },
    });

    let isNewUser = false;

    if (!user) {
      // 새 사용자 생성
      user = await req.prisma.user.create({
        data: { tossUserId },
      });
      isNewUser = true;
    }

    res.json({ user, isNewUser });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '로그인 중 오류가 발생했습니다.' });
  }
});

export default router;

