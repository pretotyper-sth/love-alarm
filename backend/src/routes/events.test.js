import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import router from './events.js';

test('event API validates batches, deduplicates retry IDs, protects dashboard and enforces limits',async()=>{
  const previous=process.env.DASHBOARD_SECRET;process.env.DASHBOARD_SECRET='test-private-dashboard';
  const rows=new Map();let oversized=false;
  const app=express();app.use(express.json());app.use((req,res,next)=>{req.prisma={analyticsEvent:{createMany:async({data,skipDuplicates})=>{assert.equal(skipDuplicates,true);for(const e of data)rows.set(e.id,e);},findMany:async()=>oversized?Array(50001).fill({}):[...rows.values()]}};next();});app.use('/api/events',router);
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  const url=`http://127.0.0.1:${server.address().port}/api/events`;
  const auth={Authorization:'Basic '+Buffer.from('admin:test-private-dashboard').toString('base64')};
  try {
    assert.equal((await fetch(url+'/overview')).status,401);
    assert.equal((await fetch(url+'/overview?secret=test-private-dashboard')).status,401);
    assert.equal((await fetch(url+'/overview?days=999',{headers:auth})).status,400);
    const event={id:'event_unique_01',type:'screen',name:'alarm_list_screen',sessionId:'session_12345'};
    for(let i=0;i<2;i++)assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({events:[event]})})).status,200);
    assert.equal(rows.size,1);
    const response=await fetch(url+'/overview',{headers:auth});assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await response.json()).totalEvents,1);
    assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({events:[{name:'bad'}]})})).status,400);
    oversized=true;assert.equal((await fetch(url+'/overview',{headers:auth})).status,422);
    delete process.env.DASHBOARD_SECRET;assert.equal((await fetch(url+'/overview',{headers:auth})).status,503);
  } finally {if(previous===undefined)delete process.env.DASHBOARD_SECRET;else process.env.DASHBOARD_SECRET=previous;await new Promise(resolve=>server.close(resolve));}
});
