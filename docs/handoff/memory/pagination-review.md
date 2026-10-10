---
name: pagination-review
description: Pagination/search round — B, A1–A14 and C all BUILT 2026-10-09 (uncommitted)
metadata:
  node_type: memory
  type: project
  originSessionId: 2b299abe-85d8-4e03-9ac2-3a416bba5b83
  modified: 2026-10-08T20:31:14.647Z
---

User asked 2026-10-09 (example: Reports → Utilisation "By week" loaded everyone) for a plan, then chose **B + A1–A8**, page size 25, numbered pages for tables and "Load more" for drawers / pop-ups. BUILT 2026-10-09, NOT committed:

- Rule used everywhere: page the rows, but KPIs / counts / CSV exports stay computed on everyone server-side; responses carry `meta {total,page,limit,totalPages}` and per-filter `counts`.
- A1 Utilisation: `reports.service.ts` utilisation() = utilisationAll() + search/show(bench|low|over|nolog)/sort/page; weekly grid only last 8 weeks, only page rows. CSV uses utilisationAll.
- A2 Attendance day drawer: counts + first 10 per group, `?group=&page=` for "Show all". B4 People drill list: `{rows, meta}` + search, Load more, Export fetches every page.
- A3 Planner: show(full|partly|free|bench) + pages, cells only for the page. A4 /projects/available: search + `{rows, meta}`, 8 per Load more.
- A5 PMO pool: server search/show/pages (24 cards). A6 Timesheet team week: search/show/pages + counts. A7 Attendance insights: first 5 + counts + `missingCheckoutIds`, `?list=` "See all" modal.
- A8 `/org/people` now searches (20, max 50; `ids`, `userIds`, `managers`, `exclude`, `departmentId`); `usePeoplePicker` removed; new `components/people/person-search.tsx` (PersonSearch) used in 12 forms; SearchSelect got `onSearch`/`searching`.
- B1 projects list pages (24; board 100 + note), health chip counts from `meta.health`; assign dialog searches. B2 helpdesk board Load more (100 each). B5 access explorer users search, Super Admin audit-log company filter searches, plan Companies tab pages.
- Shared web bits: `components/ui/list-tools.tsx` (useDebounced, SearchField, FilterChips), `LoadMore` in feedback.tsx.
- Tests: e2e reports, reports-insights, project-planning, resources, time-plus, timesheets, employee-lifecycle all pass; verify:fast green. Browser-checked on a throwaway company (see [[browser-test-company]]).

Round 2 (user: "work on a9-a14 then c"), BUILT 2026-10-09, uncommitted:
- A9: org chart NOT lazy-loaded — measured 37 KB gzipped / 279 KB raw for 495 people (compression already on); lazy branches would mean redesigning search, team sizes, drag-move and PNG export. Instead only the Chart/List views load /org/chart: MoveDialog + department head picker use PersonSearch, department head names via usePeopleByIds (batches of 50), Insights uses server `stats.spans`; org page no longer flashes the chart while access loads.
- A10 org health: ≤12 people per item + `count`. A11 announcement reach: `?tab=waiting|done|rsvp&search&page`, counts + byDepartment server-side, CSV fetches every page. A12 expenses report: top 10 + "__others" row per breakdown, `breakdownCounts`, GET /expenses/report/breakdown (See all), to-be-paid summed in DB. A13 delegations: /delegations/all paged `{rows, meta}`, /delegations/gaps `{rows (25), total}` with batched queries (withTeams). A14 asset checks: newest 10 problems + `reportsTotal`, GET /assets/checks/:id/reports.
- C: helpdesk directory median via SQL percentile_cont; Super Admin company list pages in DB for createdAt/name/status sorts (health/employees/lastActivity sorts still compute all); kudos insights all SQL aggregates; project summary/timeline/reminders no longer capped at 1000 (list(..., everything)).
Related: [[api-access-audit]].
