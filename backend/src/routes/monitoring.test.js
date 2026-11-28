import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { createMonitoringRouter } from './monitoring.js';
import { createRequestMonitor } from '../services/monitoring.js';

test('monitor endpoint requires its dedicated token, denies query tokens, and exposes no database credentials', async () => {
  const previous = process.env.MONITORING_TOKEN;
  process.env.MONITORING_TOKEN = 'test-monitor-token-with-32-characters';
  let queries = 0;
  const app = express();
  app.use((req, res, next) => { req.prisma = { $transaction: async fn => { queries++; return fn({ $executeRaw: async () => {}, $queryRaw: async () => [{ bytes: 100n, connections: 1n, max_connections: 100 }] }); } }; next(); });
  app.use('/internal/monitor', createMonitoringRouter(createRequestMonitor()));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/internal/monitor`;
  try {
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url + '?token=' + process.env.MONITORING_TOKEN)).status, 401);
    assert.equal(queries, 0);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${process.env.MONITORING_TOKEN}` } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json();
    assert.equal(body.database.bytes, 100);
    assert.deepEqual(body.alerts, []);
    delete process.env.MONITORING_TOKEN;
    assert.equal((await fetch(url)).status, 503);
  } finally {
    if (previous === undefined) delete process.env.MONITORING_TOKEN; else process.env.MONITORING_TOKEN = previous;
    await new Promise(resolve => server.close(resolve));
  }
});
