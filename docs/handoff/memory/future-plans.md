---
name: future-plans
description: "Queued plans the user deferred (2026-10-09/10) — stale-error pages, API/access audit, SeedsAI walk-through, multi-tab sessions, refresh-token cookie (built), Redis scaling, Playwright UI tests"
metadata:
  node_type: memory
  type: project
  originSessionId: 3832ecf2-9639-40e5-b268-75ab97c06c99
  modified: 2026-10-08T21:38:11.559Z
---

User said "add these in future plans" on 2026-10-09 (not to start now):

1. **Stale-error pages** — ~50 older pages replace loaded data with an error screen when a background refresh fails; change `isError` → `isLoadingError` per page.
2. **API + access audit** — per role: network calls the browser makes, routes returning other people's data, lists without size limits. Details in [[api-access-audit]].
3. **SeedsAI browser walk-through** — click through each role on the 136-person company and fix what breaks. See [[seedsai-test-company]].
4. **Multi-tab sign-in** — different users in two tabs. Needs the user's decision: one shared session (Claude recommends) or a session per tab.

5. **Refresh token → httpOnly cookie** — BUILT 2026-10-10, COMMITTED 6a6f7f3. API: `auth/refresh-cookie.ts` (cookie `hrms_rt`, HttpOnly, SameSite=Lax, path /api/v1/auth; refresh/logout need header `X-HRMS-CSRF: 1`; logout is @Public); no `refresh_token` in any body. Web: store persists only `profile` + `signedIn` hints (version 2 migrates old storage), access token memory-only, `verifySession()` in lib/auth/portal.ts asks /auth/me on every page load (portals trust only that), `refreshAccessToken()` in lib/api.ts single-flight + Web Locks across tabs. Tests: `test/e2e/auth-cookie.e2e.js` (30 checks). Left: stricter CSP (separate step).
6. **Redis + multi-process scaling** (2026-10-10, after the load test, not started). One API process tops out near 750 req/s (~60 page loads/s); 1,265 sockets held fine. To scale: `REDIS_URL`, Socket.IO Redis adapter in `LiveIoAdapter`, Redis-backed throttler, run-once scheduled jobs via BullMQ, uploads to S3/MinIO, sticky/WebSocket-friendly load balancer + `TRUST_PROXY`; DevOps runs N copies (PM2/replicas), code changes are ours. Re-test with `apps/api/test/perf/load-multi.js` (seed with `seed-perf.js --companies 5 --size 250`, drop with `--drop --companies 5`).

7. **Automated UI tests (Playwright)** — asked 2026-10-11, not started. Today only the backend is tested automatically (40 e2e API suites, ~1,100 checks, + unit tests); the web app has no tests — UI checks were manual in the browser pane. Plan: Playwright in `apps/web` (or a new `apps/e2e-ui`), throwaway company via the API lib's `makeCompany`, sign in as employee / manager / HR / admin, open every menu page, fail on page errors, console errors or refused (401/403) API calls; then key flows (apply + approve leave, submit expense, raise ticket, sign-out, cookie session restore, tampered localStorage). Keep it off the pre-push hook (slow); run with `pnpm verify` or on its own.

Same list is in docs/handoff/HANDOFF.md §5 items 1–4 (+ cookie and Redis below).

**How to apply:** when the user asks "what's next" or "fix bugs" without specifics, offer these. Related: [[next-session-plan]].
