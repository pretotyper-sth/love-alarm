import { setTimeout as pause } from 'node:timers/promises';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function summarize(samples) {
  const sorted = samples.map(s => s.ms).sort((a, b) => a - b);
  const errors = samples.filter(s => !s.ok).length;
  return { requests: samples.length, errors, errorRate: samples.length ? errors / samples.length : 0,
    p50Ms: sorted[Math.ceil(sorted.length * .5) - 1] || 0, p95Ms: sorted[Math.ceil(sorted.length * .95) - 1] || 0, maxMs: sorted.at(-1) || 0 };
}

// Bounded read-only smoke load, deliberately not a destructive saturation test.
export async function runLoadCheck({ baseUrl, stages = [1, 3, 5, 10], seconds = 10, fetcher = fetch, maxInFlight = 5 }) {
  if (stages.some(r => r < 1 || r > 10) || seconds < 1 || seconds > 20) throw new Error('Load budget exceeded');
  const result = { startedAt: new Date().toISOString(), target: '/api/alarms/count', stages: [], stoppedEarly: false };
  const inFlight = new Set();
  // A reserved test target is never stored and no production message/account data is returned.
  const url = `${baseUrl}/api/alarms/count?instagram_id=load_probe_000000000000000000`;
  const warm = await fetcher(`${baseUrl}/health`, { signal: AbortSignal.timeout(75000) });
  if (!warm.ok) throw new Error('Service not ready; load check not started');
  for (const rate of stages) {
    const samples = [];
    let skipped = 0, stop = false;
    for (let i = 0; i < rate * seconds; i++) {
      if (stop) break;
      if (inFlight.size >= maxInFlight) skipped++;
      else {
        const request = (async () => {
          const start = performance.now();
          let ok = false;
          try {
            const response = await fetcher(url, { signal: AbortSignal.timeout(5000) });
            const body = await response.json();
            ok = response.ok && typeof body.count === 'number';
          } catch { /* Record a failure and stop rather than retrying into an overloaded service. */ }
          const ms = Math.round(performance.now() - start);
          samples.push({ ok, ms });
          if (!ok || ms > 3000) stop = true;
        })();
        inFlight.add(request);
        void request.finally(() => inFlight.delete(request));
      }
      await pause(1000 / rate);
    }
    await Promise.all(inFlight);
    const summary = summarize(samples);
    result.stages.push({ requestedRps: rate, seconds, skipped, ...summary });
    if (stop || skipped || summary.errors || summary.p95Ms > 3000) { result.stoppedEarly = true; break; }
    await pause(1000);
  }
  result.finishedAt = new Date().toISOString();
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runLoadCheck({ baseUrl: process.env.MONITORING_URL || 'https://love-alarm-server.onrender.com' });
  if (process.env.LOAD_REPORT_PATH) await writeFile(process.env.LOAD_REPORT_PATH, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (result.stoppedEarly) process.exitCode = 1;
}
