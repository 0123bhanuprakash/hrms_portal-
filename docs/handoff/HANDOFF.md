# HRMS Portal — handoff for the next Claude session

Written 2026-10-05 at the end of a long Claude Code session, so a new Claude profile can continue without anything missing.
**New session: read this file first, then `docs/handoff/memory/*.md` (the decision log), then work.**

---

## 1. What the project is

A multi-tenant HRMS (company portal + Super Admin console).

| Part | Stack | Where |
|---|---|---|
| API | NestJS + Prisma + PostgreSQL | `apps/api` (dev on **:4000**) |
| Web | Next.js 14 app router, React Query, Tailwind (HSL CSS variables) | `apps/web` (dev on **:3000**) |
| Monorepo | pnpm + Turborepo | root (`AGENTS.md` = turbo agent note, keep **uncommitted**) |
| Design boards | Claude "Design" canvas artifact + local sources | `docs/design/` |

Git: work happens on `feat/super-admin-portal`, then merged into `main` and pushed (user asked for direct merges, no PRs). GitHub CI workflow was removed on purpose (user: "Both CI jobs fail can we remove this part"). The local pre-push hook runs `pnpm verify:fast`.

---

## 2. How the user likes to work (important)

1. For each module the user says: **"what enhancements can we do in X? think, plan and create screens on artifacts"** →
   review the existing code, design boards on the canvas artifact (new row per module), explain *existing vs new*, list questions.
2. User answers questions → says **"start working"** → build API + web + e2e tests, check in the browser, report.
3. **Commit / push only when asked.** When asked: commit on `feat/super-admin-portal`, merge into `main`, push both.
4. Plain, simple English in replies (the user is not a native speaker). Short explanations, tables are welcome.

### Standing rules (never break)
- **Never print secrets** from `.env` files. Super Admin creds are `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` in `apps/api/.env` — never print or type them.
- Don't commit `.env`, `AGENTS.md`, `.claude/`.
- **Never trigger notifications/emails on the dev API :4000** — it sends real Gmail. Test email flows only through the e2e runner (throwaway API on :4001, console email).
- **Sidebar and top bar must not change.** Add new views as tabs/pages, never new sidebar items; remove nothing existing.
- Don't build: "View as admin" (impersonation), WebSockets, 2FA (deferred), Payroll (postponed), Redis (deferred, no Docker).
- After browser tests, leave the browser signed in as **Hema** (HR) in `aakash-portal`.

