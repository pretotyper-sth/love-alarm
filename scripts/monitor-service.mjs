import { pathToFileURL } from 'node:url';

export async function checkService({ baseUrl, token, fetcher = fetch }) {
  if (!token || token.length < 32) throw new Error('MONITORING_TOKEN must be configured');
  // A sleeping Free instance gets one warm-up attempt; sustained latency is checked again.
  try { await fetcher(`${baseUrl}/health`, { signal: AbortSignal.timeout(75000) }); } catch { /* The authenticated check below reports unavailability. */ }
  const started = performance.now();
  const response = await fetcher(`${baseUrl}/internal/monitor`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000),
  });
  if (response.status === 401 || (response.status === 503 && !response.headers.get('content-type')?.includes('application/json'))) throw new Error('Monitor authentication or service availability failed');
  const data = await response.json();
  if (!Array.isArray(data.alerts)) throw new Error(`Monitor unavailable (HTTP ${response.status})`);
  if (performance.now() - started > 3000) data.alerts.push('EXTERNAL_LATENCY_HIGH');
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.includes('--test-alert')) {
      console.error('[TEST ONLY] DB_CONNECTION_FAILED, API_LATENCY_HIGH, API_ERROR_RATE_HIGH, DB_CAPACITY_HIGH');
      process.exitCode = 1;
    } else {
      const data = await checkService({ baseUrl: process.env.MONITORING_URL || 'https://love-alarm-server.onrender.com', token: process.env.MONITORING_TOKEN });
      console.log(JSON.stringify(data));
      if (data.alerts.length) { console.error(`운영 경고: ${data.alerts.join(', ')}`); process.exitCode = 1; }
    }
  } catch {
    // Never emit fetch options, authorization values, or raw database errors to public CI logs.
    console.error('운영 경고: MONITOR_UNAVAILABLE_OR_MISCONFIGURED');
    process.exitCode = 1;
  }
}
