export const FUNNELS = [
  { key: 'alarm', title: '알람 등록', steps: [['alarm_list_screen', '홈 방문'], ['alarm_add_button_click', '추가 클릭'], ['add_alarm_screen', '입력 화면'], ['add_alarm_submit', '등록 시도'], ['add_alarm_success', '등록 완료']] },
  { key: 'guest', title: '둘러보기 → 로그인', steps: [['guest_alarm_intro_view', '서비스 소개'], ['guest_alarm_login_click', '로그인 CTA'], ['login_start', '로그인 실행'], ['login_success', '로그인 완료'], ['add_alarm_screen', '입력 화면']] },
  { key: 'message', title: '메시지 확인', steps: [['messages_screen', '메시지함'], ['message_open_click', '메시지 선택'], ['message_detail_open', '열람 완료']] },
  { key: 'purchase', title: '열람권 구매', steps: [['message_pass_sheet_view', '열람권 화면'], ['message_pass_purchase_start', '구매 시작'], ['message_pass_purchase_success', '구매 완료'], ['message_pass_use_success', '열람권 사용']] },
  { key: 'pass_use', title: '열람권 사용', steps: [['message_pass_sheet_view', '열람권 화면'], ['message_pass_use_start', '사용 시도'], ['message_pass_use_success', '열람 완료']] },
  { key: 'reaction', title: '메시지 반응', steps: [['message_detail_open', '메시지 열람'], ['message_reaction_start', '반응 시도'], ['message_reaction_success', '반응 완료']] },
  { key: 'report', title: '메시지 신고', steps: [['message_report_start', '신고 제출'], ['message_report_success', '신고 완료']] },
  { key: 'instagram', title: '인스타그램 인증', steps: [['instagram_verify_start', '코드 요청'], ['instagram_verify_code_sent', '코드 발급'], ['instagram_verify_success', '인증 완료']] },
];
const types = new Set(['screen', 'click', 'impression']);
const keys = new Set(['source', 'auth_state', 'tab', 'field', 'type', 'status', 'product', 'pass_balance', 'has_message', 'alarm_count', 'slot_used', 'slot_max', 'day_count', 'checkin_days', 'streak', 'badge_count', 'value']);
export function cleanParams(input = {}) {
  const params = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (keys.has(key) && (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value)))) params[key] = value;
  }
  return params;
}
export function sanitizeEvents(events, now = Date.now()) {
  if (!Array.isArray(events) || !events.length || events.length > 50) throw new Error('한 번에 1~50개 이벤트를 전송해 주세요.');
  return events.map(e => {
    if (!e || !types.has(e.type) || !/^[a-z][a-z0-9_]{0,79}$/.test(e.name || '') || !/^[a-zA-Z0-9_-]{8,80}$/.test(e.sessionId || '') || !/^[a-zA-Z0-9_-]{8,80}$/.test(e.id || '')) throw new Error('이벤트 형식이 올바르지 않습니다.');
    const params = cleanParams(e.params);
    const time = Date.parse(e.occurredAt);
    return { id: e.id, type: e.type, name: e.name, sessionId: e.sessionId, userId: typeof e.userId === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(e.userId) ? e.userId : null, params, createdAt: new Date(Number.isFinite(time) && Math.abs(time - now) < 86400000 ? time : now) };
  });
}
export function overview(events, days = 7, now = Date.now()) {
  const start = now - days * 86400000;
  const rows = events.filter(e => +new Date(e.createdAt) >= start && +new Date(e.createdAt) <= now).sort((a,b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  const sessions = new Map(), users = new Set(), names = new Map(), daily = new Map();
  for (let t=start; t<=now+86400000; t+=86400000) {
    const date = new Date(Math.min(t,now)+9*3600000).toISOString().slice(0,10);
    daily.set(date,{date,events:0,sessions:new Set()});
  }
  for (const e of rows) {
    if (e.sessionId) { if (!sessions.has(e.sessionId)) sessions.set(e.sessionId, []); sessions.get(e.sessionId).push(e); }
    if (e.userId) users.add(e.userId);
    const count = names.get(e.name) || {name:e.name,type:e.type,count:0}; count.count++; names.set(e.name,count);
    const date = new Date(+new Date(e.createdAt) + 9*3600000).toISOString().slice(0,10);
    if (!daily.has(date)) daily.set(date,{date,events:0,sessions:new Set()});
    daily.get(date).events++; if(e.sessionId) daily.get(date).sessions.add(e.sessionId);
  }
  const funnels = FUNNELS.map(f => {
    const counts = f.steps.map(()=>0);
    for (const journey of sessions.values()) { let step=0; for(const e of journey) { if(e.name===f.steps[step]?.[0]) { counts[step++]++; if(step===f.steps.length) break; } } }
    return {...f, steps:f.steps.map(([name,label],i)=>({name,label,sessions:counts[i],conversion:i && counts[i-1] ? counts[i]/counts[i-1] : null,dropOff:i ? counts[i-1]-counts[i] : 0})), conversion:counts[0] ? counts.at(-1)/counts[0] : null};
  });
  return { days, totalEvents:rows.length, totalSessions:sessions.size, loggedInUsers:users.size, guestSessions:[...sessions.values()].filter(j=>!j.some(e=>e.userId)).length,
    daily:[...daily.values()].map(d=>({...d,sessions:d.sessions.size})), funnels,
    topEvents:[...names.values()].sort((a,b)=>b.count-a.count),
    failures:[...names.values()].filter(e=>/_(fail|failed|cancel)$/.test(e.name)),
    recent:rows.slice(-50).reverse().map(e=>({name:e.name,type:e.type,createdAt:e.createdAt,authState:e.userId?'로그인':'비로그인'})),
    definition:'선택 기간 안에서 같은 세션이 순서대로 도달한 단계만 집계합니다. 재시도는 세션당 한 번입니다. 세션은 탭 단위이며 비로그인 후 로그인해도 이어집니다. 일별 추이는 한국 시간 기준입니다.', generatedAt:new Date(now).toISOString() };
}
