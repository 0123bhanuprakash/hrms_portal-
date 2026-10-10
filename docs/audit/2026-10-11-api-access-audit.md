# API + access audit — 2026-10-11

Scope agreed in `docs/handoff/memory/api-access-audit.md`: what each role's browser calls, routes without a permission check, cross-company isolation, lists without limits, over-fetching. **Findings only — nothing is fixed yet.**

## How it was tested

| Check | How | Size |
|---|---|---|
| Route inventory | TypeScript AST over every `*.controller.ts` | 509 routes: 326 with `@RequirePermission`, 66 Super Admin only, 12 public, **105 signed-in only** |
| Read access | Every GET called as a plain SeedsAI employee, a line manager, HR, the Company Admin and an admin of **another company**, using ids that belong to someone else | 211 routes × 5 callers |
| Write access | Every POST/PUT/PATCH/DELETE that targets a record, as a plain employee and as a throwaway admin of another company; bodies auto-filled until validation passed; ran on a separate API with console email | 141 routes × 2 callers |
| Browser | Signed in as employee, manager and Company Admin (throwaway company) and opened every menu page; recorded every API call and its status | 18 / 25 / 42 pages |
| Lists | Every prisma `findMany` without `take`, ranked by table growth | 456 calls, 366 without `take` |

Side effects of the write probe on SeedsAI (one shout-out "thanks", one acknowledgement, two emoji reactions, +1 "helped" on a help topic) were undone afterwards. Throwaway companies were removed.

## Findings

| # | Severity | Finding | Where | Fix |
|---|---|---|---|---|
| 1 | **High — FIXED 2026-10-11** | **Cross-company read.** An admin (anyone holding `project.manage`) of company A gets a company-B employee's name, designation, skills, joining date and assignment history from `GET /resources/history/:employeeId`. | `projects/resources.service.ts` `assertSeesHistory` returns early for PMO before checking the employee's company; `history()` then loads the person with `findUnique({ id })` (no `companyId`) | Check `{ id, companyId }` first in both asserts; load the person with `findFirst({ id, companyId })` |
| 2 | Low — FIXED 2026-10-11 | Same shortcut in `GET /projects/billing/:employeeId` (and `/projects/capacity/:employeeId`) — answers 200 (zeros) for another company's employee instead of 404. No data leaks; confirms the id exists. | `projects/planning.service.ts` `assertCanSeePerson` | Same fix as #1 |
| 3 | Medium — FIXED 2026-10-11 | **Out-of-role calls from the UI.** A line manager's *Leave approvals* page calls `GET /leave/extra-requests?view=decide` and `GET /leave/owed` (HR only) → two 403s every visit. | web: leave approvals page | Only fetch them when the person holds `leave.extra_decide` / `leave.adjust_balance` |
| 4 | Low (from 2026-10-10 cookie change) — FIXED 2026-10-11 | On every full page load `/people/me` and `/users/me/preferences` fire before the session is restored → 401, refresh, retry. Two wasted calls + console errors per page. | web: queries start before `useAuthHydrated` | Enable those queries only once `isAuthenticated` |
| 5 | Low — FIXED 2026-10-11 | `GET /employees/org-chart` is no longer used by the web app (it uses `/org/chart`) but still returns the whole company tree with work emails (54 KB) to anyone with `org.view`. | `employees.controller.ts:238` | Remove the route |
| 6 | Low — FIXED 2026-10-11 | "This helped" on a help topic can be pressed any number of times by any employee — the counter isn't per person. | `helpdesk/ticket-categories.service.ts:151` | Remember who marked it (or rate-limit) |
| 7 | Low — FIXED 2026-10-11 | Every employee can read the full company record (`GET /companies/:id`: plan id, limits, company email, employee-id sequence, all settings) and the full permission catalog (`GET /access/catalog`, 17 KB). Not secret, but more than the portal needs. | `companies.controller.ts`, `access.controller.ts` | Return a trimmed shape to non-admins |
| 8 | Perf — FIXED 2026-10-11 | Expense summary loads **every claim the person ever made**, with items, to show this month / this year. | `expenses/claims.service.ts:396` | Filter to the current year (+ open claims) |
| 9 | Perf — FIXED 2026-10-11 | Super Admin audit-log filter runs `DISTINCT action` over the whole audit log (all companies) on every open. | `admin/admin.service.ts:500` | Cache it, or keep a small table of action names |
| 10 | Perf (later) | 366 of 456 list queries have no `take`. 21 hit growing tables; on review almost all are naturally bounded (one announcement, one day, one approval window, pending items). ~115 return people-sized lists (directory, org chart, team boards) — fine at 136–500 people, revisit for companies in the thousands. | many services | Pagination where lists can grow without bound |

## What held up well

- **Cross-company writes: none got through.** All 141 write routes refused another company's admin (404/403) once the body was valid.
- **Cross-company reads:** every GET refused another company except #1/#2.
- **A plain employee could not read or act on anyone else's** leave request, expense claim, receipt, ticket, internal note, document, balance, grant or private profile. Bulk actions (`approve-bulk`, `tickets/bulk`) check each item and returned "0 done".
- **Unguarded routes are guarded in the service:** every one of the 105 signed-in-only routes either acts on the caller only, or calls an ownership / role check (`assertHandles`, `decidable`, `target`, `assertEmployeeInScope`, `editable`…) that loads the record **with** `companyId`.
- **Role editing** blocks privilege escalation (`assertNoEscalation`) and changing your own roles.
- **No 5xx** in 1,337 probe calls.
- **Browser:** employee (18 pages) and Company Admin (42 pages) made **no refused calls**; manager: only #3. Typing an HR address (`/app/employees`) as an employee triggered no refused call.

## Not covered

- Super Admin acting on company routes (Super Admin passes every permission check by design; company routes rely on the tenant context).
- Access controlled by **query parameters** (`?employeeId=`, `?view=all`) — only the values the pages send were exercised.
- File downloads and CSV exports beyond what the GET probe touched; WebSocket rooms are covered by `test/e2e/realtime.e2e.js`.

## Suggested order

1. ~~#1 + #2~~ — fixed: the company is checked before any PMO / own-record shortcut, the history lookup includes the company, and `test/e2e/tenant-isolation.e2e.js` (16 checks) proves another company's admin gets 404.
2. ~~#3 and #4~~ — fixed: the Extra-leave panel (HR lists) renders only for people with `leave.extra_decide` — before, it was the fallback tab while permissions loaded; `useMyCard` and `usePreferences` wait for the session (`isAuthenticated`). Checked in the browser: manager — no refused calls; HR — Extra leave still loads; page load — one 200 each for `/people/me` and preferences.
3. ~~#5, #7, #6~~ — fixed: old route removed; `GET /companies/:id` and `/settings` need `settings.view`, `/access/catalog` needs `role.view` (branding / theme / stats stay open — the portal uses them); "That helped" is recorded per person (`ticket_category_helps`, migration `20261106100000_helpdesk_topic_helps`) and only a first press adds to the count. Tests: `tenant-isolation` 26/26, `helpdesk-topics` 38/38.
4. ~~#8, #9~~ — fixed: the summary loads only open claims (any age) plus claims paid or dated this year — identical results for all 134 SeedsAI people before/after; the audit-action list is cached for 10 minutes (read from the data, since 11 seeded/older action names have no `@Audit` label). #10 when a large customer is near.
