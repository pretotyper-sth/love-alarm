export function accountBalance(account, userId, fallback = null) {
  if (!userId) return null;
  return account?.userId === userId ? account.balance ?? fallback : fallback;
}

// Confirmed display data only. Granting, spending and deletion still use the authenticated server.
export function createAccountData(base, storage, now = Date.now) {
  const accounts = new Map(), listeners = new Set();
  const currentId = () => base.hasSession() ? base.getCurrentUser()?.id : null;
  const storageKey = id => `love_alarm_account_data_v1:${id}`;
  const day = time => new Date(time + 9 * 3600000).toISOString().slice(0, 10);
  const notify = () => listeners.forEach(listener => listener());
  function entry(id) {
    if (!accounts.has(id)) {
      let data = null;
      try {
        const cached = JSON.parse(storage.getItem(storageKey(id)) || 'null');
        if (cached?.data?.userId === id && now() - cached.savedAt < 86400000) data = cached.data;
      } catch { /* Restricted storage must not block the app. */ }
      accounts.set(id, { data, freshAt: 0, revision: 0, mutations: 0, overlap: false, summary: null, wallet: null });
    }
    return accounts.get(id);
  }
  function patch(id, values) {
    if (currentId() !== id) return;
    const state = entry(id);
    state.data = { error: false, ...state.data, ...values, userId: id };
    if (state.data.instagram && state.data.alarms && state.data.checkin) state.data.error = false;
    try { storage.setItem(storageKey(id), JSON.stringify({ savedAt: now(), data: state.data })); } catch { /* Memory cache remains available. */ }
    notify();
  }
  function clear(id) {
    if (id) {
      const state = accounts.get(id);
      if (state) state.revision++;
      accounts.delete(id);
      try { storage.removeItem(storageKey(id)); } catch { /* Memory state was cleared. */ }
    }
    notify();
  }
  async function refresh({ force = false } = {}) {
    const id = currentId();
    if (!id) return null;
    const state = entry(id);
    if (state.summary) return state.summary;
    if (!force && state.freshAt && now() - state.freshAt < 10000 && day(state.freshAt) === day(now())) return state.data;
    const revision = state.revision;
    const request = Promise.resolve().then(() => base.getRewardSummary()).then(result => {
      if (currentId() === id && state === accounts.get(id) && state.revision === revision && !state.mutations) {
        state.freshAt = now(); patch(id, result);
      }
      return state.data;
    }).catch(error => {
      if (currentId() === id && state === accounts.get(id) && state.revision === revision && (!state.data?.instagram || !state.data?.alarms || !state.data?.checkin)) {
        state.data = { ...state.data, userId: id, error: true }; notify();
      }
      throw error;
    }).finally(() => { if (state.summary === request) state.summary = null; });
    state.summary = request;
    return request;
  }
  const api = { ...base, getRewardSummary: refresh };
  api.getMessagePassWallet = async (...args) => {
    const id = currentId();
    if (!id) return base.getMessagePassWallet(...args);
    const state = entry(id);
    if (state.wallet) return state.wallet;
    const revision = state.revision;
    const request = Promise.resolve().then(() => base.getMessagePassWallet(...args)).then(result => {
      if (state.revision === revision && !state.mutations) patch(id, { balance: result.balance });
      return state.revision !== revision && state.data?.balance != null ? { ...result, balance: state.data.balance } : result;
    }).finally(() => { if (state.wallet === request) state.wallet = null; });
    state.wallet = request;
    return request;
  };
  const changes = {
    claimInstagramReward: result => ({ instagram: { claimed: result.claimed, verified: result.verified }, balance: result.balance }),
    claimAlarmReward: result => ({ alarms: { count: result.count, rewards: result.rewards }, balance: result.balance }),
    claimCheckinPass: result => ({ checkin: result, balance: result.balance }),
    checkinMessagePass: result => ({ checkin: result, balance: result.balance }),
    grantMessagePassOrder: result => ({ balance: result.balance }),
    openReceivedMessage: result => ({ balance: result.balance }),
    syncMessagePassRefund: result => result.refunded ? { balance: null } : {},
    verifyInstagramConfirm: () => ({ instagram: null }),
    disconnectInstagramAuth: () => ({ instagram: null }),
    createAlarm: () => ({ alarms: null }),
  };
  for (const [name, changed] of Object.entries(changes)) {
    if (typeof base[name] !== 'function') continue;
    api[name] = async (...args) => {
      const id = currentId();
      if (!id) return base[name](...args);
      const state = entry(id);
      state.revision++; state.freshAt = 0;
      if (++state.mutations > 1) state.overlap = true;
      try {
        const result = await base[name](...args);
        const values = changed(result);
        if (state.overlap && 'balance' in values) values.balance = null;
        if (state === accounts.get(id)) patch(id, values);
        return result;
      } finally {
        state.revision++; state.mutations--;
        if (!state.mutations && currentId() === id && (state.overlap || state.data?.instagram == null || state.data?.alarms == null || state.data?.balance == null)) {
          state.overlap = false;
          // A read started before the mutation must finish before a fresh snapshot replaces it.
          void Promise.resolve(state.summary).catch(() => {}).then(() => refresh({ force: true })).catch(() => {});
        }
      }
    };
  }
  for (const name of ['login', 'tossLogin']) if (typeof base[name] === 'function') {
    api[name] = async (...args) => {
      const result = await base[name](...args);
      void refresh().catch(() => {});
      return result;
    };
  }
  api.logout = () => { const id = currentId(); base.logout(); clear(id); };
  api.withdrawAccount = async (...args) => { const id = currentId(); const result = await base.withdrawAccount(...args); clear(id); return result; };
  return {
    api,
    getSnapshot: () => { const id = currentId(); return id ? entry(id).data : null; },
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
  };
}
