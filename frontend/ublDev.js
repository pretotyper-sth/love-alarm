import fs from 'node:fs';
import { Buffer } from 'node:buffer';
import { sanitizeEvents, overview } from '../backend/src/services/ubl.js';
export default function ublDev() {
  const events = new Map();
  return { name:'ubl-local-preview', apply:'serve', configureServer(server) {
    server.middlewares.use(async (req,res,next)=>{
      const url = new URL(req.url,'http://localhost');
      if(!['/admin.html','/__ubl/events','/__ubl/overview'].includes(url.pathname)) return next();
      if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) {res.statusCode=403;return res.end('Local preview only');}
      res.setHeader('Cache-Control','no-store');
      if(url.pathname==='/admin.html') {res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(fs.readFileSync(new URL('../backend/public/admin.html',import.meta.url),'utf8').replace('data-preview="false"','data-preview="true"'));}
      res.setHeader('Content-Type','application/json; charset=utf-8');
      if(url.pathname==='/__ubl/overview') {const days=Number(url.searchParams.get('days')||7);if(![1,7,14,30].includes(days)){res.statusCode=400;return res.end('{}');}return res.end(JSON.stringify(overview([...events.values()],days)));}
      if(req.method!=='POST'){res.statusCode=405;return res.end('{}');}
      try {
        let body=''; for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>32768)throw new Error('Too large');}
        for(const e of sanitizeEvents(JSON.parse(body).events))events.set(e.id,e);
        while(events.size>50000)events.delete(events.keys().next().value);
        res.end('{"ok":true}');
      } catch {res.statusCode=400;res.end('{"error":"Invalid events"}');}
    });
  }};
}
