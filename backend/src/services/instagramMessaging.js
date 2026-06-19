// 새 Instagram Platform API는 graph.instagram.com 을 사용
const GRAPH_HOST = 'https://graph.instagram.com';
const GRAPH_VERSION = 'v22.0';

/**
 * Instagram-scoped 사용자 ID로 username 조회
 * @param {string} igScopedUserId
 * @param {string} accessToken
 */
export async function fetchInstagramUsername(igScopedUserId, accessToken) {
  const profile = await fetchInstagramUserProfile(igScopedUserId, accessToken);
  return profile?.username || null;
}

/**
 * Instagram-scoped 사용자 ID로 프로필 조회
 * @param {string} igScopedUserId
 * @param {string} accessToken
 */
export async function fetchInstagramUserProfile(igScopedUserId, accessToken) {
  const url = new URL(`${GRAPH_HOST}/${GRAPH_VERSION}/${igScopedUserId}`);
  url.searchParams.set('fields', 'id,username,is_user_follow_business');
  url.searchParams.set('access_token', accessToken);

  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[instagram] fetch profile failed', res.status, data);
    return null;
  }
  return {
    id: data.id ? String(data.id) : null,
    username: data.username ? String(data.username).toLowerCase() : null,
    isUserFollowBusiness: data.is_user_follow_business,
  };
}

/**
 * Instagram DM 전송
 * @param {string} recipientIgScopedId DM 받을 사용자(발신자)의 Instagram-scoped ID
 * @param {string} text
 */
export async function sendInstagramDm(recipientIgScopedId, text) {
  const igBusinessId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;

  if (!igBusinessId || !token) {
    console.error('[instagram] INSTAGRAM_BUSINESS_ACCOUNT_ID or INSTAGRAM_ACCESS_TOKEN missing');
    return { ok: false, error: 'missing_env' };
  }

  const url = new URL(`${GRAPH_HOST}/${GRAPH_VERSION}/${igBusinessId}/messages`);
  url.searchParams.set('access_token', token);

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientIgScopedId },
      message: { text },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[instagram] send DM failed', res.status, data);
    return { ok: false, error: data };
  }
  return { ok: true, data };
}
