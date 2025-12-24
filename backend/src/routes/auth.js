import { Router } from 'express';

const router = Router();

/**
 * POST /api/auth/login
 * 토스 계정으로 로그인/회원가입
 * 
 * Body: { 
 *   tossUserId: string,      // 필수: 토스 계정 고유 ID
 *   name?: string,           // 선택: 사용자 이름 (토스 로그인 동의 항목)
 *   gender?: string,         // 선택: 성별 (male/female)
 *   birthday?: string        // 선택: 생년월일 (ISO 8601 형식)
 * }
 * Response: { user: User, isNewUser: boolean }
 */
router.post('/login', async (req, res) => {
  try {
    const { tossUserId, name, gender, birthday } = req.body;

    if (!tossUserId) {
      return res.status(400).json({ error: 'tossUserId가 필요합니다.' });
    }

    // 기존 사용자 찾기
    let user = await req.prisma.user.findUnique({
      where: { tossUserId },
    });

    let isNewUser = false;

    if (!user) {
      // 새 사용자 생성
      user = await req.prisma.user.create({
        data: { 
          tossUserId,
          name: name || null,
          gender: gender || null,
          birthday: birthday ? new Date(birthday) : null,
        },
      });
      isNewUser = true;
      console.log(`👤 새 사용자 가입: ${tossUserId}, 이름: ${name || '미제공'}`);
    } else {
      // 기존 사용자 - 프로필 정보 업데이트 (새 정보가 있으면)
      const updateData = {};
      if (name && !user.name) updateData.name = name;
      if (gender && !user.gender) updateData.gender = gender;
      if (birthday && !user.birthday) updateData.birthday = new Date(birthday);

      if (Object.keys(updateData).length > 0) {
        user = await req.prisma.user.update({
          where: { tossUserId },
          data: updateData,
        });
        console.log(`👤 사용자 프로필 업데이트: ${tossUserId}`, updateData);
      }
    }

    res.json({ user, isNewUser });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '로그인 중 오류가 발생했습니다.' });
  }
});

/**
 * POST /api/auth/disconnect
 * 토스 앱에서 서비스 연결 끊기 콜백
 * (토스 콘솔에서 콜백 URL로 등록)
 */
router.post('/disconnect', async (req, res) => {
  try {
    const { tossUserId } = req.body;

    if (!tossUserId) {
      return res.status(400).json({ error: 'tossUserId가 필요합니다.' });
    }

    // 사용자 삭제 (Cascade로 알람, 매칭도 함께 삭제됨)
    const user = await req.prisma.user.findUnique({
      where: { tossUserId },
    });

    if (user) {
      await req.prisma.user.delete({
        where: { tossUserId },
      });
      console.log(`🔌 서비스 연결 끊김: ${tossUserId}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: '연결 끊기 처리 중 오류가 발생했습니다.' });
  }
});

export default router;
