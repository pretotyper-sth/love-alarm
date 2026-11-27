import test from 'node:test';
import assert from 'node:assert/strict';
import { overview, sanitizeEvents, cleanParams } from './ubl.js';
const now = Date.parse('2026-11-27T12:00:00Z');
const event = (name, sessionId, offset, userId=null)=>({name,type:'click',sessionId,userId,createdAt:new Date(now-60000+offset)});
test('ordered funnels ignore reverse order, repeated events, and unrelated sessions; login keeps guest journey',()=>{
  const events=[event('alarm_list_screen','a',0),event('alarm_add_button_click','a',1),event('alarm_add_button_click','a',2),event('add_alarm_screen','a',3,'user'),event('add_alarm_submit','a',4,'user'),event('add_alarm_success','a',5,'user'),
    event('add_alarm_success','b',0),event('alarm_list_screen','b',1),event('alarm_add_button_click','b',2),event('add_alarm_screen','c',0)];
  const result=overview(events,7,now);
  assert.deepEqual(result.funnels[0].steps.map(x=>x.sessions),[2,2,1,1,1]);
  assert.equal(result.funnels[0].conversion,.5);
  assert.equal(result.loggedInUsers,1);assert.equal(result.guestSessions,2);assert.equal(result.totalSessions,3);
});
test('time window and KST date are explicit, empty denominators are null',()=>{
  const result=overview([event('login_fail','a',0),event('alarm_list_screen','old',-8*86400000)],7,now);
  assert.equal(result.totalEvents,1);assert.equal(result.failures[0].count,1);
  assert.equal(result.daily.at(-1).date,'2026-11-27');assert.equal(result.daily[0].events,0);assert.equal(result.funnels[0].conversion,null);
});
test('ingestion strips personal content and arbitrary properties, validates size and IDs, preserves retry IDs',()=>{
  const input={id:'unique_event_01',name:'login_success',type:'click',sessionId:'session_001',userId:'user_001',occurredAt:new Date(now-1000).toISOString(),params:{message:'private text',instagramId:'private',source:'home',has_message:true,reason:'personal error'}};
  const row=sanitizeEvents([input],now)[0];
  assert.deepEqual(row.params,{source:'home',has_message:true});assert.equal(row.id,input.id);assert.equal(+row.createdAt,now-1000);
  assert.throws(()=>sanitizeEvents(Array(51).fill(input),now));assert.throws(()=>sanitizeEvents([{...input,name:'<script>'}],now));
  assert.equal(+sanitizeEvents([{...input,occurredAt:'2000-01-01'}],now)[0].createdAt,now);
  assert.deepEqual(cleanParams({message:'secret',alarm_count:2,bad:NaN}),{alarm_count:2});
});
