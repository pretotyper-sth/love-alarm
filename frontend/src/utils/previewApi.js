// Local-only account and data. Never delegates preview actions to the real API.
export function createPreviewApi(storage) {
  const USER_KEY = 'love_alarm_preview_user';
  const LOGIN_KEY = 'love_alarm_preview_logged_in';
  const ALARMS_KEY = 'love_alarm_preview_alarms';
  const read = (key, fallback) => {
    try { return JSON.parse(storage.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const write = (key, value) => storage.setItem(key, JSON.stringify(value));
  const currentUser = () => read(LOGIN_KEY, false) ? read(USER_KEY, null) : null;
  const requireUser = () => {
    const user = currentUser();
    if (!user) throw Object.assign(new Error('로그인이 필요해요.'), { status: 401 });
    return user;
  };
  const updateUser = patch => {
    const user = { ...requireUser(), ...patch };
    write(USER_KEY, user);
    write('love_alarm_user', user);
    return user;
  };
  const login = async () => {
    const saved = read(USER_KEY, null);
    const user = saved || { id: 'local-preview-user', tossUserId: 'local-preview', name: '미리보기 사용자', maxSlots: 2, instagramId: null, adFree: false };
    write(USER_KEY, user);
    write(LOGIN_KEY, true);
    write('love_alarm_user', user);
    return { user, isNewUser: !saved };
  };
  const getAlarms = async () => { requireUser(); return read(ALARMS_KEY, []); };
  let pendingUsername = '';
  const receivedState = async () => {
    const user = requireUser();
    if (!user.instagramId) throw Object.assign(new Error('인스타그램 인증이 필요해요.'), { code: 'INSTAGRAM_REQUIRED', status: 403 });
    return { instagramId: user.instagramId, messages: [] };
  };
  const noPurchase = async () => { throw new Error('로컬 미리보기에서는 실제 결제나 메시지 열람을 하지 않아요.'); };

  return {
    isPreview: true,
    login,
    tossLogin: login,
    hasSession: () => !!currentUser(),
    getCurrentUser: currentUser,
    getUser: async () => requireUser(),
    logout: () => {
      storage.removeItem(LOGIN_KEY);
      storage.removeItem('love_alarm_user');
      storage.removeItem('love_alarm_session');
      storage.removeItem('love_alarm_instagram_verified_username');
    },
    connectSocket: () => null,
    disconnectSocket: () => {},
    getSocket: () => null,
    onMatched: () => {}, offMatched: () => {}, onMatchCanceled: () => {}, offMatchCanceled: () => {},
    getAlarms,
    createAlarm: async (fromInstagramId, targetInstagramId, message) => {
      const user = requireUser();
      const alarms = await getAlarms();
      if (alarms.length >= user.maxSlots) throw new Error('알람 슬롯이 가득 찼어요.');
      if (alarms.some(alarm => alarm.targetInstagramId === targetInstagramId)) throw new Error('이미 등록한 알람이에요.');
      const alarm = { id: crypto.randomUUID(), userId: user.id, fromInstagramId, targetInstagramId, message, status: 'waiting', createdAt: new Date().toISOString() };
      write(ALARMS_KEY, [alarm, ...alarms]);
      return { alarm, matched: false };
    },
    deleteAlarm: async id => {
      write(ALARMS_KEY, (await getAlarms()).filter(alarm => alarm.id !== id));
      return { success: true };
    },
    getLikeCount: async () => ({ count: 0 }),
    getSentMessages: async () => (await getAlarms()).filter(alarm => alarm.message).map(alarm => ({ ...alarm, reactions: [] })),
    getReceivedMessageState: receivedState,
    getReceivedMessages: async () => (await receivedState()).messages,
    getMessagePassWallet: async () => { requireUser(); return { balance: 0, enabled: false, products: [], entries: [] }; },
    grantMessagePassOrder: noPurchase, syncMessagePassRefund: noPurchase, openReceivedMessage: noPurchase,
    reactToMessage: noPurchase, reportMessage: noPurchase,
    updateSettings: async patch => updateUser(patch),
    updateInstagramId: async instagramId => ({ user: updateUser({ instagramId }) }),
    disconnectInstagramAuth: async () => ({ user: updateUser({ instagramId: null }) }),
    purchaseSlot: async () => { const user = updateUser({ maxSlots: requireUser().maxSlots + 1 }); return { user, newMaxSlots: user.maxSlots }; },
    claimAdFree: async () => ({ user: updateUser({ adFree: true }) }),
    verifyInstagramStart: async instagramUsername => { requireUser(); pendingUsername = instagramUsername; return { sessionId: 'preview-verification', instagramUsername, expiresAt: new Date(Date.now() + 600000).toISOString() }; },
    verifyInstagramConfirm: async (_sessionId, code) => {
      requireUser();
      if (code !== '123456') throw new Error('미리보기 인증번호는 123456이에요.');
      updateUser({ instagramId: pendingUsername });
      return { ok: true, instagramUsername: pendingUsername, instagramUserId: 'preview-instagram' };
    },
    submitFeedback: async () => ({ success: true }),
    healthCheck: async () => true,
  };
}
