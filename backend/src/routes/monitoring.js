import { Router } from 'express';
import { databaseStatus, monitorAlerts, monitoringAuth } from '../services/monitoring.js';

export function createMonitoringRouter(requestMonitor) {
  const router = Router();
  router.use(monitoringAuth);
  let pending;
  router.get('/', async (req, res) => {
    // Concurrent probes share one DB check; the endpoint cannot fan out DB work.
    if (!pending) pending = databaseStatus(req.prisma).finally(() => { pending = null; });
    const database = await pending;
    const requests = requestMonitor.snapshot();
    const configuredQuota = Number(process.env.MONITORING_DB_QUOTA_MB);
    const quotaMb = Number.isFinite(configuredQuota) && configuredQuota > 0 ? configuredQuota : 500;
    const data = { requests, database, quotaMb, uptimeSeconds: Math.floor(process.uptime()) };
    const alerts = monitorAlerts(data, quotaMb);
    res.status(database.ok ? 200 : 503).json({ ...data, alerts, checkedAt: new Date().toISOString() });
  });
  return router;
}
