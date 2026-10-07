---
name: api-access-audit
description: "Planned full API + role-access audit (user asked 2026-10-07) — scope, what's already known, what's fixed"
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

Already fixed 2026-10-07 (uncommitted): the 5 pending-count calls (leave, attendance, expenses, timesheets, assets) were sent by every employee every 2 min; now gated by `useMayApprove(...perms)` in apps/web/src/lib/company/projects.ts.

**Why:** user wants employees to never trigger APIs unrelated to their role, and APIs to fetch only what's needed.
**How to apply:** when the user picks this up, run it per role in the browser pane (test accounts: [[company-test-account]], [[aakash-demo-org]]) and report findings before fixing. Related: [[next-session-plan]].
