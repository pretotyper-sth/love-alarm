/**
 * 동의 기반 클론 매칭 엔진
 *
 * allowMatching=true인 활성 클론 풀에서 아직 대화하지 않은 쌍을 찾아
 * 대화 시뮬레이션을 트리거한다.
 *
 * 매칭 기준:
 * 1. 양쪽 모두 allowMatching=true, status=active
 * 2. interestedIn 호환성 체크
 * 3. 이미 대화한 적 없는 쌍
 * 4. 케미 점수가 높은 순으로 알림 발송
 */

import { runConversation } from './conversationService.js';

const BATCH_SIZE = parseInt(process.env.MATCHING_BATCH_SIZE || '5', 10);
const CHEMISTRY_NOTIFY_THRESHOLD = parseFloat(
  process.env.CHEMISTRY_NOTIFY_THRESHOLD || '60'
);

/**
 * interestedIn 호환성 체크
 */
function isCompatible(clone1, clone2) {
  const genderMatch = (interested, targetGender) => {
    if (!interested || interested === 'all') return true;
    return interested === targetGender;
  };

  return (
    genderMatch(clone1.interestedIn, clone2.gender) &&
    genderMatch(clone2.interestedIn, clone1.gender)
  );
}

/**
 * 매칭 풀에서 아직 대화하지 않은 호환 가능한 쌍 찾기
 */
export async function findUnmatchedPairs(prisma, limit = BATCH_SIZE) {
  const eligibleClones = await prisma.aiClone.findMany({
    where: {
      allowMatching: true,
      status: 'active',
      clonePrompt: { not: null },
    },
    select: {
      id: true,
      userId: true,
      instagramId: true,
      gender: true,
      interestedIn: true,
    },
  });

  if (eligibleClones.length < 2) return [];

  const existingPairs = await prisma.aiConversation.findMany({
    select: { clone1Id: true, clone2Id: true },
  });

  const pairSet = new Set(
    existingPairs.flatMap((p) => [
      `${p.clone1Id}:${p.clone2Id}`,
      `${p.clone2Id}:${p.clone1Id}`,
    ])
  );

  const pairs = [];

  for (let i = 0; i < eligibleClones.length && pairs.length < limit; i++) {
    for (let j = i + 1; j < eligibleClones.length && pairs.length < limit; j++) {
      const a = eligibleClones[i];
      const b = eligibleClones[j];

      if (pairSet.has(`${a.id}:${b.id}`)) continue;
      if (!isCompatible(a, b)) continue;

      pairs.push([a, b]);
    }
  }

  return pairs;
}

/**
 * 매칭 + 대화 시뮬레이션 배치 실행
 */
export async function runMatchingBatch(prisma, io, userSockets) {
  const pairs = await findUnmatchedPairs(prisma);

  if (pairs.length === 0) {
    return { processed: 0, notified: 0 };
  }

  let processed = 0;
  let notified = 0;

  for (const [clone1, clone2] of pairs) {
    try {
      const conversation = await runConversation(prisma, clone1.id, clone2.id);
      processed++;

      if (
        conversation.chemistryScore &&
        conversation.chemistryScore >= CHEMISTRY_NOTIFY_THRESHOLD
      ) {
        // 양쪽 사용자에게 알림
        notifyUser(io, userSockets, clone1.userId, {
          type: 'chemistry_found',
          conversationId: conversation.id,
          partnerInstagramId: clone2.instagramId,
          chemistryScore: conversation.chemistryScore,
          message: '당신의 클론이 누군가와 좋은 대화를 나눴어요',
        });

        notifyUser(io, userSockets, clone2.userId, {
          type: 'chemistry_found',
          conversationId: conversation.id,
          partnerInstagramId: clone1.instagramId,
          chemistryScore: conversation.chemistryScore,
          message: '당신의 클론이 누군가와 좋은 대화를 나눴어요',
        });

        notified += 2;
      }
    } catch (error) {
      console.error(
        `Matching failed for ${clone1.instagramId} x ${clone2.instagramId}:`,
        error.message
      );
    }
  }

  return { processed, notified };
}

/**
 * WebSocket으로 사용자에게 알림 전송
 */
function notifyUser(io, userSockets, userId, data) {
  if (!io || !userSockets) return;

  const socketId = userSockets.get(userId);
  if (socketId) {
    io.to(socketId).emit('cloneNotification', data);
  }
}

/**
 * 매칭 엔진을 주기적으로 실행하는 스케줄러 설정
 */
export function startMatchingScheduler(prisma, io, userSockets) {
  const intervalMs = parseInt(
    process.env.MATCHING_INTERVAL_MS || String(30 * 60 * 1000),
    10
  );

  console.log(
    `🤖 클론 매칭 엔진 시작 (${intervalMs / 1000 / 60}분 간격, 배치 크기: ${BATCH_SIZE})`
  );

  const run = async () => {
    try {
      const result = await runMatchingBatch(prisma, io, userSockets);
      if (result.processed > 0) {
        console.log(
          `🤖 매칭 배치 완료: ${result.processed}쌍 처리, ${result.notified}건 알림`
        );
      }
    } catch (error) {
      console.error('🤖 매칭 배치 에러:', error.message);
    }
  };

  // 서버 시작 1분 후 첫 실행
  setTimeout(run, 60 * 1000);
  // 이후 주기적 실행
  setInterval(run, intervalMs);
}
