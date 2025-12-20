/**
 * 매칭 로직
 * 
 * A가 B를 등록했을 때:
 * 1. B가 이 앱을 사용하는지 확인 (B의 알람 중 fromInstagramId가 targetInstagramId인 것)
 * 2. B가 A를 등록했는지 확인 (B의 알람 목록에서 A의 fromInstagramId 검색)
 * 3. 양방향 매칭이면 Match 생성 & 양쪽 Alarm status를 'matched'로 변경
 */

export async function checkMatching(prisma, currentUser, fromInstagramId, targetInstagramId) {
  // 1. 대상이 나를 등록했는지 확인 (fromInstagramId 기반)
  // 대상의 알람 중에서 targetInstagramId가 내 fromInstagramId와 일치하는 것 찾기
  const reverseAlarm = await prisma.alarm.findFirst({
    where: {
      fromInstagramId: targetInstagramId,  // 상대방의 본인 ID
      targetInstagramId: fromInstagramId,   // 상대방이 나를 등록
      deletedAt: null,  // Soft Delete: 활성 알람만
    },
    include: { user: true },
  });

  if (!reverseAlarm) {
    // 대상이 나를 등록하지 않음 - 매칭 불가
    return { matched: false, reason: 'no_reverse_alarm' };
  }

  const targetUser = reverseAlarm.user;

  // 2. 양방향 매칭! 🎉
  // 이미 매칭이 있는지 확인
  const existingMatch = await prisma.match.findFirst({
    where: {
      OR: [
        { user1Id: currentUser.id, user2Id: targetUser.id },
        { user1Id: targetUser.id, user2Id: currentUser.id },
      ],
    },
  });

  if (existingMatch) {
    return { matched: true, match: existingMatch, reason: 'already_matched', targetUserId: targetUser.id };
  }

  // 새 매칭 생성
  const match = await prisma.match.create({
    data: {
      user1Id: currentUser.id,
      user2Id: targetUser.id,
    },
  });

  // 양쪽 알람 상태를 'matched'로 업데이트
  await prisma.alarm.updateMany({
    where: {
      OR: [
        { userId: currentUser.id, targetInstagramId: targetInstagramId },
        { userId: targetUser.id, targetInstagramId: fromInstagramId },
      ],
    },
    data: { status: 'matched' },
  });

  // targetUserId 포함해서 반환 (WebSocket 알림용)
  return { matched: true, match, reason: 'new_match', targetUserId: targetUser.id };
}

