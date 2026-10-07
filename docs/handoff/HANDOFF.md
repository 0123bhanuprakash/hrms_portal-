# HRMS Portal — handoff for the next Claude session

Last updated **2026-10-07 (evening IST)** at the end of the Claude profile used from 2026-10-05 to 2026-10-07, so a new Claude profile can continue without anything missing.
**New session: read this file first, then every file in `docs/handoff/memory/` (the decision log; start with `MEMORY.md`), then `docs/realtime.md`, then work.**

---

## 1. What the project is

A multi-tenant HRMS (company portal + Super Admin console).

| Part | Stack | Where |
|---|---|---|
| API | NestJS + Prisma + PostgreSQL (schema `hrms`, DB `hrms` on localhost:5432) | `apps/api` (dev on **:4000**) |
| Web | Next.js 14 app router, React Query, Tailwind (HSL CSS variables), Socket.IO client | `apps/web` (dev on **:3000**) |
| Live updates | Socket.IO gateway in `apps/api/src/modules/realtime/` | rules + event list in `docs/realtime.md` |
| Monorepo | pnpm 11 + Turborepo | root (`AGENTS.md` = turbo agent note, leave it alone) |
| Design boards | Claude "Design" canvas artifact + local sources | `docs/design/` (+ `design/` = design DNA / rules docs) |

Git: work happens on `feat/super-admin-portal`, then merged into `main` and pushed (user wants direct merges, no PRs). Remote: `origin` = github.com/0123bhanuprakash/hrms_portal-. GitHub CI workflow was removed on purpose. The local pre-push hook runs `pnpm verify:fast`.

---

## 2. How the user likes to work (important)

1. For each module the user says: **"what enhancements can we do in X? think, plan and create screens on artifacts"** →
   review the existing code, design boards on the canvas artifact (new row per module, use the `hrms-designer` agent in `.claude/agents/`), explain *existing vs new*, list questions.
2. User answers questions → says **"start working"** → build API + web + e2e tests, check in the browser pane, report.
3. **Commit / push only when asked.** When asked: commit on `feat/super-admin-portal`, merge into `main`, push both.
4. Plain, simple English in replies (the user is not a native speaker). Short explanations, tables are welcome.
5. The user often runs several Claude sessions in parallel in this same folder. Before committing, check no other session is mid-change (Claude desktop → session list), and re-read shared files like `apps/web/src/app/(app)/layout.tsx` before editing.

### Standing rules (never break)
- **Never print secrets** from `.env` files (`SUPER_ADMIN_*`, `SEEDSAI_PASSWORD`, `DEMO_PASSWORD`, `PII_ENCRYPTION_KEY`, JWT keys…). Never type them into chat.
- Don't commit `.env` or `.claude/launch.json` local changes.
- **Never trigger notifications/emails on the dev API :4000** — it sends real Gmail. Test email flows only through the e2e runner (throwaway API on :4001, console email).
- **Sidebar and top bar must not change.** Add new views as tabs/pages. Only exception so far (user approved 2026-10-07): the **Work** section has 5 items — Projects · Resource requests · PMO pool · My timesheet · Timesheet approvals. No new sections.
- Still not to build: "View as admin" (impersonation), 2FA (deferred), Payroll (postponed), Redis (deferred, no Docker). *(WebSockets used to be on this list — the user reversed it; they are built.)*
- After browser tests, restore whatever account/preferences the browser pane was using (back up the session first, restore after).

### Test accounts (local only — passwords are never stored in the repo)
- **`aakash-portal`** (`/login?company=aakash-portal`): demo accounts `<first>.aakash@yopmail.com` — Hema = HR, Vikram = Manager/PMO, Ravi = Eng Manager, Priya & Karan = team leads, Amit/Neha/Sara = employees, Pooja = Finance, Divya = HR exec, Meena/Rahul = sales. Shared demo password: **ask the user**. `bhanu@yopmail.com` = Company Admin (different password, ask).
- **`seedsai`** (`/login?company=seedsai`): 136 people, a full year of data in every module (Oct 2025 → today). Logins `<first>.<last>.seedsai@yopmail.com`, all use `SEEDSAI_PASSWORD` from `apps/api/.env`. Full list with roles: `apps/api/prisma/seedsai/LOGINS.md`. CEO aditya.varma, COO meera.krishnan, Company Admin rohan.kapoor. Re-seed: `pnpm --filter @hrms/api db:seed-seedsai` (`-- --reset` to rebuild).
- **`resources-demo`**: small company for resource requests (`<first>@resources-demo.test`, `DEMO_PASSWORD`), seeded by `apps/api/prisma/seed-resources-demo.cjs` (API :4000 must run; sends no emails).
- **`perf-bench`** (493 people): `hr@perf-bench.test`, `bhanu1@yopmail.com` = Company Admin. Passwords: ask the user.
- Super Admin: `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` in `apps/api/.env` — never print them.

