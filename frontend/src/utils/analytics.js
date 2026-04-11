import { Analytics } from '@apps-in-toss/web-framework';

const IS_DEV = import.meta.env.DEV;
const API_URL = import.meta.env.VITE_API_URL || 'https://love-alarm-production.up.railway.app';

let eventBuffer = [];
let flushTimer = null;

function getSessionId() {
  let sid = sessionStorage.getItem('_sid');
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem('_sid', sid);
  }
  return sid;
}

function queueEvent(type, name, params) {
  const userId = JSON.parse(localStorage.getItem('love_alarm_user') || '{}')?.id;
  eventBuffer.push({ type, name, params, userId, sessionId: getSessionId() });
  if (!flushTimer) flushTimer = setTimeout(flushEvents, 3000);
}

function flushEvents() {
  if (!eventBuffer.length) return;
  const batch = eventBuffer.splice(0);
  flushTimer = null;
  fetch(`${API_URL}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events: batch }),
  }).catch(() => {});
}

export function logScreen(name, params = {}) {
  queueEvent('screen', name, params);
  if (IS_DEV) return console.debug('[analytics:screen]', name, params);
  Analytics.screen({ log_name: name, ...params });
}

export function logClick(name, params = {}) {
  queueEvent('click', name, params);
  if (IS_DEV) return console.debug('[analytics:click]', name, params);
  Analytics.click({ log_name: name, ...params });
}

export function logImpression(name, params = {}) {
  queueEvent('impression', name, params);
  if (IS_DEV) return console.debug('[analytics:impression]', name, params);
  Analytics.impression({ log_name: name, ...params });
}
