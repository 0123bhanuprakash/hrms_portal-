#!/usr/bin/env node
// Times the API as real users use it, against the perf-bench company.
//
//   node test/perf/seed-perf.js                      # once
//   node test/perf/bench.js [--runs 15] [--json out.json] [filter]
//
// Starts its own API from dist/ on PERF_PORT (default 4002, console email,
// reminders off) unless PERF_API points at a running one. Each endpoint gets
// 2 warm-up calls, then --runs timed calls in a row; prints p50 / p95 / max (ms)
// and response size. "shell" = the ~12 requests every page fires at once.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args.splice(i, 2)[1] : dflt;
};
const RUNS = Number(opt('runs', 15));
const JSON_OUT = opt('json', null);
const FILTER = args[0] ?? null;
const PORT = process.env.PERF_PORT ?? '4002';
const BASE = process.env.PERF_API ?? `http://localhost:${PORT}`;
const API = `${BASE}/api/v1`;
const PASSWORD = process.env.PERF_PASSWORD ?? 'Perf-Bench-2026!';
const SLUG = 'perf-bench';

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const addDays = (k, n) => {
  const d = new Date(`${k}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const monday = addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));
const month = today.slice(0, 7);

async function login(local) {
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `${local}@${SLUG}.test`, password: PASSWORD }) });
  const j = await r.json();
  if (!j.data?.access_token) throw new Error(`login ${local}: ${JSON.stringify(j).slice(0, 200)}`);
  return { authorization: `Bearer ${j.data.access_token}` };
}

async function once(h, url) {
  const t = performance.now();
  const r = await fetch(API + url, { headers: h });
  const body = await r.arrayBuffer();
  return { ms: performance.now() - t, status: r.status, bytes: body.byteLength, queries: Number(r.headers.get('x-db-queries') ?? NaN) };
}

const pct = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];

async function measure(h, url) {
  for (let i = 0; i < 2; i++) await once(h, url);
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(await once(h, url));
  const ms = runs.map((r) => r.ms).sort((a, b) => a - b);
  return { p50: Math.round(pct(ms, 0.5)), p95: Math.round(pct(ms, 0.95)), max: Math.round(ms[ms.length - 1]), status: runs[0].status, kb: Math.round(runs[0].bytes / 102.4) / 10, queries: runs[0].queries };
}

async function measureShell(h, urls) {
  const go = async () => {
    const t = performance.now();
    const res = await Promise.all(urls.map((u) => once(h, u)));
    return { ms: performance.now() - t, bad: res.filter((r) => r.status >= 400).length, queries: res.reduce((n, r) => n + (r.queries || 0), 0) };
  };
  for (let i = 0; i < 2; i++) await go();
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(await go());
  const ms = runs.map((r) => r.ms).sort((a, b) => a - b);
  return { p50: Math.round(pct(ms, 0.5)), p95: Math.round(pct(ms, 0.95)), max: Math.round(ms[ms.length - 1]), status: runs[0].bad ? 400 : 200, kb: 0, queries: runs[0].queries };
}

const SHELL = [
  '/auth/me', '/access/me', '/users/me/preferences', '/notifications/unread-count', '/announcements?limit=1',
  '/leave/requests/pending-count', '/attendance/regularisations/pending-count', '/expenses/claims/pending-count',
  '/assets/requests/pending-count', '/helpdesk/counts', '/timesheets/pending-count',
];

function plan(ids) {
  return {
    employee: [
      ['home: people/me', '/people/me'],
      ['home: spotlight', '/people/spotlight'],
      ['attendance today', '/attendance/today'],
      ['my attendance (month)', `/attendance/calendar?month=${month}`],
      ['leave balances', '/leave/balances'],
      ['my leave', '/leave/requests?view=mine'],
      ['my timesheet week', `/timesheets/weeks/${addDays(monday, -7)}`],
      ['my assets', '/assets/mine'],
      ['my tickets', '/helpdesk/tickets?view=mine'],
      ['my projects', '/projects/mine'],
      ['notifications', '/notifications?limit=20'],
      ['announcements', '/announcements?limit=10'],
      ['people directory', '/people?limit=24'],
      ['org chart', '/org/chart'],
    ],
    manager: [
      ['team attendance', `/attendance/team?date=${addDays(today, -1)}`],
      ['leave approvals', '/leave/requests?view=review'],
      ['team leave', '/leave/requests?view=all'],
      ['who’s off', `/leave/calendar?month=${month}`],
      ['timesheet approvals', '/timesheets?view=review'],
      ['timesheet compliance', `/timesheets/compliance?weekStart=${addDays(monday, -7)}`],
      ['expense approvals', '/expenses/claims?view=review'],
      ['employees list', '/employees?page=1&limit=20'],
      ['reports: people', '/reports/people'],
      ['reports: attendance', `/reports/attendance?month=${month}`],
    ],
    hr: [
      ['employees list', '/employees?page=1&limit=20'],
      ['employees search', '/employees?search=sha&page=1&limit=20'],
      ['employee detail', `/employees/${ids.someEmployee}`],
      ['team attendance (all)', `/attendance/team?date=${addDays(today, -1)}`],
      ['all leave', '/leave/requests?view=all'],
      ['who’s off', `/leave/calendar?month=${month}`],
      ['expenses (all)', '/expenses/claims?view=all'],
      ['expense approvals', '/expenses/claims?view=review'],
      ['expense report', `/expenses/report?from=${addDays(today, -90)}&to=${today}`],
      ['asset register', '/assets?page=1&limit=25'],
      ['asset summary', '/assets/summary'],
      ['asset requests', '/assets/requests?view=all'],
      ['HR ticket queue', '/helpdesk/tickets?view=queue&status=active'],
      ['helpdesk summary', '/helpdesk/summary'],
      ['reports: people', '/reports/people'],
      ['reports: attendance', `/reports/attendance?month=${month}`],
      ['timesheets (team)', '/timesheets?view=team'],
      ['delegations', '/delegations'],
      ['projects', '/projects'],
      ['roles', '/company/roles'],
      ['users', '/company/users'],
    ],
    pmo: [
      ['reports: utilisation', '/reports/utilisation'],
      ['hours by project', `/timesheets/report?from=${addDays(today, -56)}&to=${today}`],
      ['projects', '/projects'],
      ['project detail', `/projects/${ids.someProject}`],
    ],
    itadmin: [
      ['IT ticket queue', '/helpdesk/tickets?view=queue&status=active'],
      ['asset register', '/assets?page=1&limit=25'],
    ],
  };
}

async function startApi() {
  if (process.env.PERF_API) return null;
  const main = path.join(root, 'dist', 'apps', 'api', 'src', 'main.js');
  const api = spawn(process.execPath, [main], { cwd: root, stdio: 'ignore', env: { ...process.env, API_PORT: PORT, EMAIL_PROVIDER: 'console', REMINDERS_ENABLED: 'false', DB_TRACE: 'true' } });
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

(async () => {
  const api = await startApi();
  try {
    const S = {};
    for (const who of ['emp', 'manager', 'hr', 'pmo', 'itadmin']) S[who] = await login(who);
    const someEmployee = (await (await fetch(`${API}/employees?limit=1&search=lead`, { headers: S.hr })).json()).data?.[0]?.id;
    const someProject = (await (await fetch(`${API}/projects`, { headers: S.pmo })).json()).data?.[0]?.id;
    const P = plan({ someEmployee, someProject });
    const roleOf = { employee: 'emp', manager: 'manager', hr: 'hr', pmo: 'pmo', itadmin: 'itadmin' };
    const rows = [];
    for (const who of ['emp', 'manager', 'hr']) {
      if (FILTER && !'shell'.includes(FILTER)) break;
      rows.push({ role: who, name: 'page shell (11 calls)', ...(await measureShell(S[who], SHELL)) });
    }
    for (const [group, list] of Object.entries(P)) {
      for (const [name, url] of list) {
        if (FILTER && !name.includes(FILTER) && !group.includes(FILTER)) continue;
        rows.push({ role: group, name, url, ...(await measure(S[roleOf[group]], url)) });
      }
    }
    console.log(`\n${RUNS} runs each · ${BASE} · ${new Date().toISOString()}\n`);
    console.log('role      endpoint                        p50    p95    max    KB  queries');
    for (const r of rows) {
      const flag = r.status >= 400 ? `  ✗ ${r.status}` : r.p95 > 500 ? '  🔴' : r.p95 > 200 ? '  🟠' : '';
      console.log(`${r.role.padEnd(9)} ${r.name.padEnd(30)} ${String(r.p50).padStart(5)}  ${String(r.p95).padStart(5)}  ${String(r.max).padStart(5)} ${String(r.kb).padStart(6)}  ${String(Number.isNaN(r.queries) ? '?' : r.queries).padStart(4)}${flag}`);
    }
    const ok = rows.filter((r) => r.status < 400);
    const sorted = ok.map((r) => r.p95).sort((a, b) => a - b);
    console.log(`\n${ok.length} endpoints · median p95 ${pct(sorted, 0.5)} ms · over 200 ms: ${ok.filter((r) => r.p95 > 200).length} · over 500 ms: ${ok.filter((r) => r.p95 > 500).length} · errors: ${rows.length - ok.length}`);
    if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ at: new Date().toISOString(), runs: RUNS, rows }, null, 2));
  } finally {
    api?.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
