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

## Part 3 — Company Admin: User management (main work)

Data model already exists: `users`, `roles` (system roles: company_admin, hr,
manager, employee; `company_id` nullable → per-company custom roles possible),
`permissions`, `role_permissions`, `user_roles`. The users API today only has
`/users/me*` endpoints.

### Decision needed at the start
- **Roles:** built-in roles only (assign company_admin / hr / manager / employee), **or** also custom roles per company with a permission picker?

### 3.1 API (`/companies/:companyId/users`, guarded by `user:*` permissions + tenant check)
- `GET    /users` — list: search (name/email), filter by role & status, sort, paginate.
- `POST   /users` — invite: name, email, role(s) → temporary password + welcome email (reuse the Company Admin invite email) + `must_change_password`.
- `GET    /users/:id` — detail: roles, status, last login, sessions count.
- `PATCH  /users/:id` — edit name / roles.
- `PATCH  /users/:id/status` — activate / deactivate (deactivate revokes all sessions).
- `POST   /users/:id/resend-invite` — never-logged-in users only.
- `POST   /users/:id/reset-password` — email a reset link.
- Roles: `GET /roles` (+ `POST/PATCH/DELETE` if custom roles chosen; system roles read-only).
- **Guards / rules:**
  - Every lookup is scoped by `companyId`; any linked ID (role IDs) must belong to the same company or be a system role. Build this as a reusable helper — Employees/Departments later follow the same pattern.
  - A Company Admin cannot deactivate themselves or remove the last `company_admin`.
  - Email unique platform-wide → friendly 409.
  - Everything audited (`@Audit`).
- Permissions: keys already exist in `packages/types/src/constants.ts` (`user:create|read|update|delete|deactivate`, `role:create|read|update|delete`) — confirm they are seeded and granted to `company_admin` (and `hr` for users).

### 3.2 Web (`/app/users`, `/app/roles`)
- Users page: table with search/filters, status + role badges, last login, row actions (edit, change role, deactivate, resend invite, reset password), empty state.
- Invite dialog: name, email, role picker → success shows "invite sent".
- User detail drawer/page: profile, roles, activity (from audit log), sessions.
- Roles page: role list with permission matrix (read-only for system roles; editable if custom roles).
- Nav: enable "Users" (+ "Roles") in the company sidebar, hidden when the user lacks `user:read`.
- Same premium design system + company theme; mobile layout checked.

### 3.3 Verify
- API: typecheck + scripted checks (tenant isolation: company A cannot read/edit company B users — expect 404; last-admin rule; invite → email received at a yopmail address).
- Browser: invite a test user → sign in with temp password → forced password change → lands in portal with the right permissions.
- Test account: `bhanu@yopmail.com` on `aakash-portal` (password from chat when needed).

---

## Later (not this session)
- Employees / Departments / Designations / Locations modules (same tenant-check helper).
- Row-level security (RLS) as a database safety net.
- ESLint + automated tests + CI.
- Theme sent with the login response (removes the brief theme flash on a new browser).
- Clean up old Super Admin sessions (curl / no user-agent) — from Profile → Sessions.
