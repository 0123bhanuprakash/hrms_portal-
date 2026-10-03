#!/usr/bin/env node
// Concurrency test against perf-bench: N virtual users, each loading pages
// (page shell + 2–3 page calls) back to back for D seconds.
//
//   node test/perf/load.js [--users 25] [--seconds 30]
//
// Starts its own API on PERF_PORT (default 4002) unless PERF_API is set.
const { spawn } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? Number(args[i + 1]) : d;
};
const USERS = opt('users', 25);
const SECONDS = opt('seconds', 30);
const root = path.resolve(__dirname, '..', '..');
const PORT = process.env.PERF_PORT ?? '4002';
const BASE = process.env.PERF_API ?? `http://localhost:${PORT}`;
const API = `${BASE}/api/v1`;
const PASSWORD = process.env.PERF_PASSWORD ?? 'Perf-Bench-2026!';

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const month = today.slice(0, 7);
const SHELL = ['/auth/me', '/access/me', '/users/me/preferences', '/notifications/unread-count', '/announcements?limit=1', '/leave/requests/pending-count', '/attendance/regularisations/pending-count', '/expenses/claims/pending-count', '/assets/requests/pending-count', '/helpdesk/counts', '/timesheets/pending-count'];
const PAGES = {
  emp: [['/people/me', '/people/spotlight', '/attendance/today'], ['/leave/balances', '/leave/requests?view=mine'], ['/notifications?limit=20'], ['/helpdesk/tickets?view=mine'], ['/people?limit=24']],
  manager: [['/attendance/team'], ['/leave/requests?view=review'], [`/leave/calendar?month=${month}`], ['/timesheets?view=review'], ['/employees?page=1&limit=20']],
  hr: [['/employees?page=1&limit=20'], ['/leave/requests?view=all'], ['/reports/people'], [`/reports/attendance?month=${month}`], ['/assets?page=1&limit=25'], ['/helpdesk/tickets?view=queue&status=active'], ['/expenses/claims?view=all']],
};

async function login(local) {
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `${local}@perf-bench.test`, password: PASSWORD }) });
  return { authorization: `Bearer ${(await r.json()).data.access_token}` };
}

async function startApi() {
  if (process.env.PERF_API) return null;
  const api = spawn(process.execPath, [path.join(root, 'dist', 'apps', 'api', 'src', 'main.js')], { cwd: root, stdio: 'ignore', env: { ...process.env, API_PORT: PORT, EMAIL_PROVIDER: 'console', REMINDERS_ENABLED: 'false', THROTTLE_LIMIT: '10000000' } });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${BASE}/health`)).ok) return api;
    } catch {
      /* starting */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  api.kill();
  throw new Error('API did not start');
}

const pct = (a, q) => a[Math.min(a.length - 1, Math.ceil(q * a.length) - 1)];

(async () => {
  const api = await startApi();
  try {
    const sessions = { emp: await login('emp'), manager: await login('manager'), hr: await login('hr') };
    const roles = Object.keys(sessions);
    const calls = [];
    const pages = [];
    let errors = 0;
    let limited = 0;
    const until = Date.now() + SECONDS * 1000;
    const get = async (h, u) => {
      const t = performance.now();
      try {
        const r = await fetch(API + u, { headers: h });
        await r.arrayBuffer();
        if (r.status === 429) limited++;
        else if (r.status >= 400) errors++;
      } catch {
        errors++;
      }
      calls.push(performance.now() - t);
    };
    const user = async (i) => {
      const role = roles[i % roles.length];
      const h = sessions[role];
      let n = i;
      while (Date.now() < until) {
        const t = performance.now();
        await Promise.all([...SHELL, ...PAGES[role][n++ % PAGES[role].length]].map((u) => get(h, u)));
        pages.push(performance.now() - t);
      }
    };
    const t0 = Date.now();
    await Promise.all(Array.from({ length: USERS }, (_, i) => user(i)));
    const secs = (Date.now() - t0) / 1000;
    calls.sort((a, b) => a - b);
    pages.sort((a, b) => a - b);
    console.log(`${USERS} users · ${secs.toFixed(0)}s · ${calls.length} requests (${Math.round(calls.length / secs)}/s) · ${pages.length} page loads (${(pages.length / secs).toFixed(1)}/s) · errors ${errors} · rate-limited ${limited}`);
    console.log(`request ms  p50 ${Math.round(pct(calls, 0.5))}  p95 ${Math.round(pct(calls, 0.95))}  p99 ${Math.round(pct(calls, 0.99))}`);
    console.log(`page load   p50 ${Math.round(pct(pages, 0.5))}  p95 ${Math.round(pct(pages, 0.95))}  p99 ${Math.round(pct(pages, 0.99))}`);
  } finally {
    api?.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
