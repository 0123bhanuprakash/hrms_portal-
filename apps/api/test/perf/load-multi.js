#!/usr/bin/env node
// Multi-company concurrency test: many companies, thousands of open Socket.IO
// tabs, and virtual users loading pages at the same time — in rising stages so
// you can see where the API starts to struggle.
//
//   node test/perf/seed-perf.js --companies 5 --size 250      # once
//   node test/perf/load-multi.js [--stages 25,50,100,200] [--seconds 30]
//                                [--sockets 1265] [--think 0] [--broadcast 5]
//                                [--json out.json]
//
//   --stages     HTTP virtual users per stage (spread over every company and role)
//   --seconds    how long each stage runs
//   --sockets    open Socket.IO tabs held through the whole run (default: one per account)
//   --think      pause between page loads in ms (0 = flat out; ~10000 ≈ a real person)
//   --broadcast  every N seconds an HR user posts an announcement, which fans out to
//                its whole company (socket event + a notification per person)
//
// Starts its own API on PERF_PORT (default 4003) with the rate limit lifted, unless
// PERF_API points at a running one (then it cannot read that server's CPU / memory).
// No sign-in is needed per user: access tokens are signed here with JWT_SECRET from
// apps/api/.env, so the login rate limit never gets in the way.
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { io } = require('socket.io-client');
const { JwtService } = require('@nestjs/jwt');
const { createSecretKey, randomUUID } = require('crypto');
const { PrismaClient } = require('@prisma/client');

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const STAGES = String(opt('stages', '25,50,100,200')).split(',').map(Number);
const SECONDS = Number(opt('seconds', 30));
const THINK = Number(opt('think', 0));
const BROADCAST = Number(opt('broadcast', 5));
const JSON_OUT = opt('json', null);
const root = path.resolve(__dirname, '..', '..');
const PORT = process.env.PERF_PORT ?? '4003';
const BASE = process.env.PERF_API ?? `http://localhost:${PORT}`;
const API = `${BASE}/api/v1`;

function readEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*?)"?\s*(?:#.*)?$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const month = today.slice(0, 7);
const SHELL = ['/auth/me', '/access/me', '/users/me/preferences', '/notifications/unread-count', '/announcements?limit=1', '/leave/requests/pending-count', '/attendance/regularisations/pending-count', '/expenses/claims/pending-count', '/assets/requests/pending-count', '/helpdesk/counts', '/timesheets/pending-count'];
const PAGES = {
  emp: [['/people/me', '/people/spotlight', '/attendance/today'], ['/leave/balances', '/leave/requests?view=mine'], ['/notifications?limit=20'], ['/helpdesk/tickets?view=mine'], ['/people?limit=24']],
  manager: [['/attendance/team'], ['/leave/requests?view=review'], [`/leave/calendar?month=${month}`], ['/timesheets?view=team'], ['/employees?page=1&limit=20']],
  hr: [['/employees?page=1&limit=20'], ['/leave/requests?view=all'], ['/reports/people'], [`/reports/attendance?month=${month}`], ['/assets?page=1&limit=25'], ['/helpdesk/tickets?view=queue&status=active'], ['/expenses/claims?view=all']],
};
const roleOf = (local) => (local === 'hr' ? 'hr' : /^(head|lead|manager|ceo)/.test(local) ? 'manager' : 'emp');

const pct = (a, q) => (a.length ? a[Math.min(a.length - 1, Math.ceil(q * a.length) - 1)] : 0);
const sorted = (a) => [...a].sort((x, y) => x - y);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function startApi(env) {
  if (process.env.PERF_API) return null;
  const api = spawn(process.execPath, [path.join(root, 'dist', 'apps', 'api', 'src', 'main.js')], {
    cwd: root, stdio: 'ignore',
    env: { ...process.env, API_PORT: PORT, EMAIL_PROVIDER: 'console', REMINDERS_ENABLED: 'false', THROTTLE_LIMIT: '10000000' },
  });
  for (let i = 0; i < 90; i++) {
    try {
      if ((await fetch(`${BASE}/health`)).ok) return api;
    } catch {
      /* starting */
    }
    await sleep(1000);
  }
  api.kill();
  throw new Error('API did not start');
}

