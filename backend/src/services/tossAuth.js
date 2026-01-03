import https from 'https';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 환경 변수
const {
  TOSS_CLIENT_CERT_PATH,
  TOSS_CLIENT_KEY_PATH,
  TOSS_CLIENT_CERT_BASE64,  // Base64 인코딩된 인증서 (Render용)
  TOSS_CLIENT_KEY_BASE64,   // Base64 인코딩된 키 (Render용)
  TOSS_DECRYPTION_KEY,
  TOSS_AAD,
} = process.env;

// mTLS 인증서 로드
let httpsAgent = null;

export function getHttpsAgent() {
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
    console.error('❌ mTLS 인증서 로드 실패:', error.message);
    return null;
  }
}

// 토스 API Base URL
const TOSS_API_BASE = 'https://apps-in-toss-api.toss.im';

/**
 * 토스 API에서 AccessToken 발급
 * 참고: https://developers-apps-in-toss.toss.im/login/develop.html
 * @param {string} authorizationCode - appLogin()에서 받은 인가 코드
 * @param {string} referrer - appLogin()에서 받은 referrer
 */
export async function getAccessToken(authorizationCode, referrer) {
  const agent = getHttpsAgent();
  if (!agent) throw new Error('mTLS 인증서를 로드할 수 없습니다.');

  const response = await fetch(`${TOSS_API_BASE}/api-partner/v1/apps-in-toss/user/oauth2/generate-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      authorizationCode,
      referrer,
    }),
    agent,
  });

  const data = await response.json();
  
  if (!response.ok || data.resultType === 'FAIL') {
    console.error('토스 토큰 발급 실패:', data);
    throw new Error(data.error?.reason || data.error || '토큰 발급 실패');
  }

  // success 객체에서 토큰 정보 추출
  return data.success || data;
}

/**
 * 토스 API에서 사용자 정보 조회
 * 참고: https://developers-apps-in-toss.toss.im/login/develop.html
 * @param {string} accessToken - getAccessToken()에서 받은 토큰
 */
export async function getUserInfo(accessToken) {
  const agent = getHttpsAgent();
  if (!agent) throw new Error('mTLS 인증서를 로드할 수 없습니다.');

  // Bearer 접두사 추가 (tokenType이 Bearer이므로)
  const authHeader = accessToken.startsWith('Bearer ') ? accessToken : `Bearer ${accessToken}`;

  const response = await fetch(`${TOSS_API_BASE}/api-partner/v1/apps-in-toss/user/oauth2/login-me`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
    },
    agent,
  });

  const data = await response.json();
  
  if (!response.ok || data.resultType === 'FAIL') {
    console.error('토스 사용자 정보 조회 실패:', data);
    throw new Error(data.error?.reason || '사용자 정보 조회 실패');
  }

  // 암호화된 필드 복호화
  const userInfo = data.success || data;
  const decryptedData = decryptUserInfo(userInfo);
  
  return decryptedData;
}

/**
 * 암호화된 사용자 정보 복호화
 * AES-256-GCM 알고리즘 사용
 */
function decryptUserInfo(userInfo) {
  const fields = ['name', 'gender', 'birthday', 'ci', 'phone', 'email', 'nationality'];
  const decrypted = { ...userInfo };

  for (const field of fields) {
    const value = userInfo[field];
    if (typeof value === 'string' && value.length > 0) {
      try {
        decrypted[field] = decryptField(value);
      } catch (error) {
        console.error(`${field} 복호화 실패:`, error.message);
        decrypted[field] = null;
      }
    }
  }

  return decrypted;
}

/**
 * 개별 필드 복호화 (AES-256-GCM)
 * 형식: base64(iv + ciphertext + authTag)
 */
function decryptField(encryptedValue) {
  const key = Buffer.from(TOSS_DECRYPTION_KEY, 'base64');
  const aad = Buffer.from(TOSS_AAD, 'utf-8');
  
  // Base64 디코딩
  const encrypted = Buffer.from(encryptedValue, 'base64');
  
  // IV (12바이트), AuthTag (16바이트), Ciphertext (나머지)
  const iv = encrypted.subarray(0, 12);
  const authTag = encrypted.subarray(encrypted.length - 16);
  const ciphertext = encrypted.subarray(12, encrypted.length - 16);
  
  // 복호화
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  decipher.setAAD(aad);
  
  let decrypted = decipher.update(ciphertext, null, 'utf-8');
  decrypted += decipher.final('utf-8');
  
  return decrypted;
}

/**
 * AccessToken 갱신
 * 참고: https://developers-apps-in-toss.toss.im/login/develop.html
 * @param {string} refreshToken - 기존 refreshToken
 */
export async function refreshAccessToken(refreshToken) {
  const agent = getHttpsAgent();
  if (!agent) throw new Error('mTLS 인증서를 로드할 수 없습니다.');

  const response = await fetch(`${TOSS_API_BASE}/api-partner/v1/apps-in-toss/user/oauth2/refresh-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      refreshToken,
    }),
    agent,
  });

  const data = await response.json();
  
  if (!response.ok || data.resultType === 'FAIL') {
    console.error('토스 토큰 갱신 실패:', data);
    throw new Error(data.error?.reason || '토큰 갱신 실패');
  }

  return data.success || data;
}

export default {
  getAccessToken,
  getUserInfo,
  refreshAccessToken,
};

