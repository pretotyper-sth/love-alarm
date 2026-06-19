import { fetchInstagramUserProfile, sendInstagramDm } from './instagramMessaging.js';
import { normalizeInstagramUsername } from '../utils/instagramUsername.js';

function extractMessageEvents(body) {
  const out = [];
  if (!body || body.object !== 'instagram' || !Array.isArray(body.entry)) {
    return out;
  }

  for (const entry of body.entry) {
    if (Array.isArray(entry.messaging)) {
      for (const m of entry.messaging) {
        const text = m.message?.text;
        const senderId = m.sender?.id;
        if (senderId && text !== undefined) {
          out.push({ senderId: String(senderId), text: String(text) });
        }
      }
    }
    for (const change of entry.changes || []) {
      if (change.field === 'messages' && change.value) {
        const v = change.value;
        const text = v.message?.text;
        const senderId = v.sender?.id;
        if (senderId && text !== undefined) {
          out.push({ senderId: String(senderId), text: String(text) });
        }
      }
    }
  }
  return out;
}

function generateSixDigitCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const NO_SESSION_DM =
  `[좋아하면 울리는] 앱에서 인스타그램 ID를 입력하고 ` +
  `'코드 요청하기'를 먼저 눌러주세요.\n` +
  `그 다음 10분 안에 이 DM으로 '인증'이라고 보내면 인증번호를 보내드릴게요.`;

const PROFILE_LOOKUP_FAILED_DM =
  `[좋아하면 울리는] 인스타그램 계정 정보를 확인하지 못했어요.\n` +
  `@lovealarm.kr 팔로우 여부를 확인한 뒤 앱에서 다시 코드 요청을 해주세요.`;

const FOLLOW_REQUIRED_DM =
  `[좋아하면 울리는] @lovealarm.kr 팔로우가 확인되지 않았어요.\n` +
  `팔로우한 뒤 앱에서 다시 코드 요청을 하고 '인증'이라고 보내주세요.`;

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} body
 */
export async function handleInstagramWebhookPayload(
  prisma,
  body,
  deps = { fetchInstagramUserProfile, sendInstagramDm },
) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) {
    console.error('[webhook] INSTAGRAM_ACCESS_TOKEN not set');
    return;
  }

  const events = extractMessageEvents(body);
  if (events.length === 0) {
    return;
  }

  for (const { senderId, text } of events) {
    const trimmed = text.trim();
    if (!trimmed.includes('인증')) {
      continue;
    }

    const profile = await deps.fetchInstagramUserProfile(senderId, token);
    if (!profile?.username) {
      console.warn('[webhook] could not resolve username for', senderId);
      await deps.sendInstagramDm(senderId, PROFILE_LOOKUP_FAILED_DM);
      continue;
    }

    if (profile.isUserFollowBusiness === false) {
      console.log('[webhook] sender does not follow business account', senderId);
      await deps.sendInstagramDm(senderId, FOLLOW_REQUIRED_DM);
      continue;
    }

    const normalized = normalizeInstagramUsername(profile.username);
    const now = new Date();

    const session = await prisma.verificationSession.findFirst({
      where: {
        instagramUsername: normalized,
        status: 'pending',
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      console.log('[webhook] no pending session for @' + normalized);
      await deps.sendInstagramDm(senderId, NO_SESSION_DM);
      continue;
    }

    const code = generateSixDigitCode();
    const confirmDeadline = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.verificationSession.update({
      where: { id: session.id },
      data: {
        igUserId: senderId,
        code,
        status: 'code_sent',
        expiresAt: confirmDeadline,
      },
    });

    const dmText =
      `[좋아하면 울리는] 인증번호: ${code}\n` +
      `앱에 10분 이내로 입력해 주세요.\n\n` +
      `팔로워 노출이 신경쓰인다면 인증 완료 후엔 팔로우를 취소해도 괜찮아요!`;

    const sendResult = await deps.sendInstagramDm(senderId, dmText);
    if (!sendResult.ok) {
      console.error('[webhook] DM send failed for session', session.id);
      await prisma.verificationSession.update({
        where: { id: session.id },
        data: {
          igUserId: null,
          code: null,
          status: 'pending',
          expiresAt: session.expiresAt,
        },
      });
    } else {
      console.log('[webhook] code sent via DM for session', session.id);
    }
  }
}
