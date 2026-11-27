import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { appLogin } from '@apps-in-toss/web-framework';
import { api } from '../utils/api';
import { restoreMessagePassOrders } from '../utils/messagePassPurchase';
import { restoreAuthUser } from '../utils/auth.js';
import { LoginPrompt } from '../components/LoginPrompt';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => api.hasSession() ? api.getCurrentUser() : null);
  const [loginTitle, setLoginTitle] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState('');
  const pendingLogin = useRef(null);

  useEffect(() => {
    if (!loginError || api.isPreview) return;
    const timer = setTimeout(() => setLoginError(''), 4000);
    return () => clearTimeout(timer);
  }, [loginError]);

  useEffect(() => {
    let active = true;
    void restoreAuthUser(api).then(restored => {
      if (!active) return;
      setUser(restored);
      if (restored) api.connectSocket();
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user?.id || !api.hasSession() || api.isPreview) return;
    let active = true;
    void (async () => {
      try {
        const wallet = await api.getMessagePassWallet();
        const { IAP } = await import('@apps-in-toss/web-framework');
        if (!active) return;
        await restoreMessagePassOrders({ IAP, skus: wallet.products.map(p => p.sku).filter(Boolean), grant: api.grantMessagePassOrder, syncRefund: api.syncMessagePassRefund });
      } catch { /* Purchase sheet provides a visible manual retry. */ }
    })();
    return () => { active = false; };
  }, [user?.id]);

  const finishLogin = useCallback((nextUser) => {
    const pending = pendingLogin.current;
    pendingLogin.current = null;
    setLoginTitle('');
    pending?.resolve(nextUser);
  }, []);

  const confirmLogin = useCallback(async () => {
    setLoginBusy(true);
    setLoginError('');
    try {
      let result;
      if (api.isPreview) {
        result = await api.login();
      } else {
        const { authorizationCode, referrer } = await appLogin();
        result = await api.tossLogin(authorizationCode, referrer);
      }
      setUser(result.user);
      api.connectSocket();
      finishLogin(result.user);
    } catch (error) {
      if (!/cancel|취소/i.test(String(error?.message || error?.code || ''))) {
        setLoginError('로그인하지 못했어요. 다시 시도해 주세요.');
      }
      if (!api.isPreview) finishLogin(null);
    } finally {
      setLoginBusy(false);
    }
  }, [finishLogin]);

  const requireLogin = useCallback((title = '이 기능을 이용하려면 로그인이 필요해요') => {
    if (user && api.hasSession()) return Promise.resolve(user);
    if (pendingLogin.current) return pendingLogin.current.promise;
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    pendingLogin.current = { promise, resolve };
    setLoginError('');
    if (api.isPreview) setLoginTitle(title);
    else void confirmLogin();
    return promise;
  }, [user, confirmLogin]);

  const updateInstagramId = async (instagramId) => {
    const result = await api.updateInstagramId(instagramId);
    setUser(result.user);
    return result.user;
  };

  const logout = () => {
    api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, updateInstagramId, logout, requireLogin }}>
      {children}
      {!api.isPreview && loginError && <div className="login-error-toast" role="alert">{loginError}</div>}
      {api.isPreview && loginTitle && <LoginPrompt title={loginTitle} busy={loginBusy} error={loginError}
        onConfirm={confirmLogin} onClose={() => { if (!loginBusy) finishLogin(null); }} />}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
