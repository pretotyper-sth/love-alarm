import { fetchInstagramUsername, sendInstagramDm } from './instagramMessaging.js';
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

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} body
 */
export async function handleInstagramWebhookPayload(prisma, body) {
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

    const usernameFromApi = await fetchInstagramUsername(senderId, token);
    if (!usernameFromApi) {
      console.warn('[webhook] could not resolve username for', senderId);
      continue;
    }

    const normalized = normalizeInstagramUsername(usernameFromApi);
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
      `팔로워 노출이 신경쓰인다면 인증 완료 후엔 팔로우를 다시 취소하셔도 괜찮아요!`;

    const sendResult = await sendInstagramDm(senderId, dmText);
    if (!sendResult.ok) {
      console.error('[webhook] DM send failed for session', session.id);
    } else {
      console.log('[webhook] code sent via DM for session', session.id);
    }
  }
}
