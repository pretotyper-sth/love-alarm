import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';

export const insideToss = () => typeof window !== 'undefined' && !!window.ReactNativeWebView;
export const isExitRoot = path => path === '/' || path === '/alarms';

const dismissers = [];
const listeners = new Set();
export const backDismissStack = {
  subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  size: () => dismissers.length,
  push(dismiss) {
    dismissers.push(dismiss); listeners.forEach(listener => listener());
    return () => {
      const index = dismissers.indexOf(dismiss);
      if (index !== -1) dismissers.splice(index, 1);
      listeners.forEach(listener => listener());
    };
  },
  dismiss() {
    const top = dismissers.at(-1);
    if (!top) return false;
    top(); return true;
  },
};

export function useBackDismiss(open, onClose) {
  const latest = useRef(onClose);
  useLayoutEffect(() => { latest.current = onClose; }, [onClose]);
  useEffect(() => open ? backDismissStack.push(() => latest.current()) : undefined, [open]);
}

export function useBackDismissCount() {
  return useSyncExternalStore(backDismissStack.subscribe, backDismissStack.size);
}

export function subscribeNativeBack({ graniteEvent, onBack }) {
  // Always handle root back explicitly; native exit behavior varies across Toss hosts.
  return graniteEvent.addEventListener('backEvent', { onEvent: onBack, onError: () => {} });
}

export const exitNavigationBarOptions = open => ({ backgroundColor: open ? '#999999' : '#ffffff' });
let chromeUpdate = Promise.resolve();
export function updateExitNavigationBar(NavigationBar, open) {
  chromeUpdate = chromeUpdate.catch(() => {}).then(() => NavigationBar.setOptions(exitNavigationBarOptions(open)));
  return chromeUpdate;
}
