import { Router } from 'express';
import tossAuth from '../services/tossAuth.js';

const router = Router();

// Basic Auth 검증용 (토스 연결 끊기 콜백) - 환경 변수에서 로드
const DISCONNECT_AUTH = {
  username: process.env.DISCONNECT_AUTH_USERNAME || 'love-alarm',
  password: process.env.DISCONNECT_AUTH_PASSWORD || 'disconnect-secret-2024',
};

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
    console.log('🔐 토스 토큰 발급 요청...');
    const tokenData = await tossAuth.getAccessToken(authorizationCode, referrer);
    console.log('📦 토스 토큰 응답:', JSON.stringify(tokenData, null, 2));
    
    // 토스 API는 camelCase로 응답 (accessToken, refreshToken)
    const accessToken = tokenData.accessToken;

    if (!accessToken) {
      console.error('❌ accessToken 없음! 응답:', tokenData);
      throw new Error('AccessToken을 받지 못했습니다.');
    }
    console.log('✅ 토스 토큰 발급 완료');

    // 2. 토스 API에서 사용자 정보 조회 (복호화 포함)
    console.log('👤 토스 사용자 정보 조회...');
    const userInfo = await tossAuth.getUserInfo(accessToken);
    console.log('✅ 토스 사용자 정보 조회 완료:', {
      userKey: userInfo.userKey,
      name: userInfo.name ? '***' : null,
      gender: userInfo.gender,
      birthday: userInfo.birthday ? '****-**-**' : null,
    });

    // 3. DB에 사용자 생성/업데이트
    // userKey가 숫자로 올 수 있으므로 문자열로 변환
    const tossUserId = String(userInfo.userKey);
    
    let user = await req.prisma.user.findUnique({
      where: { tossUserId },
    });

    let isNewUser = false;

    if (!user) {
      // 새 사용자 생성
      user = await req.prisma.user.create({
        data: { 
          tossUserId,
          name: userInfo.name || null,
          gender: userInfo.gender || null,
          birthday: userInfo.birthday ? new Date(userInfo.birthday) : null,
        },
      });
      isNewUser = true;
      console.log(`👤 새 사용자 가입: ${tossUserId}`);
    } else {
      // 기존 사용자 - 프로필 정보 업데이트 (새 정보가 있으면)
      const updateData = {};
      if (userInfo.name && !user.name) updateData.name = userInfo.name;
      if (userInfo.gender && !user.gender) updateData.gender = userInfo.gender;
      if (userInfo.birthday && !user.birthday) updateData.birthday = new Date(userInfo.birthday);

      if (Object.keys(updateData).length > 0) {
        user = await req.prisma.user.update({
          where: { tossUserId },
          data: updateData,
        });
        console.log(`👤 사용자 프로필 업데이트: ${tossUserId}`);
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

    if (!user) {
      // 새 사용자 생성
      user = await req.prisma.user.create({
        data: { 
          tossUserId,
          name: name || null,
          gender: gender || null,
          birthday: birthday ? new Date(birthday) : null,
        },
      });
      isNewUser = true;
      console.log(`👤 새 사용자 가입: ${tossUserId}, 이름: ${name || '미제공'}`);
    } else {
      // 기존 사용자 - 프로필 정보 업데이트 (새 정보가 있으면)
      const updateData = {};
      if (name && !user.name) updateData.name = name;
      if (gender && !user.gender) updateData.gender = gender;
      if (birthday && !user.birthday) updateData.birthday = new Date(birthday);

      if (Object.keys(updateData).length > 0) {
        user = await req.prisma.user.update({
          where: { tossUserId },
          data: updateData,
        });
        console.log(`👤 사용자 프로필 업데이트: ${tossUserId}`, updateData);
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
      console.log('🔒 연결 끊기 요청 - 인증 헤더 없음');
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    if (username !== DISCONNECT_AUTH.username || password !== DISCONNECT_AUTH.password) {
      console.log('🔒 연결 끊기 요청 - 인증 실패');
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
      console.log(`🔌 서비스 연결 끊김: ${tossUserId}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: '연결 끊기 처리 중 오류가 발생했습니다.' });
  }
});

export default router;