/** CPU seconds and memory of the API process (Windows). */
function sample(pid) {
  return new Promise((resolve) => {
    execFile('powershell', ['-NoProfile', '-Command', `$p=Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if($p){"$($p.CPU) $($p.WorkingSet64)"}`], { timeout: 8000 }, (err, out) => {
      const [cpu, mem] = String(out ?? '').trim().split(' ').map(Number);
      resolve(err || !mem ? null : { cpu, mem });
    });
  });
}

(async () => {
  const env = readEnv(path.join(root, '.env'));
  if (!env.JWT_SECRET) throw new Error('JWT_SECRET missing from apps/api/.env');
  const jwt = new JwtService({ secret: createSecretKey(Buffer.from(env.JWT_SECRET)) });
  const prisma = new PrismaClient();
  const users = await prisma.user.findMany({
    where: { company: { slug: { startsWith: 'perf-bench' } }, status: 'ACTIVE' }, // numbered ones below win over the single 'perf-bench'
    select: { id: true, email: true, companyId: true, company: { select: { slug: true } } },
  });
  await prisma.$disconnect();
  if (!users.length) throw new Error('No perf-bench companies — run: node test/perf/seed-perf.js --companies 5 --size 250');
  const numbered = users.some((u) => /^perf-bench-\d+$/.test(u.company.slug));
  const accounts = users.filter((u) => !numbered || /^perf-bench-\d+$/.test(u.company.slug)).map((u) => {
    const local = u.email.split('@')[0];
    return {
      slug: u.company.slug, local, role: roleOf(local), id: u.id,
      token: jwt.sign({ sub: u.id, email: u.email, is_super_admin: false, company_id: u.companyId, sid: randomUUID() }, { expiresIn: '3h' }),
    };
  });
  const slugs = [...new Set(accounts.map((a) => a.slug))];
  const hrs = accounts.filter((a) => a.role === 'hr');
  // Same mix of roles in every stage, interleaved across companies
  const byRole = { emp: accounts.filter((a) => a.role === 'emp'), manager: accounts.filter((a) => a.role === 'manager'), hr: hrs };
  console.log(`${accounts.length} accounts in ${slugs.length} companies (${slugs.map((s) => accounts.filter((a) => a.slug === s).length).join(' / ')} people) · stages ${STAGES.join(', ')} users × ${SECONDS}s · think ${THINK}ms`);

  const api = await startApi(env);
  const pid = api?.pid;
  try {
    // ── Sockets: one tab per account (or as many as asked), held for the whole run
    const SOCKETS = Number(opt('sockets', accounts.length));
    const sockets = [];
    const live = { ready: 0, failed: 0, dropped: 0, expired: 0, events: 0 };
    const connectMs = [];
    const lagMs = [];
    const noteMs = [];
    const posted = new Map(); // announcement title → { t, company }
    const tabs = Array.from({ length: SOCKETS }, (_, i) => accounts[i % accounts.length]);
    const open = (a) =>
      new Promise((resolve) => {
        const t0 = performance.now();
        const s = io(BASE, { path: '/socket.io', auth: { token: a.token }, transports: ['websocket'], reconnection: false, timeout: 20000 });
        let done = false;
        const fin = (ok) => {
          if (done) return;
          done = true;
          if (ok) {
            live.ready++;
            connectMs.push(performance.now() - t0);
          } else live.failed++;
          resolve();
        };
        s.once('ready', () => fin(true));
        s.once('unauthorized', () => fin(false));
        s.once('connect_error', () => fin(false));
        // Delay from the post to the first matching event on this tab. 'changed' is combined
        // by the server in a 3 s window on purpose; 'notification' is sent straight away.
        const first = (kind, into) => {
          const latest = [...posted.values()].filter((v) => v.slug === a.slug).sort((x, y) => y.t - x.t)[0];
          if (!latest || latest.seen.has(`${kind}${tabId}`)) return;
          latest.seen.add(`${kind}${tabId}`);
          into.push(performance.now() - latest.t);
        };
        const tabId = sockets.length;
        s.on('changed', (m) => {
          live.events++;
          if (m?.topic === 'announcements') first('c', lagMs);
        });
        s.on('notification', () => {
          live.events++;
          first('n', noteMs);
        });
        s.on('expired', () => live.expired++);
        s.on('disconnect', (why) => {
          if (done && why !== 'io client disconnect') live.dropped++;
        });
        sockets.push(s);
      });
    process.stdout.write(`opening ${SOCKETS} sockets… `);
    const t0s = Date.now();
    for (let i = 0; i < tabs.length; i += 100) await Promise.all(tabs.slice(i, i + 100).map(open)); // in waves of 100, like people arriving
    console.log(`${live.ready} ready, ${live.failed} refused in ${((Date.now() - t0s) / 1000).toFixed(1)}s · connect p50 ${Math.round(pct(sorted(connectMs), 0.5))}ms p95 ${Math.round(pct(sorted(connectMs), 0.95))}ms`);
    const base = pid ? await sample(pid) : null;
    if (base) console.log(`API with ${live.ready} idle sockets: ${(base.mem / 1048576).toFixed(0)} MB`);

    // ── Stages
    const results = [];
    for (const users of STAGES) {
      const calls = [];
      const pages = [];
      const status = {};
      const health = [];
      let limited = 0;
      const seen = new Map();
      lagMs.length = 0;
      noteMs.length = 0;
      live.events = 0;
      const until = Date.now() + SECONDS * 1000;
      const get = async (a, u) => {
        const t = performance.now();
        try {
          const r = await fetch(API + u, { headers: { authorization: `Bearer ${a.token}` } });
          const buf = await r.arrayBuffer();
          if (r.status === 429) limited++;
          else if (r.status >= 400) {
            status[r.status] = (status[r.status] ?? 0) + 1;
            const k = `${r.status} ${u.split('?')[0]}`;
            if (!seen.has(k)) seen.set(k, `${a.local}@${a.slug}: ${Buffer.from(buf).toString().slice(0, 200)}`);
          }
        } catch {
          status.network = (status.network ?? 0) + 1;
        }
        calls.push(performance.now() - t);
      };
      // Virtual users: 70% employees, 25% managers, 5% HR; companies and accounts rotate
      const pick = (i) => {
        const r = i % 20;
        const list = r === 0 ? byRole.hr : r < 6 ? byRole.manager : byRole.emp;
        return list[Math.floor(i / 20 + i * 7) % list.length];
      };
      const user = async (i) => {
        const a = pick(i);
        let n = i;
        await sleep((i % 10) * 100); // not all at the same instant
        while (Date.now() < until) {
          const t = performance.now();
          const mine = PAGES[a.role];
          await Promise.all([...SHELL, ...mine[n++ % mine.length]].map((u) => get(a, u)));
          pages.push(performance.now() - t);
          if (THINK) await sleep(THINK * (0.5 + Math.random()));
        }
      };
      // Event-loop probe: /health answers instantly when the server is idle
      const probe = (async () => {
        while (Date.now() < until) {
          const t = performance.now();
          await fetch(`${BASE}/health`).then((r) => r.arrayBuffer()).catch(() => undefined);
          health.push(performance.now() - t);
          await sleep(500);
        }
      })();
      // Broadcasts: an HR user posts; every tab in that company gets the event
      const poster = (async () => {
        if (!BROADCAST) return;
        let k = 0;
        while (Date.now() < until) {
          await sleep(BROADCAST * 1000);
          const a = hrs[k++ % hrs.length];
          const title = `Load test ${Date.now()}`;
          posted.set(title, { t: performance.now(), slug: a.slug, seen: new Set() });
          const r = await fetch(`${API}/announcements`, { method: 'POST', headers: { authorization: `Bearer ${a.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ title, body: 'Load test announcement', audience: 'COMPANY' }) }).catch(() => null);
          if (!r || r.status >= 300) {
            status[`post ${r?.status}`] = (status[`post ${r?.status}`] ?? 0) + 1;
            if (r && !seen.has('post')) seen.set('post', (await r.text()).slice(0, 300));
          }
          setTimeout(() => posted.delete(title), 4000);
        }
      })();
      const s0 = pid ? await sample(pid) : null;
      const w0 = Date.now();
      await Promise.all([...Array.from({ length: users }, (_, i) => user(i)), probe, poster]);
      const secs = (Date.now() - w0) / 1000;
      const s1 = pid ? await sample(pid) : null;
      const c = sorted(calls);
      const p = sorted(pages);
      const h = sorted(health);
      const l = sorted(lagMs);
      const nl = sorted(noteMs);
      const errs = Object.values(status).reduce((x, y) => x + y, 0);
      const row = {
        users, requests: calls.length, rps: Math.round(calls.length / secs), pagesPerSec: +(pages.length / secs).toFixed(1),
        errors: errs, errorDetail: status, rateLimited: limited,
        reqP50: Math.round(pct(c, 0.5)), reqP95: Math.round(pct(c, 0.95)), reqP99: Math.round(pct(c, 0.99)),
        pageP50: Math.round(pct(p, 0.5)), pageP95: Math.round(pct(p, 0.95)),
        healthP95: Math.round(pct(h, 0.95)), healthMax: Math.round(h[h.length - 1] ?? 0),
        socketsLive: sockets.filter((s) => s.connected).length, socketEvents: live.events,
        liveLagP50: Math.round(pct(l, 0.5)), liveLagP95: Math.round(pct(l, 0.95)),
        noteLagP50: Math.round(pct(nl, 0.5)), noteLagP95: Math.round(pct(nl, 0.95)), noteCount: nl.length,
        cpuPct: s0 && s1 ? Math.round(((s1.cpu - s0.cpu) / secs) * 100) : null, memMB: s1 ? Math.round(s1.mem / 1048576) : null,
        // At roughly one page load every 10 s per person
        realUsersApprox: Math.round((pages.length / secs) * 10),
      };
      results.push(row);
      console.log(
        `\n── ${users} virtual users · ${secs.toFixed(0)}s\n` +
          `   ${row.requests} requests (${row.rps}/s) · ${row.pagesPerSec} page loads/s ≈ ${row.realUsersApprox} real people clicking once every 10s\n` +
          `   request ms  p50 ${row.reqP50}  p95 ${row.reqP95}  p99 ${row.reqP99}   ·   page load ms  p50 ${row.pageP50}  p95 ${row.pageP95}\n` +
          `   errors ${errs} ${errs ? JSON.stringify(status) : ''} · rate-limited ${limited} · /health p95 ${row.healthP95}ms (max ${row.healthMax}ms)\n` +
          `   sockets ${row.socketsLive}/${SOCKETS} still open · live events received ${row.socketEvents} · notification arrives p50 ${row.noteLagP50}ms p95 ${row.noteLagP95}ms (${row.noteCount} tabs) · 'changed' (3s window) p95 ${row.liveLagP95}ms\n` +
          (seen.size ? `   first failures: ${[...seen].map(([k, v]) => `${k} (${v})`).join(' · ')}
` : '') +
          (row.cpuPct === null ? '' : `   API process: ${row.cpuPct}% CPU (100% = one full core; Node + Prisma use several), ${row.memMB} MB`),
      );
      await sleep(2000);
    }

    console.log('\nSummary');
    console.table(results.map((r) => ({ users: r.users, 'req/s': r.rps, 'page/s': r.pagesPerSec, 'req p95': r.reqP95, 'page p95': r.pageP95, 'health p95': r.healthP95, errors: r.errors, '429': r.rateLimited, sockets: r.socketsLive, 'notif p95': r.noteLagP95, 'cpu %': r.cpuPct, 'MB': r.memMB })));
    if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ accounts: accounts.length, companies: slugs.length, sockets: SOCKETS, seconds: SECONDS, think: THINK, results }, null, 2));
    for (const s of sockets) s.disconnect();
  } finally {
    api?.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
