import { Router } from 'express';
import tossAuth from '../services/tossAuth.js';

const router = Router();

// Basic Auth 검증용 (토스 연결 끊기 콜백) - 환경 변수에서 로드
const DISCONNECT_AUTH = {
  username: process.env.DISCONNECT_AUTH_USERNAME || 'love-alarm',
  password: process.env.DISCONNECT_AUTH_PASSWORD || 'disconnect-secret-2024',
};

/**
 * 생년월일 문자열을 안전하게 Date 객체로 변환
 * 토스에서 오는 birthday 형식: "YYYY-MM-DD" 또는 "YYYYMMDD" 등
 * @param {string} birthdayStr - 생년월일 문자열
 * @returns {Date|null} - 유효한 Date 객체 또는 null
 */
function parseBirthday(birthdayStr) {
  if (!birthdayStr || typeof birthdayStr !== 'string') {
    return null;
  }

  // 공백 제거
  const cleaned = birthdayStr.trim();
  if (!cleaned) {
    return null;
  }

  try {
    // 다양한 형식 시도
    let date;
    
    // YYYYMMDD 형식 (예: 19900101)
    if (/^\d{8}$/.test(cleaned)) {
      const year = cleaned.substring(0, 4);
      const month = cleaned.substring(4, 6);
      const day = cleaned.substring(6, 8);
      date = new Date(`${year}-${month}-${day}`);
    }
    // YYYY-MM-DD 또는 YYYY/MM/DD 형식
    else if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(cleaned)) {
      date = new Date(cleaned.replace(/\//g, '-'));
    }
    // 기타 형식
    else {
      date = new Date(cleaned);
    }

    // 유효성 검사
    if (isNaN(date.getTime())) {
      return null;
    }

    // 합리적인 범위 검사 (1900년 ~ 현재)
    const year = date.getFullYear();
    if (year < 1900 || year > new Date().getFullYear()) {
      return null;
    }

    return date;
  } catch (error) {
    return null;
  }
}

/**
 * POST /api/auth/toss-login
 * 토스 로그인 (전체 플로우 처리)
 * 
 * Body: { 
 *   authorizationCode: string,  // appLogin()에서 받은 인가 코드
 *   referrer: string            // appLogin()에서 받은 referrer
 * }
 * Response: { user: User, isNewUser: boolean }
 */
router.post('/toss-login', async (req, res) => {
  try {
    const { authorizationCode, referrer } = req.body;

    if (!authorizationCode || !referrer) {
      return res.status(400).json({ error: 'authorizationCode와 referrer가 필요합니다.' });
    }

    // 1. 토스 API에서 AccessToken 발급
    const tokenData = await tossAuth.getAccessToken(authorizationCode, referrer);
    const accessToken = tokenData.accessToken;

    if (!accessToken) {
      throw new Error('AccessToken을 받지 못했습니다.');
    }

    // 2. 토스 API에서 사용자 정보 조회 (복호화 포함)
    const userInfo = await tossAuth.getUserInfo(accessToken);

    // 3. DB에 사용자 생성/업데이트
    const tossUserId = String(userInfo.userKey);
    
    let user = await req.prisma.user.findUnique({
      where: { tossUserId },
    });

    let isNewUser = false;
    const parsedBirthday = parseBirthday(userInfo.birthday);

    if (!user) {
      // 새 사용자 생성
      user = await req.prisma.user.create({
        data: { 
          tossUserId,
          name: userInfo.name || null,
          gender: userInfo.gender || null,
          birthday: parsedBirthday,
        },
      });
      isNewUser = true;
    } else {
      // 기존 사용자 - 프로필 정보 업데이트 (새 정보가 있으면)
      const updateData = {};
      if (userInfo.name && !user.name) updateData.name = userInfo.name;
      if (userInfo.gender && !user.gender) updateData.gender = userInfo.gender;
      if (parsedBirthday && !user.birthday) updateData.birthday = parsedBirthday;

      if (Object.keys(updateData).length > 0) {
        user = await req.prisma.user.update({
          where: { tossUserId },
          data: updateData,
        });
      }
    }

    res.json({ user, isNewUser });
  } catch (error) {
    console.error('Toss login error:', error);
    res.status(500).json({ error: error.message || '토스 로그인 중 오류가 발생했습니다.' });
  }
});

/**
 * POST /api/auth/login
 * 토스 계정으로 로그인/회원가입 (간단 버전 - Mock용)
 * 
 * Body: { 
 *   tossUserId: string,      // 필수: 토스 계정 고유 ID
 *   name?: string,           // 선택: 사용자 이름 (토스 로그인 동의 항목)
 *   gender?: string,         // 선택: 성별 (male/female)
 *   birthday?: string        // 선택: 생년월일 (ISO 8601 형식)
 * }
 * Response: { user: User, isNewUser: boolean }
 */
router.post('/login', async (req, res) => {
  try {
    const { tossUserId, name, gender, birthday } = req.body;

    if (!tossUserId) {
      return res.status(400).json({ error: 'tossUserId가 필요합니다.' });
    }

    // 기존 사용자 찾기
    let user = await req.prisma.user.findUnique({
      where: { tossUserId },
    });

    let isNewUser = false;
    const parsedBirthday = parseBirthday(birthday);

    if (!user) {
      // 새 사용자 생성
      user = await req.prisma.user.create({
        data: { 
          tossUserId,
          name: name || null,
          gender: gender || null,
          birthday: parsedBirthday,
        },
      });
      isNewUser = true;
    } else {
      // 기존 사용자 - 프로필 정보 업데이트 (새 정보가 있으면)
      const updateData = {};
      if (name && !user.name) updateData.name = name;
      if (gender && !user.gender) updateData.gender = gender;
      if (parsedBirthday && !user.birthday) updateData.birthday = parsedBirthday;

      if (Object.keys(updateData).length > 0) {
        user = await req.prisma.user.update({
          where: { tossUserId },
          data: updateData,
        });
      }
    }

    res.json({ user, isNewUser });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '로그인 중 오류가 발생했습니다.' });
  }
});

/**
 * POST /api/auth/disconnect
 * 토스 앱에서 서비스 연결 끊기 콜백
 * (토스 콘솔에서 콜백 URL로 등록)
 * 
 * Header: Authorization: Basic {base64(username:password)}
 * Body: { tossUserId: string }
 */
router.post('/disconnect', async (req, res) => {
  try {
    // Basic Auth 검증
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    if (username !== DISCONNECT_AUTH.username || password !== DISCONNECT_AUTH.password) {
      return res.status(401).json({ error: '인증에 실패했습니다.' });
    }

    // 인증 성공 - 사용자 삭제 진행
    const { tossUserId } = req.body;

    if (!tossUserId) {
      return res.status(400).json({ error: 'tossUserId가 필요합니다.' });
    }

    // 사용자 삭제 (Cascade로 알람, 매칭도 함께 삭제됨)
    const user = await req.prisma.user.findUnique({
      where: { tossUserId },
    });

    if (user) {
      await req.prisma.user.delete({
        where: { tossUserId },
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: '연결 끊기 처리 중 오류가 발생했습니다.' });
  }
});

export default router;
