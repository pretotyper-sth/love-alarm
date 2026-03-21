import express from 'express';
import { handleInstagramWebhookPayload } from '../services/instagramWebhookHandler.js';

const router = express.Router();

/**
 * Meta Instagram Webhook 검증 (GET)
 * 대시보드 "확인 및 저장" 시 hub.mode=subscribe, hub.verify_token, hub.challenge 쿼리로 호출됨.
 */
router.get('/instagram', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const verifyToken = process.env.META_VERIFY_TOKEN;

  if (!verifyToken) {
    console.error('[webhook/instagram] META_VERIFY_TOKEN is not set');
    return res.status(500).send('Server misconfiguration');
  }

  if (mode === 'subscribe' && token === verifyToken) {
    return res.status(200).send(String(challenge));
  }

  return res.sendStatus(403);
});

/**
 * Instagram 메시징 이벤트 수신 (POST)
 * 이후 DM 인증 로직: 발신자 IG ID 매칭 → 코드 생성 → Graph API로 DM 응답.
 */
router.post('/instagram', express.json(), (req, res) => {
  // 로컬에서 Webhook 도착 여부 확인용 (한 줄)
  console.log('[webhook/instagram] POST', req.body?.object || 'unknown');

  res.status(200).send('EVENT_RECEIVED');

  const body = req.body;
  const prisma = req.prisma;

  setImmediate(() => {
    if (body?.object !== 'instagram') {
      return;
    }
    if (process.env.INSTAGRAM_WEBHOOK_DEBUG === '1') {
      console.log('[webhook/instagram] received:', JSON.stringify(body).slice(0, 2000));
    }
    handleInstagramWebhookPayload(prisma, body).catch((err) => {
      console.error('[webhook/instagram] handler error:', err);
    });
  });
});

export default router;
