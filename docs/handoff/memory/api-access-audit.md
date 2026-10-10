---
name: api-access-audit
description: "API + role-access audit — DONE 2026-10-11 (report docs/audit/2026-10-11-api-access-audit.md); #1–#9 fixed + committed 6e71134"
metadata:
  node_type: memory
  type: project
  originSessionId: 449c1e50-e726-4782-bb05-81b97925b6c6
  modified: 2026-10-06T20:08:08.460Z
---

User asked 2026-10-07 to put a **full API + access audit** in the future plan (not started). Also recorded in docs/handoff/HANDOFF.md §5.

Scope agreed:
1. Sign in as employee, manager and admin; record every network call per role — none should be outside the role (Network tab is visible by nature; the goal is the browser doesn't *ask* for out-of-role data, and the server refuses anyway).
2. Every route without `@RequirePermission` / `@SuperAdminOnly` must return only the caller's own data (users/me, notifications, pending counts, etc.).
3. List queries without limit/pagination that can grow (spot check 2026-10-07: ~386 `findMany`, only ~67 with `take`; 21 services return paged `meta`).
4. Naming/REST consistency and over-fetching — e.g. `/reports/people` is one big bundle shared by several Home cards (movements cap raised 40→500 on 2026-10-07 for the joiners "See everyone" popup).

Known good: global guard chain in apps/api/src/app.module.ts (throttle → JWT → temp password → maintenance → PermissionGuard → SuperAdminGuard → Reauth), every query company-scoped, route names kebab-case plural nouns.

Already fixed 2026-10-07 : the 5 pending-count calls (leave, attendance, expenses, timesheets, assets) were sent by every employee every 2 min; now gated by `useMayApprove(...perms)` in apps/web/src/lib/company/projects.ts.

**Why:** user wants employees to never trigger APIs unrelated to their role, and APIs to fetch only what's needed.
**How to apply:** when the user picks this up, run it per role in the browser pane (test accounts: [[company-test-account]], [[aakash-demo-org]]) and report findings before fixing. Related: [[next-session-plan]].

**DONE 2026-10-11 (audit only, nothing fixed):** report in `docs/audit/2026-10-11-api-access-audit.md`. Headline: 1 HIGH cross-company read (`GET /resources/history/:employeeId` — PMO shortcut skips the company check; same shortcut in `/projects/billing/:employeeId`), manager's Leave approvals page calls 2 HR-only endpoints, `/people/me` + preferences fire before session restore (from the cookie change), unused `/employees/org-chart`, expense summary loads all claims ever. Cross-company writes: none got through (141 routes). Awaiting the user's go to fix (suggested order in the report).

Fixed 2026-10-11 : #1 + #2 — company checked first in `assertSeesHistory` (resources.service) and `assertCanSeePerson` (planning.service, also covers /projects/capacity); test `test/e2e/tenant-isolation.e2e.js` 16/16. Next in order: #3 manager leave-approvals calls, #4 premature /people/me + preferences.
Fixed 2026-10-11 : #3 (leave approvals page: Extra-leave panel only for lenders) + #4 (useMyCard / usePreferences wait for isAuthenticated). Next: #5 remove /employees/org-chart, #7 trim company record, #6 helped counter, #8/#9 perf.
Fixed 2026-10-11 : #5 (/employees/org-chart removed), #6 ("That helped" once per person — new table ticket_category_helps, migration 20261106100000 APPLIED to dev DB; service uses raw INSERT … ON CONFLICT because `prisma generate` couldn't run while the dev API held the engine DLL — db:generate since done by the user), #7 (company record + settings need settings.view, /access/catalog needs role.view). Left: #8 expense summary all claims, #9 audit-log DISTINCT, #10 lists.
Fixed 2026-10-11 : #8 (expense summary: open claims + this year only; identical output for all 134 SeedsAI people), #9 (audit actions cached 10 min). Audit items #1–#9 all fixed; only #10 (list sizes, for big customers) left.
All of the above COMMITTED 2026-10-11: fixes 6e71134, test fixes 2a7bf32.
