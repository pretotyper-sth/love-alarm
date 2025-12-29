import express from 'express';

const router = express.Router();

/**
 * POST /api/feedback
 * 피드백 제출
 * 
 * Body: { userId: string, category: string, content: string }
 */
router.post('/', async (req, res) => {
  try {
    const { userId, category, content } = req.body;

    // 필수 필드 검증
    if (!userId || !category || !content) {
      return res.status(400).json({ error: '필수 항목을 모두 입력해주세요.' });
    }

    // 카테고리 검증
    const validCategories = ['suggestion', 'bug', 'report', 'praise', 'other'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: '올바른 카테고리를 선택해주세요.' });
    }

    // 내용 길이 검증
    if (content.trim().length < 10) {
      return res.status(400).json({ error: '내용을 10자 이상 입력해주세요.' });
    }

    if (content.length > 500) {
      return res.status(400).json({ error: '내용은 500자 이내로 입력해주세요.' });
    }

    // 사용자 존재 확인
    const user = await req.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    // 피드백 저장
    const feedback = await req.prisma.feedback.create({
      data: {
        userId,
        category,
        content: content.trim(),
      },
    });

    console.log(`📝 피드백 접수: [${category}] ${content.substring(0, 50)}... (by ${userId})`);

    res.status(201).json({
      success: true,
      feedback: {
        id: feedback.id,
        category: feedback.category,
        createdAt: feedback.createdAt,
      },
    });
  } catch (error) {
    console.error('Feedback submission error:', error);
    res.status(500).json({ error: '피드백 전송 중 오류가 발생했습니다.' });
  }
});

export default router;