---

## 3. Commands

```bash
pnpm dev                                      # turbo: API :4000 (nest --watch) + web :3000 (next dev --turbo)
pnpm verify:fast                              # typecheck + lint + unit tests (pre-push hook)
pnpm --filter @hrms/api build                 # needed before e2e (runner uses apps/api/dist)
pnpm --filter @hrms/api test:e2e              # all API e2e suites (33 files) — own :4001 API, console email
pnpm --filter @hrms/api test:e2e resources    # one suite
pnpm verify                                   # everything above in one go
```
Notes:
- If a stale server holds :4001, kill that PID first.
- **Turbopack gotcha (Next 14 `--turbo`)**: after hours of hot reloads a page can fail with `TypeError: Cannot read properties of null (reading 'useContext')` in `usePathname`/`ErrorBoundary`. It is a stale build of that one page, not a code bug. Fix: stop `pnpm dev`, `Remove-Item -Recurse -Force apps\web\.next` (PowerShell), start again. Launch config `web` without turbo is the slower but safer fallback.
- The user's terminal is **PowerShell** — give PowerShell commands, not bash (`rm -rf` fails there).
- Prisma migration recipe: edit `schema.prisma` → `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<ts>_<name>/migration.sql` → `npx prisma migrate deploy`. `prisma generate` may print a harmless EPERM on Windows. 47 migrations, dev DB up to date (last: `20261027100000_resource_requests`).
- API error text is in `body.detail`; validation errors in `errors`. Notifications are fire-and-forget → poll with `eventually()` in tests.
- e2e helpers in `apps/api/test/e2e/lib.js`: `makeCompany`, `call`, `dropCompany`, `mailSnapshot`, `todayIn`, `addDays`.
- If an e2e run is killed mid-way, `system.e2e` may leave maintenance mode ON in the shared DB ("Back soon (e2e)") → set platformSetting `maintenance`.enabled = false.
- Launch configs (`.claude/launch.json`): `api`, `api-built` (runs `dist`), `web`, `web-turbo`, `web-prod` (`.next-prod` dist dir so it can run next to dev), `design` (board preview on :5599).

---

## 4. State at handoff

**Everything is committed and merged into `main` and pushed** (this commit). Nothing important is left only in the working tree.

### Built since the last handoff (2026-10-05 → 2026-10-07)
| Area | Notes / where |
|---|---|
| Helpdesk round | `memory/helpdesk-design.md` |
| Time module, Settings round + seasonal themes, Administration + popup form kit | `memory/time-module-design.md`, `settings-design.md`, `admin-forms-design.md` |
| Ambient backgrounds: Signature, Terra, Prism, Simple packs | `memory/ambient-backgrounds.md` |
| Emoji animations (`<Emoji>`) | `memory/emoji-animations.md` |
| UI polish: custom dropdowns, chart motion, instant nav, Glide + Peek menu styles, Rail removed | `memory/ui-polish-round.md` |
| Perf fixes 1–5 | `memory/perf-findings.md` |
| **Live updates (WebSockets)** everywhere + @mentions | `memory/live-updates.md`, **`docs/realtime.md`** (keep it updated with every new live event) |
| **Resource requests + PMO pool** (this commit) | see below |
| **SeedsAI test company** (this commit) | `memory/seedsai-test-company.md` |
| **Error handling round** (this commit) | see below |

### Resource requests — what was built (this commit)
Decisions in `memory/resource-requests-design.md` (13 answered questions). Designs = canvas boards `CARes*` (`docs/design/builders/build-resources.js`).
- Chain **Lead → PM → Delivery Director → PMO**; PM/DD can fill from their own people; hold (with reason + optional remind date, nudge after 7 days) / unhold / reject (reason) / withdraw / fill at lower % with a note / consent step from another PM when their person's time is cut / release (PM or DD decide, PMO can nudge) / request back.
- API: `apps/api/src/modules/projects/resources.{controller,service,dto}.ts` + `pmo-pool.ts`, migration `20261027100000_resource_requests` (DD per project, one PM per project, requests, steps, assignment log, employee `reportsToPmo`, skills, project tech stack). Routes under `resources/`: context, requests (+count, detail, candidates, forward, fill, hold, unhold, reject, withdraw, consent, release-decision, nudge), releases, pool, history/:employeeId, skills.
- New permission "Lead the PMO pool" (`project.pmo_lead` in `access/catalog.ts`) — people reporting to the PMO get their leave/timesheet/attendance approvals from holders of it. The user creates the "PMO lead" role by hand.
- Web: `app/(app)/app/resources/` (inbox + `[id]` detail), `app/(app)/app/pmo-pool/`, `components/resources/*`, `components/employees/reports-to.tsx` ("Reports to: a person OR the PMO" in add-employee + drawer), `components/projects/assign-dialog.tsx`, skills on the profile, tech stack + DD on projects, `lib/company/resources.ts`.
- Tests: `apps/api/test/e2e/resources.e2e.js` (59 checks) + `project-planning.e2e.js` updated.

