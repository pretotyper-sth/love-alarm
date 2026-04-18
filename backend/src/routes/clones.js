import { Router } from 'express';
import {
  createClone,
  updateClone,
  deleteClone,
} from '../services/cloneService.js';
import {
  runConversation,
  getConversation,
  runAlarmPreview,
} from '../services/conversationService.js';
import { runMatchingBatch } from '../services/matchingEngine.js';

const router = Router();

// ==================== 클론 CRUD ====================

/**
 * POST /api/clones
 * AI 클론 생성
 */
router.post('/', async (req, res) => {
  try {
    const { userId, instagramId, gender, interestedIn, allowMatching, selfDescription } =
      req.body;

    if (!userId || !instagramId) {
      return res.status(400).json({ error: 'userId와 instagramId가 필요합니다.' });
    }

    const clone = await createClone(req.prisma, userId, instagramId, {
      gender,
      interestedIn,
      allowMatching,
      selfDescription,
    });

    res.status(201).json({ clone });
  } catch (error) {
    console.error('Clone creation error:', error.message);
    if (error.message.includes('이미 클론') || error.message.includes('비공개')) {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || '클론 생성에 실패했습니다.' });
  }
});

/**
 * GET /api/clones/:userId
 * 사용자의 클론 조회
 */
router.get('/:userId', async (req, res) => {
  try {
    const clone = await req.prisma.aiClone.findUnique({
      where: { userId: req.params.userId },
    });

    if (!clone) {
      return res.status(404).json({ error: '클론이 없습니다.', clone: null });
    }

    res.json({ clone });
  } catch (error) {
    res.status(500).json({ error: '클론 조회에 실패했습니다.' });
  }
});

/**
 * PATCH /api/clones/:userId
 * 클론 설정 업데이트
 */
router.patch('/:userId', async (req, res) => {
  try {
    const clone = await updateClone(req.prisma, req.params.userId, req.body);
    res.json({ clone });
  } catch (error) {
    res.status(500).json({ error: error.message || '클론 업데이트에 실패했습니다.' });
  }
});

/**
 * DELETE /api/clones/:userId
 * 클론 삭제
 */
router.delete('/:userId', async (req, res) => {
  try {
    await deleteClone(req.prisma, req.params.userId);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: '클론 삭제에 실패했습니다.' });
  }
});

// ==================== 대화 시뮬레이션 ====================

/**
 * POST /api/clones/conversations/simulate
 * 두 클론 간 대화 시뮬레이션 실행
 */
router.post('/conversations/simulate', async (req, res) => {
  try {
    const { clone1Id, clone2Id } = req.body;

    if (!clone1Id || !clone2Id) {
      return res.status(400).json({ error: 'clone1Id와 clone2Id가 필요합니다.' });
    }

    const conversation = await runConversation(req.prisma, clone1Id, clone2Id);
    res.json({ conversation });
  } catch (error) {
    console.error('Conversation simulation error:', error.message);
    res.status(500).json({ error: error.message || '대화 시뮬레이션에 실패했습니다.' });
  }
});

/**
 * GET /api/clones/conversations/:id
 * 대화 조회 (구매 여부에 따라 블러 처리)
 */
router.get('/conversations/:id', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId가 필요합니다.' });
    }

    const conversation = await getConversation(req.prisma, req.params.id, userId);

    if (!conversation) {
      return res.status(404).json({ error: '대화를 찾을 수 없습니다.' });
    }

    res.json({ conversation });
  } catch (error) {
    res.status(500).json({ error: '대화 조회에 실패했습니다.' });
  }
});

/**
 * GET /api/clones/conversations/user/:userId
 * 사용자의 모든 대화 목록 조회
 */
router.get('/conversations/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const clone = await req.prisma.aiClone.findUnique({ where: { userId } });
    if (!clone) {
      return res.json({ conversations: [] });
    }

    const conversations = await req.prisma.aiConversation.findMany({
      where: {
        OR: [{ clone1Id: clone.id }, { clone2Id: clone.id }],
        status: 'completed',
      },
      include: {
        clone1: { select: { instagramId: true, userId: true } },
        clone2: { select: { instagramId: true, userId: true } },
      },
      orderBy: { completedAt: 'desc' },
      take: 50,
    });

    res.json({ conversations });
  } catch (error) {
    res.status(500).json({ error: '대화 목록 조회에 실패했습니다.' });
  }
});

// ==================== 알람 미리보기 ====================

/**
 * POST /api/clones/alarm-preview
 * 알람 추가 전 대상과의 AI 대화 미리보기
 */
router.post('/alarm-preview', async (req, res) => {
  try {
    const { userId, targetInstagramId } = req.body;

    if (!userId || !targetInstagramId) {
      return res
        .status(400)
        .json({ error: 'userId와 targetInstagramId가 필요합니다.' });
    }

    const conversation = await runAlarmPreview(
      req.prisma,
      userId,
      targetInstagramId
    );

    if (!conversation) {
      return res.json({
        available: false,
        reason: '상대가 AI 클론을 등록하지 않았거나 대화를 허용하지 않았어요.',
      });
    }

    res.json({ available: true, conversation });
  } catch (error) {
    if (error.message.includes('먼저 AI 클론')) {
      return res.status(400).json({ error: error.message, needsClone: true });
    }
    res.status(500).json({ error: error.message || '미리보기에 실패했습니다.' });
  }
});

/**
 * GET /api/clones/alarm-preview/check
 * 대상이 클론 등록 + 매칭 허용했는지만 확인 (결제 전 체크)
 */
router.get('/alarm-preview/check', async (req, res) => {
  try {
    const { targetInstagramId } = req.query;

    if (!targetInstagramId) {
      return res.status(400).json({ error: 'targetInstagramId가 필요합니다.' });
    }

    const targetClone = await req.prisma.aiClone.findFirst({
      where: {
        instagramId: targetInstagramId.toLowerCase(),
        status: 'active',
        allowMatching: true,
      },
      select: { id: true },
    });

    res.json({ available: !!targetClone });
  } catch (error) {
    res.status(500).json({ error: '확인에 실패했습니다.' });
  }
});

// ==================== 구매 ====================

/**
 * POST /api/clones/conversations/:id/purchase
 * 대화 조회 구매
 */
router.post('/conversations/:id/purchase', async (req, res) => {
  try {
    const { userId, purchaseType } = req.body;
    const conversationId = req.params.id;

    if (!userId) {
      return res.status(400).json({ error: 'userId가 필요합니다.' });
    }

    const existing = await req.prisma.cloneViewPurchase.findFirst({
      where: { userId, conversationId },
    });

    if (existing) {
      return res.json({ purchase: existing, alreadyPurchased: true });
    }

    const amountMap = {
      conversation_view: 1900,
      alarm_preview: 990,
    };

    const purchase = await req.prisma.cloneViewPurchase.create({
      data: {
        userId,
        conversationId,
        amount: amountMap[purchaseType] || 1900,
        purchaseType: purchaseType || 'conversation_view',
      },
    });

    res.status(201).json({ purchase });
  } catch (error) {
    res.status(500).json({ error: '구매 처리에 실패했습니다.' });
  }
});

// ==================== 매칭 엔진 (관리자용) ====================

/**
 * POST /api/clones/matching/trigger
 * 매칭 배치 수동 트리거 (관리자/테스트용)
 */
router.post('/matching/trigger', async (req, res) => {
  try {
    const result = await runMatchingBatch(req.prisma, req.io, req.userSockets);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message || '매칭 실행에 실패했습니다.' });
  }
});

export default router;
