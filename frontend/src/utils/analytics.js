import { api } from './api';
import { cleanParams } from '../../../backend/src/services/ubl.js';
import { Analytics } from '@apps-in-toss/web-framework';
const IS_DEV = import.meta.env.DEV;
const API_URL = IS_DEV ? '/__ubl/events' : `${import.meta.env.VITE_API_URL || 'https://love-alarm-server.onrender.com'}/api/events`;
let eventBuffer = [], flushTimer = null, sending = false, lastEventAt = 0;
function getSessionId() {
  let sid = sessionStorage.getItem('_sid');
  if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem('_sid', sid); }
  return sid;
}
function queueEvent(type, name, params) {
  let userId = null;
  try { userId = api.hasSession() ? api.getCurrentUser()?.id : null; } catch { /* Guest browsing continues. */ }
  lastEventAt = Math.max(Date.now(), lastEventAt + 1);
  eventBuffer.push({id:crypto.randomUUID(), type,name,params:{...params,auth_state:userId?'authenticated':'guest'},userId,sessionId:getSessionId(),occurredAt:new Date(lastEventAt).toISOString()});
  if (eventBuffer.length > 1000) eventBuffer.shift();
  if (!flushTimer) flushTimer = setTimeout(flushEvents, 1500);
}
async function flushEvents() {
  clearTimeout(flushTimer); flushTimer = null;
  if (sending || !eventBuffer.length) return;
  sending = true;
  const batch = eventBuffer.slice(0,50);
  try {
    const result = await fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({events:batch}),keepalive:true});
    if (result.ok || result.status === 400 || result.status === 413) {
      const sent = new Set(batch.map(e=>e.id)); eventBuffer = eventBuffer.filter(e=>!sent.has(e.id));
    }
  } catch { /* Retry transient failures with the same event IDs. */ }
  finally { sending=false; if(eventBuffer.length) flushTimer=setTimeout(flushEvents,5000); }
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden') void flushEvents();});
window.addEventListener('pagehide',()=>{void flushEvents();});
function track(type,name,params={}) {
  const safeParams = cleanParams(params);
  try { queueEvent(type,name,safeParams); } catch { /* Restricted browser storage must not block the product. */ }
  if(IS_DEV) return;
  try { Promise.resolve(Analytics[type]({log_name:name,...safeParams})).catch(() => {}); } catch { /* SDK analytics must never block the action. */ }
}
export const logScreen = (name,params) => track('screen',name,params);
export const logClick = (name,params) => track('click',name,params);
export const logImpression = (name,params) => track('impression',name,params);
