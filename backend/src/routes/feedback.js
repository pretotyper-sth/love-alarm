import express from 'express';

const router = express.Router();

// 피드백 제출
router.post('/', async (req, res) => {
  try {
    const { category, content, userId } = req.body;
    const prisma = req.prisma;

    // 유효성 검사 (FE에서 이미 검증하지만 안전을 위해)
    if (!category || !content) {
      return res.status(400).json({ error: '카테고리와 내용은 필수입니다.' });
    }

    if (content.trim().length < 10) {
      return res.status(400).json({ error: '최소 10자 이상 입력해 주세요.' });
    }

    // 피드백 저장 (userId 없이 저장 - 외래키 제약 문제 방지)
    const feedback = await prisma.feedback.create({
      data: {
        category,
        content: content.trim(),
        // userId는 일단 저장하지 않음 (나중에 필요하면 추가)
      },
    });

    console.log('📝 새 피드백 등록:', { id: feedback.id, category, contentLength: content.length });

    res.status(201).json({
      success: true,
      message: '피드백이 성공적으로 제출되었습니다.',
      feedback: {
        id: feedback.id,
        category: feedback.category,
        createdAt: feedback.createdAt,
      },
    });
  } catch (error) {
    console.error('피드백 제출 오류:', error);
    res.status(500).json({ error: '피드백 제출에 실패했습니다.' });
  }
});

// 피드백 목록 조회 (관리자용)
router.get('/', async (req, res) => {
  try {
    const prisma = req.prisma;
    const { status, category, page = 1, limit = 20 } = req.query;

    const where = {};
    if (status) where.status = status;
    if (category) where.category = category;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [feedbacks, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
        include: {
          user: {
            select: {
              id: true,
              name: true,
              instagramId: true,
            },
          },
        },
      }),
      prisma.feedback.count({ where }),
    ]);

    res.json({
      success: true,
      feedbacks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('피드백 조회 오류:', error);
    res.status(500).json({ error: '피드백 조회에 실패했습니다.' });
  }
});

// 피드백 상태 업데이트 (관리자용)
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const prisma = req.prisma;

    const validStatuses = ['pending', 'reviewed', 'resolved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: '유효하지 않은 상태입니다.' });
    }

    const feedback = await prisma.feedback.update({
      where: { id },
      data: { status },
    });

    res.json({
      success: true,
      message: '피드백 상태가 업데이트되었습니다.',
      feedback,
    });
  } catch (error) {
    console.error('피드백 상태 업데이트 오류:', error);
    res.status(500).json({ error: '피드백 상태 업데이트에 실패했습니다.' });
  }
});

// 피드백 삭제 (관리자용)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const prisma = req.prisma;

    await prisma.feedback.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: '피드백이 삭제되었습니다.',
    });
  } catch (error) {
    console.error('피드백 삭제 오류:', error);
    res.status(500).json({ error: '피드백 삭제에 실패했습니다.' });
  }
});

export default router;

