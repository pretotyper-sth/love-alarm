/**
 * 매칭 로직
 * 
 * A가 B를 등록했을 때:
 * 1. B가 이 앱을 사용하는지 확인 (B의 instagramId로 User 조회)
 * 2. B가 A를 등록했는지 확인 (B의 알람 목록에서 A의 instagramId 검색)
 * 3. 양방향 매칭이면 Match 생성 & 양쪽 Alarm status를 'matched'로 변경
 */

export async function checkMatching(prisma, currentUser, targetInstagramId) {
  // 1. 대상 사용자가 이 앱을 사용하는지 확인
  // (중복 허용으로 findFirst 사용)
  const targetUser = await prisma.user.findFirst({
    where: { instagramId: targetInstagramId },
  });

  if (!targetUser) {
    // 대상이 앱을 사용하지 않음 - 매칭 불가
    return { matched: false, reason: 'target_not_registered' };
  }

  // 2. 대상이 현재 사용자를 등록했는지 확인
  if (!currentUser.instagramId) {
    // 현재 사용자가 인스타그램 ID를 등록하지 않음
    return { matched: false, reason: 'current_user_no_instagram' };
  }

  const reverseAlarm = await prisma.alarm.findUnique({
    where: {
      userId_targetInstagramId: {
        userId: targetUser.id,
        targetInstagramId: currentUser.instagramId,
      },
    },
  });

  if (!reverseAlarm) {
    // 대상이 나를 등록하지 않음 - 매칭 불가
    return { matched: false, reason: 'no_reverse_alarm' };
  }

  // 3. 양방향 매칭! 🎉
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
        { userId: targetUser.id, targetInstagramId: currentUser.instagramId },
      ],
    },
    data: { status: 'matched' },
  });

  // targetUserId 포함해서 반환 (WebSocket 알림용)
  return { matched: true, match, reason: 'new_match', targetUserId: targetUser.id };
}

