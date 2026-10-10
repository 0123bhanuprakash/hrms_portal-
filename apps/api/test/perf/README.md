# API speed tools

Run from `apps/api` with a built API (`dist/`) and the dev database.

| Command | What it does |
|---|---|
| `node test/perf/seed-perf.js` | Creates the **perf-bench** company: ~500 employees in a 4-level tree, 6 months of attendance, leave, projects, 8 weeks of timesheets, expenses, assets, tickets, notifications. `--drop` removes it. |
| `node test/perf/seed-perf.js --companies 5 --size 250` | Several companies at once: `perf-bench-1` … `perf-bench-5`, each ~250 people (volumes scale with size). `--drop --companies 5` removes them. |
| `node test/perf/load-multi.js [--stages 25,50,100,200] [--seconds 30] [--sockets N] [--think ms] [--broadcast 5] [--json out.json]` | Multi-company test: holds one Socket.IO tab per account open, ramps virtual users in stages across every company and role, posts announcements to measure live delivery, and samples API CPU / memory and `/health` (event-loop lag). Tokens are signed from `JWT_SECRET`, so no login throttling. Starts its own API on port 4003. |
| `node test/perf/bench.js [--runs 15] [--json out.json] [filter]` | Times ~55 endpoints as employee / manager / HR / PMO / IT: p50, p95, max, response size and **database queries per request**. Also times the "page shell" (the ~11 calls every page fires at once). |
| `node test/perf/load.js [--users 25] [--seconds 30]` | Virtual users loading pages back to back, no think time (50 of them ≈ 1–2k real active users). Reports requests/s and p50/p95/p99. |

`bench.js` and `load.js` start their own API on port 4002 (console email, reminders off; `load.js` also lifts the rate limit) unless `PERF_API` points at a running one. Accounts: `hr@`, `manager@`, `lead@`, `emp@`, `pmo@`, `itadmin@perf-bench.test`, password `PERF_PASSWORD` (default `Perf-Bench-2026!`).

## Per-request database accounting

Start any API with `DB_TRACE=true` and every response carries

```
X-DB-Queries: 5
Server-Timing: db;dur=3.1;desc="5 queries", app;dur=6.4
```

(also visible in the browser dev tools → Network → Timing). Off by default — no overhead in production.

## Targets

p95 under 200 ms for normal endpoints and under 500 ms for heavy reports, measured against a production-like database. Keep queries per request low: with a database on another server each one costs ~1–5 ms.
