import { Router } from 'express';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { sanitizeEvents, overview } from '../services/ubl.js';

const router = Router();

function requireDashAuth(req, res, next) {
  const secret = process.env.DASHBOARD_SECRET;
  if (!secret) return res.status(503).json({error:'DASHBOARD_SECRET 설정이 필요합니다.'});
  const auth = req.headers.authorization || '';
  let password = '';
  if (auth.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.slice(6),'base64').toString();
    password = decoded.slice(decoded.indexOf(':')+1);
  }
  const expected = Buffer.from(secret), actual = Buffer.from(password);
  if(actual.length === expected.length && timingSafeEqual(actual,expected)) return next();
  res.status(401).json({error:'Unauthorized'});
}

// POST /api/events — 이벤트 수집 (프론트에서 배치 전송)
router.post('/', async (req, res) => {
  try {
    const incoming = req.body.events;
    const data = sanitizeEvents(Array.isArray(incoming) ? incoming.map(e=>({...e,id:e?.id || randomUUID()})) : incoming);
    await req.prisma.analyticsEvent.createMany({ data, skipDuplicates: true });

    res.json({ ok: true });
  } catch (err) {
    console.error('[events] ingest error:', err.message);
    res.status(err.message.includes('이벤트') ? 400 : 503).json({ error: '이벤트를 저장하지 못했습니다.' });
  }
});

router.get('/overview', requireDashAuth, async (req, res) => {
  const days = Number(req.query.days || 7);
  if (![1,7,14,30].includes(days)) return res.status(400).json({error:'기간은 1, 7, 14, 30일 중 선택해 주세요.'});
  try {
    const events = await req.prisma.analyticsEvent.findMany({where:{createdAt:{gte:new Date(Date.now()-days*86400000)}},orderBy:{createdAt:'asc'},take:50001,select:{id:true,name:true,type:true,sessionId:true,userId:true,createdAt:true}});
    if(events.length>50000) return res.status(422).json({error:'선택 기간의 이벤트가 50,000개를 넘었습니다. 조회 기간을 줄여 주세요.'});
    res.set('Cache-Control','no-store').json(overview(events,days));
  } catch { res.status(503).json({error:'행동 로그를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'}); }
});

// GET /api/events/summary — 기간별 이벤트 요약
router.get('/summary', requireDashAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const since = new Date(Date.now() - days * 86400000);

    const [totalCount, uniqueUsers, dailyCounts, topEvents, firstEvent] = await Promise.all([
      req.prisma.analyticsEvent.count({ where: { createdAt: { gte: since } } }),

      req.prisma.analyticsEvent.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: since }, userId: { not: null } },
      }).then(r => r.length),

      req.prisma.$queryRaw`
        SELECT DATE("createdAt") as date, COUNT(*)::int as count
        FROM "AnalyticsEvent"
        WHERE "createdAt" >= ${since}
        GROUP BY DATE("createdAt")
        ORDER BY date
      `,

      req.prisma.analyticsEvent.groupBy({
        by: ['name'],
        where: { createdAt: { gte: since } },
        _count: true,
        orderBy: { _count: { name: 'desc' } },
        take: 20,
      }),

      req.prisma.analyticsEvent.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);

    res.json({
      days,
      totalCount,
      uniqueUsers,
      dailyCounts,
      topEvents: topEvents.map(e => ({ name: e.name, count: e._count })),
      firstEventAt: firstEvent?.createdAt ?? null,
    });
  } catch (err) {
    console.error('[events] summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events/funnel — 퍼널 분석
router.get('/funnel', requireDashAuth, async (req, res) => {
  try {
    const { steps } = req.query;
    if (!steps) return res.status(400).json({ error: 'steps parameter required' });

    const stepNames = steps.split(',').map(s => s.trim());
    const days = parseInt(req.query.days) || 7;
    const since = new Date(Date.now() - days * 86400000);

    const results = await Promise.all(
      stepNames.map(async (name) => {
        const count = await req.prisma.analyticsEvent.groupBy({
          by: ['sessionId'],
          where: { name, createdAt: { gte: since }, sessionId: { not: null } },
        });
        return { name, uniqueSessions: count.length };
      })
    );

    res.json({ days, steps: results });
  } catch (err) {
    console.error('[events] funnel error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events/top — 이벤트별 발생 횟수
router.get('/top', requireDashAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const since = new Date(Date.now() - days * 86400000);
    const type = req.query.type; // optional filter

    const where = { createdAt: { gte: since } };
    if (type) where.type = type;

    const results = await req.prisma.analyticsEvent.groupBy({
      by: ['name', 'type'],
      where,
      _count: true,
      orderBy: { _count: { name: 'desc' } },
      take: limit,
    });

    res.json({
      days,
      events: results.map(r => ({ name: r.name, type: r.type, count: r._count })),
    });
  } catch (err) {
    console.error('[events] top error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events/trend — 특정 이벤트의 일별 추이
router.get('/trend', requireDashAuth, async (req, res) => {
  try {
    const { names } = req.query;
    if (!names) return res.status(400).json({ error: 'names parameter required' });

    const nameList = names.split(',').map(s => s.trim());
    const days = parseInt(req.query.days) || 14;
    const since = new Date(Date.now() - days * 86400000);

    const data = await req.prisma.$queryRaw`
      SELECT DATE("createdAt") as date, "name", COUNT(*)::int as count
      FROM "AnalyticsEvent"
      WHERE "createdAt" >= ${since} AND "name" = ANY(${nameList})
      GROUP BY DATE("createdAt"), "name"
      ORDER BY date
    `;

    res.json({ days, data });
  } catch (err) {
    console.error('[events] trend error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
