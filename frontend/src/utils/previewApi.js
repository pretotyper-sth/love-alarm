import { MESSAGE_PASS_PRODUCTS } from '../../../backend/src/config/messagePassProducts.js';

// Local-only account and data. Never delegates preview actions to the real API.
export function createPreviewApi(storage) {
  const USER_KEY = 'love_alarm_preview_user';
  const LOGIN_KEY = 'love_alarm_preview_logged_in';
  const ALARMS_KEY = 'love_alarm_preview_alarms';
  const PASSES_KEY = 'love_alarm_preview_passes';
  const REACTIONS_KEY = 'love_alarm_preview_reactions';
  const REPORTS_KEY = 'love_alarm_preview_reports';
  const passes = () => read(PASSES_KEY, { balance: 0, orders: {}, opened: [] });
  const sampleMessages = [
    { id: 'preview-message-1', message: '네가 웃을 때 나도 모르게 기분이 좋아져. 오늘도 좋은 하루 보내!', createdAt: '2026-11-28T03:00:00Z', reactions: [] },
    { id: 'preview-message-2', message: '다음에 만나면 같이 커피 마시고 싶어 ☕', createdAt: '2026-11-27T09:00:00Z', reactions: [] },
    { id: 'preview-message-3', message: '오늘 발표 정말 멋졌어. 준비한 만큼 잘된 것 같아서 나도 기뻐!', createdAt: '2026-11-27T05:30:00Z', free: true, opened: true, reactions: [] },
    { id: 'preview-message-4', message: '어제 추천해 준 노래 들었어. 덕분에 퇴근길이 즐거웠어 😊', createdAt: '2026-11-26T09:00:00Z', opened: true, reactions: [] },
    { id: 'preview-message-5', message: '항상 먼저 인사해 줘서 고마워. 덕분에 하루를 기분 좋게 시작해.', createdAt: '2026-11-25T00:30:00Z', opened: true, reactions: [{ emoji: '😊' }] },
    { id: 'preview-message-6', message: '처음 만났을 때부터 꼭 전하고 싶은 말이 있었어.\n\n바쁜 날에도 주변 사람들을 챙기는 모습이 참 좋더라. 사소한 이야기도 끝까지 들어 주고, 누군가 힘들어 보이면 조용히 다가가 주는 그런 모습 말이야.\n\n이 메시지가 오늘 너에게 작은 응원이 됐으면 좋겠어. 너는 생각보다 훨씬 따뜻하고 멋진 사람이야. 다음에 만나면 나도 용기 내서 먼저 인사할게!', createdAt: '2026-11-24T09:00:00Z', free: true, opened: true, reactions: [] },
    { id: 'preview-message-7', message: '이번 주말에 시간 괜찮으면 같이 산책할래? 하고 싶은 이야기가 있어.', createdAt: '2026-11-23T06:00:00Z', reactions: [] },
    { id: 'preview-message-8', message: '응원해! ❤️', createdAt: '2026-11-22T02:00:00Z', free: true, opened: true, reactions: [] },
  ];
  const read = (key, fallback) => {
    try { return JSON.parse(storage.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const write = (key, value) => storage.setItem(key, JSON.stringify(value));
  const viewMessage = (message, state = passes()) => {
    const { free, opened, ...publicMessage } = message;
    const isOpened = !!opened || state.opened.includes(message.id);
    const locked = !free && !isOpened;
    const reaction = read(REACTIONS_KEY, {})[message.id];
    return { ...publicMessage, locked, opened: isOpened, message: locked ? null : message.message, reactions: reaction ? [{ emoji: reaction }] : message.reactions };
  };
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
    const readIds = read('love_alarm_read_received_message_ids', []);
    write('love_alarm_read_received_message_ids', [...new Set([...readIds, ...sampleMessages.filter(message => message.opened).map(message => message.id)])]);
    const state = passes();
    const reports = read(REPORTS_KEY, {});
    return { instagramId: user.instagramId, messages: sampleMessages.filter(message => !reports[message.id]).map(message => viewMessage(message, state)) };
  };
  const noPurchase = async () => { throw new Error('이 기능은 로컬 미리보기에서 지원하지 않아요.'); };
  const messagePassIAP = {
    getProductItemList: async () => ({ products: MESSAGE_PASS_PRODUCTS.map(product => ({ ...product, displayAmount: `${product.amount.toLocaleString('ko-KR')}원` })) }),
    createOneTimePurchaseOrder: ({ options, onEvent, onError }) => {
      requireUser();
      const product = MESSAGE_PASS_PRODUCTS.find(item => item.sku === options.sku);
      if (!product) throw new Error('미리보기 상품을 확인해 주세요.');
      const orderId = `preview-${crypto.randomUUID()}`;
      const state = passes();
      state.orders[orderId] = { sku: product.sku, granted: false };
      write(PASSES_KEY, state);
      const timer = setTimeout(async () => {
        try {
          if (!await options.processProductGrant({ orderId })) throw new Error('미리보기 지급 실패');
          onEvent({ type: 'success', data: { orderId } });
        } catch (error) { onError(error); }
      }, 300);
      return () => clearTimeout(timer);
    },
    getPendingOrders: async () => {
      requireUser();
      return { orders: Object.entries(passes().orders).filter(([, order]) => !order.granted).map(([orderId, order]) => ({ orderId, sku: order.sku })) };
    },
    completeProductGrant: async () => { requireUser(); return true; },
  };

  return {
    isPreview: true,
    messagePassIAP,
    resetMessagePassPreview: () => { requireUser(); storage.removeItem(PASSES_KEY); },
    login,
    tossLogin: login,
    hasSession: () => !!currentUser(),
    getCurrentUser: currentUser,
    withdrawAccount: async () => {
      requireUser();
      for (const key of [USER_KEY, LOGIN_KEY, ALARMS_KEY, PASSES_KEY, REACTIONS_KEY, REPORTS_KEY]) storage.removeItem(key);
      storage.removeItem('love_alarm_user');
      storage.removeItem('love_alarm_instagram_verified_username');
      return { success: true };
    },
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
    getMessagePassWallet: async () => { requireUser(); return { balance: passes().balance, enabled: true, products: MESSAGE_PASS_PRODUCTS, entries: [] }; },
    grantMessagePassOrder: async orderId => {
      requireUser();
      const state = passes(), order = state.orders[orderId];
      const product = MESSAGE_PASS_PRODUCTS.find(item => item.sku === order?.sku);
      if (!product) throw new Error('미리보기 주문을 찾을 수 없어요.');
      const alreadyGranted = order.granted;
      if (!alreadyGranted) { state.balance += product.quantity; order.granted = true; write(PASSES_KEY, state); }
      return { balance: state.balance, alreadyGranted };
    },
    syncMessagePassRefund: noPurchase,
    openReceivedMessage: async id => {
      await receivedState();
      const message = sampleMessages.find(item => item.id === id);
      if (!message || read(REPORTS_KEY, {})[id]) throw new Error('미리보기 메시지를 찾을 수 없어요.');
      const state = passes();
      if (!state.opened.includes(id)) {
        if (!message.free && !message.opened) {
          if (state.balance < 1) throw Object.assign(new Error('열람권이 필요해요.'), { status: 402, code: 'PASS_REQUIRED' });
          state.balance--;
        }
        state.opened.push(id); write(PASSES_KEY, state);
      }
      return { message: viewMessage(message, state), balance: state.balance };
    },
    reactToMessage: async (id, emoji) => {
      const { messages } = await receivedState();
      const message = messages.find(item => item.id === id);
      if (!message) throw new Error('미리보기 메시지를 찾을 수 없어요.');
      if (!['❤️', '😊', '🤔', '😳', '🥹'].includes(emoji)) throw new Error('유효하지 않은 이모지예요.');
      if (!passes().opened.includes(id) && !sampleMessages.find(item => item.id === id).opened) throw new Error('메시지를 먼저 열어 주세요.');
      const reactions = read(REACTIONS_KEY, {});
      const chosen = message.reactions[0]?.emoji || emoji;
      reactions[id] = chosen; write(REACTIONS_KEY, reactions);
      return { reaction: { emoji: chosen } };
    },
    reportMessage: async (id, reason) => {
      const { messages } = await receivedState();
      if (!messages.some(item => item.id === id) && !read(REPORTS_KEY, {})[id]) throw new Error('미리보기 메시지를 찾을 수 없어요.');
      if (!['불쾌하거나 과도하게 성적인 내용', '욕설, 혐오, 위협이 느껴져요', '스팸 또는 광고 같아요', '원치 않는 연락이라 불편해요'].includes(reason)) throw new Error('신고 사유를 선택해 주세요.');
      write(REPORTS_KEY, { ...read(REPORTS_KEY, {}), [id]: reason });
      return { success: true, reportId: `preview-report-${id}` };
    },
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
