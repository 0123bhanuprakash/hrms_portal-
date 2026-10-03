# Plan — 2 Oct 2026, after 12 PM

Branch: `feat/super-admin-portal` (last commit `2332fb1`). Super Admin portal is
feature-complete for day-to-day use; this session moves to local Postgres and
the Company Admin portal.

---

## Part 1 — Local PostgreSQL (~30 min)

**Why:** Supabase (Mumbai) costs ~25–30 ms per query → 100–190 ms per API call.
Local Postgres ≈ 1 ms per query → ~10–20 ms per call, and no 15-connection cap.

**You (before we start):**
1. Install PostgreSQL 16/17 — https://www.postgresql.org/download/windows/ (EDB installer, includes pgAdmin).
2. Remember the `postgres` password; keep port **5432**.
3. Decide: **copy Supabase data** (keeps aakash-portal, acme-test, themes, your users) or **fresh seed**.
4. Type the password into `apps/api/.env` yourself when asked (don't paste it in chat).

**Claude:**
1. Create database `hrms` (schema `hrms`) and a `.env` backup.
2. Set `DATABASE_URL` / `DIRECT_URL` → `postgresql://postgres:<pw>@localhost:5432/hrms?schema=hrms`
   (no pgbouncer / connection_limit needed locally). Keep the Supabase URLs commented in `.env` for deploy.
3. Either `pg_dump` the `hrms` schema from Supabase → restore locally, or `pnpm db:setup` (migrate + seed).
4. Stop dev server → `prisma generate` (the running API locks the engine DLL) → restart `pnpm dev`.
5. Re-run the latency benchmark (before/after numbers) and a browser smoke test (both logins).
6. Update `apps/api/.env.example` + README with a "Local Postgres" option.

**Done when:** both portals work locally, API calls are < 30 ms, migrations run against local DB.

---

## Part 2 — Security fixes first (~1 h)

Small, and user management will add more sign-in / invite traffic.

| # | Fix | Detail |
|---|-----|--------|
| 2.1 | **Turn on rate limiting** | `ThrottlerModule` is configured (`default` 100/min, `auth` 10/min) but `ThrottlerGuard` is **not registered** — nothing is limited today. Register it as a global guard; apply the `auth` limit to login, forgot-password, reset-password, verify-email and the public by-slug lookup. Return 429 with `Retry-After`. |
| 2.2 | **Stop account enumeration** | Wrong password on a real account says "N attempt(s) remaining"; unknown email doesn't. Use one generic message for both; keep the lockout itself (429 after 5 failures). |
| 2.3 | **Force password change on first login** | New `users.must_change_password` (set when an admin/invite creates a temporary password, cleared on change/reset). Login returns the flag; web shows a "Choose a new password" screen before entering the portal. Applies to Company Admins created by the Super Admin too. |

---

## Part 3 — Company Admin: Users + custom Roles & Permissions (main work)

**Decision made:** custom, company-specific roles with granular permissions (proper RBAC).
Full design: [rbac-design.md](rbac-design.md).

Summary:
- Permission catalog in code (`module.action`, with scopes own / team / department / company).
- Each company gets its own editable copies of the role templates (Company Admin, HR, Manager, Employee);
  Company Admin is a locked owner role with all permissions. A user can hold several roles (access = union, broadest scope wins).
- Permissions leave the JWT; resolved per request from a version-keyed cache → role edits apply immediately.
- Guardrails: no privilege escalation, last-admin protection, same-company checks, audited diffs.
- UI: Users page + Roles & Permissions with a permission-matrix editor and plain-language summary.

Order: backend steps 1–5 this session (scripted tests), UI steps 6–9 next session.
Decided: multiple roles per user; team = direct reports; HR template = editable starting point (default: all except payroll run + role management).

---

## Later (not this session)
- Employees / Departments / Designations / Locations modules (same tenant-check helper).
- Row-level security (RLS) as a database safety net.
- ESLint + automated tests + CI.
- Theme sent with the login response (removes the brief theme flash on a new browser).
- Clean up old Super Admin sessions (curl / no user-agent) — from Profile → Sessions.
