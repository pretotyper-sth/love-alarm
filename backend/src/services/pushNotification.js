import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 환경 변수
const {
  TOSS_CLIENT_CERT_PATH,
  TOSS_CLIENT_KEY_PATH,
  TOSS_CLIENT_CERT_BASE64,  // Base64 인코딩된 인증서 (Render용)
  TOSS_CLIENT_KEY_BASE64,   // Base64 인코딩된 키 (Render용)
} = process.env;

// 토스 API 설정
const TOSS_API_BASE_URL = 'https://apps-in-toss-api.toss.im';
const SEND_MESSAGE_ENDPOINT = '/api-partner/v1/apps-in-toss/messenger/send-message';

// 템플릿 코드
const TEMPLATE_CODES = {
  CONNECTION_SUCCESS: 'love-alarm-connection_success',
};

// mTLS 인증서 로드
let httpsAgent = null;

function getHttpsAgent() {
  if (httpsAgent) return httpsAgent;

  try {
    let cert, key;

    // 1. Base64 환경 변수 우선 사용 (Render 배포용)
    if (TOSS_CLIENT_CERT_BASE64 && TOSS_CLIENT_KEY_BASE64) {
      cert = Buffer.from(TOSS_CLIENT_CERT_BASE64, 'base64');
      key = Buffer.from(TOSS_CLIENT_KEY_BASE64, 'base64');
    } 
    // 2. 파일 경로 사용 (로컬 개발용)
    else if (TOSS_CLIENT_CERT_PATH && TOSS_CLIENT_KEY_PATH) {
      const certPath = path.resolve(__dirname, '../../', TOSS_CLIENT_CERT_PATH);
      const keyPath = path.resolve(__dirname, '../../', TOSS_CLIENT_KEY_PATH);
      cert = fs.readFileSync(certPath);
      key = fs.readFileSync(keyPath);
    } else {
      throw new Error('인증서 설정이 없습니다.');
    }

    httpsAgent = new https.Agent({ cert, key });
    return httpsAgent;
  } catch (error) {
    console.error('mTLS 인증서 로드 실패:', error.message);
    return null;
  }
}

/**
 * 푸시 알림 발송
 * @param {string} userKey - 토스 사용자 ID (tossUserId)
 * @param {string} templateSetCode - 템플릿 코드
 * @param {object} context - 템플릿 변수 (userName은 자동 적용)
 */
async function sendPushNotification(userKey, templateSetCode, context = {}) {
  const agent = getHttpsAgent();
  if (!agent) {
    return { success: false, error: 'mTLS 인증서를 로드할 수 없습니다.' };
  }

  try {
    const response = await fetch(`${TOSS_API_BASE_URL}${SEND_MESSAGE_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-toss-user-key': userKey,
      },
      body: JSON.stringify({
        templateSetCode,
        context,
      }),
      agent,
    });

    const data = await response.json();

    if (data.resultType === 'SUCCESS') {
      return { success: true, data };
    } else {
      console.error(`푸시 발송 실패: ${userKey}`, data.error || data);
      return { success: false, error: data.error || data };
    }
  } catch (error) {
    console.error(`푸시 발송 에러: ${userKey}`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 연결 성공 알림 발송
 * @param {object} user - 알림 받을 사용자 (User 모델)
 */
export async function sendConnectionSuccessNotification(user) {
  // 사용자 설정 확인 (둘 다 꺼져있으면 발송 안 함)
  if (!user.pushEnabled && !user.tossAppEnabled) {
    return { success: false, reason: '알림 설정 꺼짐' };
  }

  // 푸시 발송 (토스에서 푸시 + 앱 내 알림 둘 다 처리)
  return await sendPushNotification(
    user.tossUserId,
    TEMPLATE_CODES.CONNECTION_SUCCESS,
    {} // context - 추가 변수 필요하면 여기에
  );
}

/**
 * 양쪽 사용자에게 연결 성공 알림 발송
 * @param {object} user1 - 첫 번째 사용자
 * @param {object} user2 - 두 번째 사용자
 */
export async function notifyConnectionSuccess(user1, user2) {
  const [result1, result2] = await Promise.all([
    sendConnectionSuccessNotification(user1),
    sendConnectionSuccessNotification(user2),
  ]);

  return {
    user1: result1,
    user2: result2,
  };
}

export default {
  sendConnectionSuccessNotification,
  notifyConnectionSuccess,
  TEMPLATE_CODES,
};