### Error-handling round (this commit)
- `apps/web/src/lib/save-errors.ts`: one global fallback — any failed save that shows nothing gets a toast with the server message (skips session-expired, re-auth, maintenance; stays quiet when the form already showed the error). Background saves opt out with `meta: { quietErrors: true }` on the mutation.
- `CardError` + `InlineRetry` in `components/ui/feedback.tsx`; failed loads now show **Try again** on: expenses (summary, payments, categories), resource requests, PMO pool, asset requests, 11 Home cards, "Needs your action", Settings → Preferences/Branding, Helpdesk new ticket/topics, Roles compare, emailed reports dialog, Super Admin profile + new-company wizard.
- Rule used: show the error **only when there is nothing to display** (`isLoadingError`), so a failed background refresh keeps the old numbers.

---

## 5. What's next (open items, in rough order)

1. **Small follow-up from the error round:** ~50 older pages already had error states but replace loaded data with an error when a background refresh fails. One-word change per page (`isError` → `isLoadingError`). The user hasn't said go yet.
2. **Session/workspace decision (open question to the user):** separate sign-in session per browser tab, or one shared session with the known bugs fixed (Claude recommended the shared session). Steps 1–4 and 6 of that plan wait on this answer.
3. **Full API + access audit** — planned, not started. See `memory/api-access-audit.md` (per-role network calls, routes without `@RequirePermission` returning only own data, unbounded `findMany` lists, over-fetching like `/reports/people`).
4. **SeedsAI browser walk-through** per role (API checks passed, the browser walk-through was never done).
5. Next module enhancement rounds the user names (Attendance, Leave, People, Reports…), same "design → answers → build" flow.
6. Bigger roadmap: UI phase 2 (every module's UI, 2–3 whole-UI themes), phase 3 fonts, "getting ready for real users" (`memory/next-session-plan.md`, `memory/ui-roadmap-phases.md`).
7. Parked: Payroll, Redis, 2FA (`memory/two-step-sign-in-later.md`), Super Admin "What's new" + Support inbox (`memory/super-admin-upcoming.md`).

---

## 6. Design boards (artifacts) — how to carry them over

Artifacts on claude.ai belong to the account that made them; a different Claude profile **can't open or edit them** unless they are shared with it.

1. **Everything is in the repo** (`docs/design/`), so the new profile can rebuild/republish:
   - `docs/design/canvas/` — the full current canvas: `index.html` (pan/zoom viewer), `canvas.json` (layout, rows, notes) + every `*.dc.html` board (incl. the 21 `CARes*` resource boards).
   - `docs/design/builders/build-*.js` — scripts that generate each module's boards. They write into `docs/design/canvas/`.
   - `design/` — design DNA, AI-slop rules, review checklist, decision log, module design status.
   - Preview locally: launch config `design` → http://localhost:5599/index.html.
   - **To recreate the canvas in the new profile:** publish `docs/design/canvas/index.html` as a new artifact with every `*.dc.html` + `canvas.json` as files (root `docs/design/canvas`). The `hrms-designer` agent (`.claude/agents/hrms-designer.md`) knows the steps — update the URL in it and in `memory/design-canvas-link.md` afterwards.
2. **Share the existing link** from this profile with the other account (open on claude.ai → Share): current canvas https://claude.ai/artifact/PE4MAYbpvjYpiR2bs784eC
3. Older links (from the first profile, may not open): https://claude.ai/artifact/9SGEgQWW4kE8VNjjztW8yE (old canvas), https://claude.ai/artifact/95bXqxb9Go7gRcVnvPXpPv (dashboard concepts), https://claude.ai/artifact/N9hWTiSd8rCzKWpPGMFb9F (product plan, source `docs/hrms-product-plan.html`).

---

## 7. Claude memory (decision log)

Claude Code memory lives on this PC in `C:\Users\bhanu.prakash\.claude\projects\C--Users-bhanu-prakash-Desktop-hrms-portal\memory\`. An exact copy (29 files, 2026-10-07) is in `docs/handoff/memory/`.
- Same Windows user + same folder → the new profile will probably load it automatically.
- If it doesn't: tell the new session "read `docs/handoff/memory/` and save these as your memories".
- Note: some memory notes say "uncommitted" — that was true when written; as of this handoff **everything is committed**.

---

## 8. First message to paste into the new Claude session

> Continue my HRMS project in this folder. First read `docs/handoff/HANDOFF.md`, every file in `docs/handoff/memory/`, and `docs/realtime.md`, then summarise in 5 lines what you understood and what's next. Follow the rules in section 2 (no secrets, no emails on :4000, sidebar frozen except the Work section, commit only when I ask). Design boards are in `docs/design/` — publish them as a new Design artifact so we can keep using the canvas.