### Test accounts (local only)
- Workspace `aakash-portal` (sign-in: `/login?company=aakash-portal`). Demo accounts `<first>.aakash@yopmail.com` — Hema = HR, Vikram = Manager/PMO, Ravi = Eng Manager, Priya & Karan = team leads, Amit/Neha/Sara = employees, Pooja = Finance, Divya = HR exec, Meena/Rahul = sales. Their shared demo password: **ask the user** (it's a local test value; the user typed it in chat before).
- `bhanu@yopmail.com` = Company Admin — **different password, ask the user**. There is **no IT admin** demo account, so IT-only asset screens (types/kits, returns & checks, hand-over) couldn't be clicked through in the browser; they are covered by e2e tests.

---

## 3. Commands

```bash
pnpm --filter @hrms/api test:e2e            # all API e2e suites (≈25 files) — starts its own :4001 API from dist
pnpm --filter @hrms/api test:e2e assets-plus  # one suite
pnpm verify                                  # typecheck + lint + unit + build + all e2e
cd apps/web && npx tsc --noEmit -p .         # web type-check
```
Notes:
- The e2e runner uses `apps/api/dist` — keep `nest --watch` (the dev API) running, or build first.
- If a stale server holds :4001, kill that PID first.
- Prisma migration recipe: edit `schema.prisma` → `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<ts>_<name>/migration.sql` → `npx prisma migrate deploy`. `prisma generate` may print a harmless EPERM on Windows.
- API error text is in `body.detail`; validation errors in `errors`. Notifications are fire-and-forget → poll with `eventually()` in tests.
- e2e helpers in `apps/api/test/e2e/lib.js`: `makeCompany`, `call`, `dropCompany`, `mailSnapshot`, `todayIn`, `addDays`.

---

## 4. What was done in the last session (all committed with this handoff)

| Module | Done |
|---|---|
| Projects | limited view for non-members |
| Timesheets | Tempo-style time blocks, no overlaps, project-lead approval, flexible submit; "Hours by project" removed |
| Expenses | over-limit with reason (flagged), monthly caps, questions, reject single items, bulk approve, summary, copy, report; payments = "coming soon" |
| **Assets (this commit)** | see below |

### Assets — what was built
**Decisions** (see `memory/asset-decisions.md`): QR labels/scan = "Coming soon" only · yearly "still have it?" check · request to **keep** or as a **loan** (dates, max days per type) · managers request for their team · approval chain **team lead → manager → HR → IT head**, one after another (step skipped if nobody / the requester) · no depreciation · **starter kits** auto-created for new joiners and on promotion, **no approvals** (I chose this; user never objected — confirm if it comes up) · product animations.

**API** (`apps/api/src/modules/assets/`): migration `20261020100000_assets_plus`; new type settings (icon, description, warranty months, replace-after years, min stock, requestable, loanable + max days, extra fields, hand-over checklist); specs, repairs log, documents; loans (`dueBack`, reminders 2 days before + overdue); sequential request chain with preview; best-match on hand-over; CSV import (dry run, all-or-nothing); bulk move; report a problem → helpdesk ticket; ask to return; returns list (leavers + loans due); yearly checks (start/remind/close/answer); kit rules CRUD + preview + auto-provision on employee create, designation/department change, and new roles.
Tests: `assets.e2e.js` 46/46, `assets-plus.e2e.js` 64/64, **full suite all green**.

**Web**:
- `components/assets/product-art.tsx` — drawn devices with motion (`ProductArt`, `UnboxMoment`, `LoanRing`); CSS in `app/motion.css` (`.pa-*`).
- `components/assets/asset-dialogs.tsx` — asset form (+specs), assign (+loan, checklist), **HandOverDialog** (best match + checklist), return, status (repair issue/vendor, repair cost), **ProblemDialog**, **ImportDialog**.
- `components/assets/asset-lists.tsx` — held assets, `RequestSteps` tracker, request list, decide dialog.
- Pages under `app/(app)/app/assets/`: `mine` (unconfirmed banner + "I got it" unboxing, cards with loan ring, Problem/Swap/Return, yearly check, "waiting for your approval" for leads/managers), **new `request`** page (catalogue with stock, keep/loan, for me/team member, approver preview), `requests` (Waiting for me / To hand over / New joiners / All — open to anyone with items waiting), register `page.tsx` (KPIs, needs-attention chips, Register / By person / Returns & checks tabs, bulk move, import, QR "Soon"), `[id]` detail (art hero, specs, repairs, documents, loan ring, QR coming soon), `types` (rich type editor + **Starter kits** tab).
- Add-employee wizard shows the starter-kit preview on the review step.

### Small loose ends (optional)
- IT-only screens weren't clicked through in the browser (no IT demo account). If the user provides an IT account or the Company Admin password, check: Types → Starter kits editor, Register → Returns & checks, the hand-over dialog, the "I got it" unboxing.
- Team leads/managers don't get a sidebar link to "Asset requests" (sidebar is frozen); they reach it via the notification link and the "Waiting for your approval" section on My assets.

---

## 5. What's next

The user goes module by module through the sidebar. Done in this cycle: Projects, Timesheets, Expenses, Assets.
**Most likely next request: "Helpdesk" enhancements** (Plan B order was Announcements → Expenses → Assets → Helpdesk), then others the user names (Attendance, Leave, People, Reports…).
Bigger roadmap (from `memory/next-session-plan.md` + `memory/ui-roadmap-phases.md`): UI phase 2 (enhance every module's UI, then 2–3 whole-UI themes), phase 3 fonts, step 8 "getting ready for real users". Parked: Payroll, Redis, 2FA, Super Admin "What's new" + Support inbox.

---

## 6. Design boards (artifacts) — how to carry them over

Artifacts on claude.ai belong to the account that made them; a different Claude profile **can't open or edit them** unless they are shared with it. Three ways to carry them over (use any):

1. **Everything is in the repo now** (`docs/design/`), so the new profile can rebuild/republish:
   - `docs/design/canvas/` — the full current canvas: `canvas.json` (layout, rows, labels) + 73 `*.dc.html` boards. Identical to published version 30.
   - `docs/design/builders/build-*.js` — scripts that generated each module's boards (e.g. `build-assets.js`). They write into `docs/design/canvas/` and, if `docs/design/remote/canvas.json` exists, start from that (used after the web canvas was edited).
   - `docs/design/concepts/` — the older dashboard concept boards.
   - `docs/hrms-product-plan.html` — the product plan page.
   - Preview locally: `node docs/design/serve.js` → http://localhost:5599/<Board>.dc.html (e.g. `CAAssetRegister.dc.html`).
   - **To recreate the canvas in the new profile:** ask Claude to "create a new Design artifact and publish the files in `docs/design/canvas/` (canvas.json + all .dc.html files under `project/`)". From then on use that new link.
2. **Share the existing links** from this account (open each on claude.ai → Share) with the other account:
   - Final screens canvas: https://claude.ai/artifact/9SGEgQWW4kE8VNjjztW8yE
   - Dashboard concepts: https://claude.ai/artifact/95bXqxb9Go7gRcVnvPXpPv
   - Product plan: https://claude.ai/artifact/N9hWTiSd8rCzKWpPGMFb9F
   Edit access lets the new profile keep updating the same canvas.
3. Download/export from the artifact page if you want a personal copy.

Canvas rows so far: dashboards/home, motion, atmosphere, Super Admin (companies, plans, system, profile), Company · Announcements, Kudos, People, Employees, Organisation, Projects, Reports, Timesheets, Expenses, Assets.

---

## 7. Claude memory (decision log)

Claude Code memory lives on this PC in `C:\Users\bhanu.prakash\.claude\projects\C--Users-bhanu-prakash-Desktop-hrms-portal\memory\`. A copy is in `docs/handoff/memory/`.
- Same Windows user + same folder → the new profile will likely load it automatically.
- If it doesn't: tell the new session "read `docs/handoff/memory/` and save these as your memories".

---

## 8. First message to paste into the new Claude session

> Continue my HRMS project in this folder. First read `docs/handoff/HANDOFF.md` and every file in `docs/handoff/memory/`, then summarise in 5 lines what you understood and what's next. Follow the rules in section 2 (no secrets, no emails on :4000, sidebar frozen, commit only when I ask). Design boards are in `docs/design/` — publish them as a new Design artifact so we can keep using the canvas.
