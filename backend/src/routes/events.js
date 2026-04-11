import { Router } from 'express';

const router = Router();

const DASHBOARD_SECRET = process.env.DASHBOARD_SECRET || 'LA100%';

function requireDashAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (auth) {
    const [scheme, encoded] = auth.split(' ');
    if (scheme === 'Basic') {
      const decoded = Buffer.from(encoded, 'base64').toString();
      const [, pass] = decoded.split(':');
      if (pass === DASHBOARD_SECRET) return next();
    }
  }
  if (req.query.secret === DASHBOARD_SECRET) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// POST /api/events — 이벤트 수집 (프론트에서 배치 전송)
router.post('/', async (req, res) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events) || events.length === 0) {
      return res.json({ ok: true });
    }

    const data = events
      .filter(e => e.type && e.name)
      .map(e => ({
        type: e.type,
        name: e.name,
        params: e.params || null,
        userId: e.userId || null,
        sessionId: e.sessionId || null,
      }));

    if (data.length > 0) {
      await req.prisma.analyticsEvent.createMany({ data });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[events] ingest error:', err.message);
    res.json({ ok: true });
  }
});

// GET /api/events/summary — 기간별 이벤트 요약
router.get('/summary', requireDashAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const since = new Date(Date.now() - days * 86400000);

    const [totalCount, uniqueUsers, dailyCounts, topEvents] = await Promise.all([
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
    ]);

    res.json({
      days,
      totalCount,
      uniqueUsers,
      dailyCounts,
      topEvents: topEvents.map(e => ({ name: e.name, count: e._count })),
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

// GET /api/events/daily-users — 일별 유니크 유저/세션 수
router.get('/daily-users', requireDashAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const since = new Date(Date.now() - days * 86400000);

    const data = await req.prisma.$queryRaw`
      SELECT DATE("createdAt") as date,
             COUNT(DISTINCT "sessionId")::int as sessions,
             COUNT(DISTINCT "userId")::int as users
      FROM "AnalyticsEvent"
      WHERE "createdAt" >= ${since}
      GROUP BY DATE("createdAt")
      ORDER BY date
    `;

    res.json({ days, data });
  } catch (err) {
    console.error('[events] daily-users error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events/param-distribution — 특정 이벤트의 params 값 분포
router.get('/param-distribution', requireDashAuth, async (req, res) => {
  try {
    const { name, key } = req.query;
    if (!name || !key) return res.status(400).json({ error: 'name and key required' });

    const days = parseInt(req.query.days) || 7;
    const since = new Date(Date.now() - days * 86400000);

    const events = await req.prisma.analyticsEvent.findMany({
      where: { name, createdAt: { gte: since }, params: { not: null } },
      select: { params: true },
    });

    const dist = {};
    for (const e of events) {
      const val = e.params?.[key];
      if (val !== undefined && val !== null) {
        const label = String(val);
        dist[label] = (dist[label] || 0) + 1;
      }
    }

    const sorted = Object.entries(dist)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

    res.json({ name, key, days, distribution: sorted });
  } catch (err) {
    console.error('[events] param-distribution error:', err);
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

// POST /api/events/query — 대시보드 SQL 쿼리 실행 (SELECT만 허용)
router.post('/query', requireDashAuth, async (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql || typeof sql !== 'string') {
      return res.status(400).json({ error: 'sql required' });
    }

    const normalized = sql.trim().replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '');
    const firstWord = normalized.split(/\s+/)[0].toUpperCase();
    if (firstWord !== 'SELECT') {
      return res.status(403).json({ error: 'SELECT 쿼리만 허용됩니다' });
    }

    const forbidden = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXEC|EXECUTE)\b/i;
    if (forbidden.test(normalized)) {
      return res.status(403).json({ error: '읽기 전용: 데이터 변경 쿼리는 차단됩니다' });
    }

    const start = Date.now();
    const rows = await req.prisma.$queryRawUnsafe(sql);
    const elapsed = Date.now() - start;

    const limited = Array.isArray(rows) ? rows.slice(0, 500) : rows;

    res.json({
      rows: limited,
      rowCount: Array.isArray(rows) ? rows.length : 0,
      truncated: Array.isArray(rows) && rows.length > 500,
      elapsed,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
