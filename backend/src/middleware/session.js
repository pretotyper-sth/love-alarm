import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const developmentSecret = randomBytes(32).toString('hex');
function secret() {
  const value = process.env.SESSION_SECRET;
  if (value && value.length >= 32) return value;
  if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET must contain at least 32 characters');
  return developmentSecret;
}

export function issueSession(userId, now = Date.now()) {
  const expiresAt = now + 7 * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: expiresAt, aud: 'love-alarm' })).toString('base64url');
  const signature = createHmac('sha256', secret()).update(payload).digest('base64url');
  return { token: `${payload}.${signature}`, expiresAt };
}

export function verifySession(token, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 2048) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expected = createHmac('sha256', secret()).update(payload).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.aud === 'love-alarm' && typeof data.sub === 'string' && data.exp > now ? data.sub : null;
  } catch { return null; }
}

export async function requireSession(req, res, next) {
  try {
    const userId = verifySession(req.headers.authorization?.replace(/^Bearer /, ''));
    req.user = userId ? await req.prisma.user.findUnique({ where: { id: userId } }) : null;
    if (!req.user) return res.status(401).json({ error: '다시 로그인해 주세요.', code: 'LOGIN_REQUIRED' });
    next();
  } catch (error) { next(error); }
}

export function requireAdmin(req, res, next) {
  const configured = Buffer.from(process.env.ADMIN_API_TOKEN || '');
  const supplied = Buffer.from(req.headers.authorization?.replace(/^Bearer /, '') || '');
  if (!configured.length || supplied.length !== configured.length || !timingSafeEqual(configured, supplied)) {
    return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  }
  next();
}
