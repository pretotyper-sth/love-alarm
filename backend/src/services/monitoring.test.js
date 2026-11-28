import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestMonitor, databaseStatus, monitorAlerts } from './monitoring.js';
import { checkService } from '../../../scripts/monitor-service.mjs';
import { runLoadCheck, summarize } from '../../../scripts/load-check.mjs';

const goodDb = { ok: true, durationMs: 30, bytes: 30 * 1024 * 1024, connections: 5, maxConnections: 100 };
test('bounded request statistics age out and distinguish 4xx from server errors', () => {
  let time = 100000000;
  const monitor = createRequestMonitor(() => time);
  monitor.record(401, 50);
  monitor.record(503, 3500);
  assert.equal(monitor.snapshot().count, 2);
  assert.equal(monitor.snapshot().errors, 1);
  assert.equal(monitor.snapshot().p95UpperMs, 5000);
  time += 31 * 60000;
  assert.equal(monitor.snapshot().count, 0);
  assert.equal(monitor.snapshot().p95UpperMs, null);
});
test('each requested warning is independently detectable without relying on UI events', () => {
  const monitor = createRequestMonitor();
  for (let i = 0; i < 20; i++) monitor.record(i === 0 ? 500 : 200, i === 1 ? 3100 : 100);
  const data = { requests: monitor.snapshot(), database: goodDb };
  assert.deepEqual(monitorAlerts(data), ['API_ERROR_RATE_HIGH', 'API_LATENCY_HIGH']);
  assert.deepEqual(monitorAlerts({ requests: createRequestMonitor().snapshot(), database: { ok: false } }), ['DB_CONNECTION_FAILED']);
  assert.deepEqual(monitorAlerts({ requests: createRequestMonitor().snapshot(), database: { ...goodDb, bytes: 400 * 1024 * 1024, connections: 80, durationMs: 1001 } }), ['DB_LATENCY_HIGH', 'DB_CAPACITY_HIGH', 'DB_CONNECTIONS_HIGH']);
  assert.deepEqual(monitorAlerts({ requests: createRequestMonitor().snapshot(), database: goodDb }), []);
});
test('DB probe uses a bounded transaction and returns only aggregate metrics, not raw errors', async () => {
  let statements = 0;
  const database = await databaseStatus({ $transaction: async (action, options) => {
    assert.deepEqual(options, { maxWait: 1500, timeout: 3000 });
    return action({ $executeRaw: async strings => { assert.match(strings[0], /statement_timeout/); statements++; }, $queryRaw: async () => [{ bytes: 10n, connections: 2n, max_connections: 100 }] });
  } });
  assert.equal(statements, 1);
  assert.equal(database.bytes, 10);
  assert.equal(database.ok, true);
  const failed = await databaseStatus({ $transaction: async () => { throw new Error('postgres://private-credentials'); } });
  assert.equal(failed.ok, false);
  assert.doesNotMatch(JSON.stringify(failed), /private/);
});
test('external monitor preserves DB failures and cannot accept a missing token', async () => {
  await assert.rejects(checkService({ baseUrl: 'https://example.com', token: '' }), /configured/);
  const result = await checkService({ baseUrl: 'https://example.com', token: 'a'.repeat(32), fetcher: async url => url.endsWith('/health') ? { ok: true } : new Response(JSON.stringify({ alerts: ['DB_CONNECTION_FAILED'] }), { status: 503, headers: { 'Content-Type': 'application/json' } }) });
  assert.deepEqual(result.alerts, ['DB_CONNECTION_FAILED']);
});
test('load check rejects unsafe budgets and stops after a failed read without issuing writes', async () => {
  await assert.rejects(runLoadCheck({ stages: [100] }), /budget/);
  const calls = [];
  const result = await runLoadCheck({ baseUrl: 'https://example.com', stages: [10], seconds: 1, fetcher: async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/health')) return { ok: true };
    return new Response('{}', { status: 503 });
  } });
  assert.equal(result.stoppedEarly, true);
  assert.equal(result.stages[0].requests, 1);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(c => !c.options.method));
  assert.deepEqual(summarize([{ ok: true, ms: 30 }, { ok: false, ms: 50 }]), { requests: 2, errors: 1, errorRate: .5, p50Ms: 30, p95Ms: 50, maxMs: 50 });
});
