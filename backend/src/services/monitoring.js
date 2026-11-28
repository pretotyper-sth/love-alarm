import { timingSafeEqual } from 'node:crypto';

const LIMITS = [100, 250, 500, 1000, 2000, 3000, 5000, 10000, Infinity];
export function monitoringAuth(req, res, next) {
  const expected = Buffer.from(process.env.MONITORING_TOKEN || '');
  const actual = Buffer.from((req.headers.authorization || '').replace(/^Bearer /, ''));
  res.set('Cache-Control', 'no-store');
  if (expected.length < 32) return res.status(503).json({ error: 'Monitoring is not configured' });
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// Fixed-size time buckets. Never retain URLs, account IDs, request bodies, or raw errors.
export function createRequestMonitor(now = Date.now) {
  const buckets = new Map();
  function prune() {
    const cutoff = Math.floor(now() / 60000) - 5;
    for (const minute of buckets.keys()) if (minute <= cutoff) buckets.delete(minute);
  }
  function record(status, durationMs) {
    prune();
    const minute = Math.floor(now() / 60000);
    if (!buckets.has(minute)) buckets.set(minute, { count: 0, errors: 0, slow: 0, histogram: LIMITS.map(() => 0) });
    const bucket = buckets.get(minute);
    bucket.count++;
    if (status >= 500) bucket.errors++;
    if (durationMs > 3000) bucket.slow++;
    bucket.histogram[LIMITS.findIndex(limit => durationMs <= limit)]++;
  }
  return {
    record,
    middleware(req, res, next) {
      if (!req.path.startsWith('/api/')) return next();
      const start = performance.now();
      res.once('finish', () => record(res.statusCode, performance.now() - start));
      next();
    },
    snapshot() {
      prune();
      const count = [...buckets.values()].reduce((sum, b) => sum + b.count, 0);
      const errors = [...buckets.values()].reduce((sum, b) => sum + b.errors, 0);
      const slow = [...buckets.values()].reduce((sum, b) => sum + b.slow, 0);
      const histogram = LIMITS.map((_, i) => [...buckets.values()].reduce((sum, b) => sum + b.histogram[i], 0));
      let cumulative = 0;
      const p95 = count ? LIMITS[histogram.findIndex(n => (cumulative += n) >= Math.ceil(count * .95))] : null;
      return { windowMinutes: 5, count, errors, errorRate: count ? errors / count : 0, slow, slowRate: count ? slow / count : 0, p95UpperMs: Number.isFinite(p95) ? p95 : count ? 10001 : null };
    },
  };
}

export async function databaseStatus(prisma) {
  const start = performance.now();
  try {
    const rows = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '2000ms'`;
      return tx.$queryRaw`SELECT pg_database_size(current_database()) AS bytes,
        (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) AS connections,
        current_setting('max_connections')::int AS max_connections`;
    }, { maxWait: 1500, timeout: 3000 });
    const row = rows[0];
    return { ok: true, durationMs: Math.round(performance.now() - start), bytes: Number(row.bytes), connections: Number(row.connections), maxConnections: Number(row.max_connections) };
  } catch {
    return { ok: false, durationMs: Math.round(performance.now() - start) };
  }
}

export function monitorAlerts({ requests, database }, quotaMb = 500) {
  const alerts = [];
  if (!database.ok) alerts.push('DB_CONNECTION_FAILED');
  if (database.ok && database.durationMs > 1000) alerts.push('DB_LATENCY_HIGH');
  if ((requests.count >= 20 && requests.errorRate >= .05) || (requests.count < 20 && requests.errors >= 3)) alerts.push('API_ERROR_RATE_HIGH');
  if (requests.count >= 20 && requests.slowRate >= .05) alerts.push('API_LATENCY_HIGH');
  if (database.ok && database.bytes >= quotaMb * 1024 * 1024 * .8) alerts.push('DB_CAPACITY_HIGH');
  if (database.ok && database.connections >= database.maxConnections * .8) alerts.push('DB_CONNECTIONS_HIGH');
  return alerts;
}
