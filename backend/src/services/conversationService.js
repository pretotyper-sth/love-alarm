/**
 * AI 클론 대화 시뮬레이션 엔진
 *
 * 두 클론 간의 대화를 LLM 멀티턴으로 시뮬레이션하고
 * 케미 점수 및 요약을 생성한다.
 *
 * 비용: Groq/Gemini 무료 티어 사용 → 고정비용 0원
 */

import { callLLM, callLLMJson } from './llmProvider.js';

const CONVERSATION_TURNS = parseInt(process.env.CLONE_CONVERSATION_TURNS || '8', 10);

/**
 * 대화 시뮬레이션 시작 프롬프트 생성
 */
function buildConversationSystemPrompt(clone1, clone2) {
  return `너는 두 사람의 AI 클론이 처음 만나 대화하는 시뮬레이션을 진행하는 엔진이다.

## 참여자
- Clone A (@${clone1.instagramId}): 아래 성격대로 행동
- Clone B (@${clone2.instagramId}): 아래 성격대로 행동

## Clone A 설정:
${clone1.clonePrompt}

## Clone B 설정:
${clone2.clonePrompt}

## 규칙
1. 처음 만난 두 사람의 자연스러운 대화를 시뮬레이션한다.
2. 각 턴에서 한 사람만 말한다.
3. 대화 내용은 한국어로, 자연스럽고 실제 채팅처럼 작성한다.
4. 각 성격에 맞는 말투와 반응을 유지한다.
5. 어색한 시작부터 점점 대화가 풀리는 자연스러운 흐름을 만든다.
6. 대화 주제는 자연스럽게 전환되도록 한다.

반드시 JSON 배열로만 응답하라. 다른 텍스트는 포함하지 마라.
형식: [{"speaker": "A" 또는 "B", "message": "대화 내용"}, ...]`;
}

/**
 * LLM에 대화 생성 요청
 * Groq/Gemini 무료 티어로 비용 0원 운영.
 */
async function generateConversation(clone1, clone2) {
  const systemPrompt = buildConversationSystemPrompt(clone1, clone2);
  const userPrompt = `두 사람이 처음 만나 ${CONVERSATION_TURNS}턴의 대화를 나눈다. A가 먼저 말을 건다. 자연스러운 첫 만남 대화를 JSON 배열로 시뮬레이션하라.`;

  try {
    const content = await callLLMJson(systemPrompt, userPrompt, {
      temperature: 0.9,
      maxTokens: 3000,
    });

    if (!content) {
      return generateMockConversation(clone1, clone2);
    }

    const messages = Array.isArray(content) ? content : content.messages || content.conversation || [];

    return messages.map((m, i) => ({
      speaker: m.speaker || (i % 2 === 0 ? 'A' : 'B'),
      message: m.message || m.content || m.text || '',
      timestamp: new Date(Date.now() + i * 30000).toISOString(),
    }));
  } catch (error) {
    console.error('Conversation generation failed:', error.message);
    return generateMockConversation(clone1, clone2);
  }
}

/**
 * 케미 점수 및 대화 요약 분석
 * Groq/Gemini 무료 티어로 비용 0원 운영.
 */
async function analyzeChemistry(messages, clone1, clone2) {
  const conversationText = messages
    .map((m) => `${m.speaker === 'A' ? clone1.instagramId : clone2.instagramId}: ${m.message}`)
    .join('\n');

  const systemPrompt = `너는 관계 심리학 전문가다. 두 사람의 대화를 분석해서 케미 점수와 요약을 제공한다. 반드시 JSON으로만 응답하라.`;

  const userPrompt = `다음 대화를 분석하라:

${conversationText}

응답 형식:
{
  "score": 0~100 (케미 점수. 50이 평균, 80 이상이면 높은 케미),
  "summary": "3~4문장으로 두 사람의 대화 케미를 설명. 장점과 보완점 포함.",
  "highlights": ["인상 깊은 대화 포인트 1", "포인트 2"],
  "compatibility": {
    "conversationFlow": "smooth|moderate|awkward",
    "humorMatch": "high|medium|low",
    "interestOverlap": "high|medium|low",
    "emotionalSync": "high|medium|low"
  }
}`;

  try {
    const result = await callLLMJson(systemPrompt, userPrompt, {
      temperature: 0.5,
      maxTokens: 800,
    });

    if (!result) {
      return { score: 65, summary: buildMockSummary(clone1, clone2) };
    }

    return {
      score: Math.max(0, Math.min(100, result.score || 65)),
      summary: result.summary || buildMockSummary(clone1, clone2),
      highlights: result.highlights || [],
      compatibility: result.compatibility || {},
    };
  } catch {
    return { score: 65, summary: buildMockSummary(clone1, clone2) };
  }
}

function buildMockSummary(clone1, clone2) {
  return `@${clone1.instagramId}와 @${clone2.instagramId}의 클론이 처음 만나 대화를 나눴어요. 서로의 관심사를 탐색하며 자연스러운 대화를 이어갔습니다.`;
}

function generateMockConversation(clone1, clone2) {
  const mockMessages = [
    { speaker: 'A', message: '안녕하세요! 반가워요 ☺️' },
    { speaker: 'B', message: '안녕하세요~ 반갑습니다!' },
    { speaker: 'A', message: '프로필 보니까 여행 좋아하시는 것 같더라고요' },
    { speaker: 'B', message: '맞아요! 최근에 일본 다녀왔어요. 혹시 여행 좋아하세요?' },
    { speaker: 'A', message: '저도 여행 너무 좋아해요. 일본 어디 다녀오셨어요?' },
    { speaker: 'B', message: '교토 갔다왔어요. 분위기가 정말 좋더라고요' },
    { speaker: 'A', message: '오 교토! 저도 가보고 싶었는데. 맛집 추천 있어요?' },
    { speaker: 'B', message: '아라시야마 근처에 두부 요리 맛집이 있는데 진짜 추천이에요 ㅎㅎ' },
  ];

  return mockMessages.map((m, i) => ({
    ...m,
    timestamp: new Date(Date.now() + i * 30000).toISOString(),
  }));
}

/**
 * 대화 시뮬레이션 전체 파이프라인
 */
export async function runConversation(prisma, clone1Id, clone2Id) {
  const clone1 = await prisma.aiClone.findUnique({
    where: { id: clone1Id },
    include: { user: true },
  });
  const clone2 = await prisma.aiClone.findUnique({
    where: { id: clone2Id },
    include: { user: true },
  });

  if (!clone1 || !clone2) {
    throw new Error('클론을 찾을 수 없습니다.');
  }

  // 이미 대화가 있는지 확인 (양방향)
  let conversation = await prisma.aiConversation.findFirst({
    where: {
      OR: [
        { clone1Id, clone2Id },
        { clone1Id: clone2Id, clone2Id: clone1Id },
      ],
    },
  });

  if (conversation && conversation.status === 'completed') {
    return conversation;
  }

  // 새 대화 생성 또는 기존 pending 업데이트
  if (!conversation) {
    conversation = await prisma.aiConversation.create({
      data: { clone1Id, clone2Id, status: 'in_progress' },
    });
  } else {
    await prisma.aiConversation.update({
      where: { id: conversation.id },
      data: { status: 'in_progress' },
    });
  }

  try {
    const messages = await generateConversation(clone1, clone2);
    const chemistry = await analyzeChemistry(messages, clone1, clone2);

    conversation = await prisma.aiConversation.update({
      where: { id: conversation.id },
      data: {
        messages,
        chemistryScore: chemistry.score,
        summary: chemistry.summary,
        status: 'completed',
        completedAt: new Date(),
      },
    });

    return conversation;
  } catch (error) {
    await prisma.aiConversation.update({
      where: { id: conversation.id },
      data: { status: 'failed' },
    });
    throw error;
  }
}

/**
 * 특정 대화 조회 (구매 확인 포함)
 */
export async function getConversation(prisma, conversationId, userId) {
  const conversation = await prisma.aiConversation.findUnique({
    where: { id: conversationId },
    include: {
      clone1: { include: { user: { select: { id: true, instagramId: true } } } },
      clone2: { include: { user: { select: { id: true, instagramId: true } } } },
      purchases: { where: { userId } },
    },
  });

  if (!conversation) return null;

  const isOwner =
    conversation.clone1.userId === userId || conversation.clone2.userId === userId;
  const hasPurchased = conversation.purchases.length > 0;

  if (!isOwner && !hasPurchased) {
    // 미구매: 블러 처리된 요약만 반환
    return {
      id: conversation.id,
      chemistryScore: conversation.chemistryScore,
      status: conversation.status,
      createdAt: conversation.createdAt,
      preview: true,
      summary: conversation.summary
        ? conversation.summary.slice(0, 30) + '...'
        : null,
      messages: [],
      clone1InstagramId: conversation.clone1.instagramId,
      clone2InstagramId: conversation.clone2.instagramId,
    };
  }

  return {
    ...conversation,
    preview: false,
  };
}

/**
 * 알람 추가 전 미리보기용 시뮬레이션
 * 내 클론과 대상 클론이 모두 존재할 때만 가능
 */
export async function runAlarmPreview(prisma, userId, targetInstagramId) {
  const myClone = await prisma.aiClone.findUnique({ where: { userId } });
  if (!myClone) {
    throw new Error('먼저 AI 클론을 만들어 주세요.');
  }

  const targetClone = await prisma.aiClone.findFirst({
    where: {
      instagramId: targetInstagramId.toLowerCase(),
      status: 'active',
      allowMatching: true,
    },
  });

  if (!targetClone) {
    return null; // 대상이 클론을 등록하지 않았거나 매칭 허용하지 않음
  }

  return runConversation(prisma, myClone.id, targetClone.id);
}
