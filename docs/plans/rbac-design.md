# Custom Roles & Permissions (RBAC) — design

> **Superseded by [access-control-design.md](access-control-design.md)** (adds feature toggles and hierarchy scopes). Catalog, guardrails and API notes below still apply.

Status: **proposed**, 2 Oct 2026. Replaces "built-in roles only".
Goal: each company defines its own roles and exactly what each role can do,
with a permission model that scales as new HRMS modules are added.

---

## 1. Where we are today (and why it has to change)

| Today | Problem for custom roles |
|---|---|
| 5 **global** system roles (`company_id = null`) shared by every company | A company can't edit "HR" without changing it for everyone |
| Permissions copied **into the JWT** at sign-in | Editing a role takes up to 15 min to apply; token grows with every permission |
| "Own data" = separate keys (`employee:read_own`, `leave:read_own`, …) | Doubles the key list; no "my team" or "my department" level at all |
| `user_roles` allows many roles per user, UI assumes one | Ambiguous effective access; hard to audit |
| No role status, no versioning, no escalation rules | Can't deactivate a role; anyone with `role:update` could grant themselves everything |

Good news: only themes/branding/settings use `@RequirePermission` so far, and the
HR modules (employees, leave, payroll…) aren't built yet. **Now is the cheapest
moment to reshape the model.** `employees` already has `user_id`,
`department_id` and `reporting_manager_id`, which is everything data scopes need.

---

## 2. Core concepts

```
Permission catalog (code)        Company roles (DB, per company)        Users
──────────────────────────       ─────────────────────────────────      ─────
module  × action  (+ scope?)  →  Role = name + set of grants        →   one or more roles
employee.view   [scopable]       grant = permission + scope             (HR is an employee
leave.approve   [scopable]         scope ∈ own | team | department         whose role has
payroll.run                                 | company                      extra grants)
```

- **Scopes later:** add "team (all levels)" — the whole reporting tree below a manager — as one more scope option (agreed 2 Oct; v1 ships direct reports only).
- **A user can have one or more roles** (decided 2 Oct). Everyone gets a base role
  (usually Employee); the admin can add more, e.g. Employee + HR, or Employee + Manager + HR.
  **Effective access = the union of all their roles' grants**; when two roles grant the
  same permission at different scopes, the **broadest scope wins** (team + company → company).
  The UI always shows the combined result ("what this person can actually do") so stacked
  roles stay easy to audit. Every user must keep at least one role.
- **Company Admin** is a locked **owner role**: implicitly has *every* company
  permission at company scope — including permissions added by future modules — and
  can't be edited, deactivated or deleted. Each company must keep ≥ 1 active admin.
- **Super Admin** stays outside company RBAC (platform portal, unchanged).

---

## 3. Permission catalog (single source of truth, in code)

Lives in `packages/types/src/permissions/` and is shared by API and web.

```ts
defineModule({
  key: 'leave', label: 'Leave', group: 'Time & attendance', icon: 'CalendarDays',
  status: 'available',            // 'available' | 'coming_soon' → UI shows/greys it
  actions: {
    view:    { label: 'View requests',     scopes: ['own','team','department','company'] },
    request: { label: 'Apply for leave',   scopes: ['own'] },
    approve: { label: 'Approve / reject',  scopes: ['team','department','company'], requires: ['view'] },
    manage_types: { label: 'Manage leave types', sensitive: false },
    adjust_balance: { label: 'Adjust balances',  sensitive: true, requires: ['view'] },
  },
})
```

- **Key format:** `module.action` (e.g. `leave.approve`). Old `*_own` keys disappear —
  "own" becomes a scope.
- **Standard action vocabulary:** `view, create, edit, delete, approve, export, import,
  manage` + module-specific ones (`employee.terminate`, `payroll.run`, `salary.view`).
- **Scopes** (only for actions that declare them):
  `own` (my records) → `team` (my direct reports) → `department` → `company`.
- **`requires`** — dependencies auto-added (edit ⇒ view, approve ⇒ view).
- **`sensitive`** — salary, payroll, audit logs, role management: highlighted in the UI,
  confirmation on grant.
- Modules covered from day one: Users, Roles, Employees, Departments & Designations,
  Locations, Attendance, Leave, Payroll & Salary, Documents, Reports, Settings &
  Branding, Audit Logs (+ Recruitment, Performance, Assets, Expenses, Helpdesk as
  `coming_soon`).
- **Sync:** on API start-up the catalog is upserted into `permissions` (new keys appear
  automatically; removed keys are flagged, never silently dropped).

---

## 4. Database changes (one migration + data migration)

```
permissions        + label, group, scopes text[], sensitive bool, deprecated bool
roles              + key (slug), is_owner bool, is_default bool,
                     status ACTIVE|INACTIVE, version int, created_by, updated_by
                     company_id NOT NULL for company roles (templates keep null + is_template)
role_permissions   + scope text NULL   (NULL for non-scoped actions)
user_roles         (user_id, role_id) — many roles per user; ≥ 1 enforced in the API
users              + must_change_password (from the security fixes)
```

**Role templates** (global, `is_template`, seed-defined): Company Admin (owner),
HR, Manager, Employee — with sensible default grants:

| Template | Highlights |
|---|---|
| Employee | own profile/attendance/leave/payslips/documents; apply leave; mark attendance |
| Manager  | Employee + team view of employees/attendance/leave; approve team leave & regularisation; team reports |
| HR       | Employee + company-wide employees, attendance, leave, documents, departments; approve; reports; *no* payroll run, *no* role management by default |
| Company Admin | owner — everything |

**On company creation** the templates are **cloned into company-owned roles** — the
company then edits its copies freely. **Existing companies** (aakash-portal,
acme-test, beta-test) get the same clone in the data migration, and their
`user_roles` are repointed from the global roles to their own copies.

---

## 5. How access is checked (API)

1. **JWT gets slimmer:** `sub, company_id, sid, is_super_admin` — no permission list.
2. **`AccessService.resolve(userId)`** → `{ roleIds, grants: Map<key, scope|null>, isOwner }` — union of all the user's roles, broadest scope per key.
   - Each role's grants are cached in memory per `roleId@version` (Redis later); a user's access is the merge of their cached roles. The JWT strategy *already*
     does one DB query per request — it now also selects the user's role ids + versions,
     so access costs **no extra query** on a cache hit.
   - Any role edit bumps `roles.version` → every member picks up the change on their
     **next request** (no 15-minute wait).
3. **Guard:** `@RequirePermission('leave.approve')` passes if the role holds that key
   at *any* scope (owner role always passes) and attaches `req.access`.
4. **Data scoping in services:** `scopeWhere(req.access, 'leave.view', ctx)` returns the
   Prisma filter, always combined with `company_id`:
   - own → `employee.userId = me`
   - team → `employee.reportingManagerId = myEmployeeId` (direct reports; deeper levels later)
   - department → `employee.departmentId = myDepartmentId`
   - company → company only
   Records outside the scope return **404** (no existence leaks), like tenant isolation.
5. **Guardrails (enforced server-side):**
   - **No privilege escalation:** a non-owner editing roles can only grant permissions
     *they hold*, at ≤ their own scope.
   - Can't change your own roles; a user keeps ≥ 1 role; can't deactivate the last active Company Admin.
   - Linked IDs (role IDs on users, etc.) must belong to the same company → reusable
     `assertSameCompany()` helper (also used by Employees/Departments later).
   - Deactivating a role requires moving its users to another role first (UI offers it).
   - Every change audited with a **diff** (`role.update: +leave.approve(team), −salary.view`).

---

## 6. API surface

```
GET    /access/catalog                    modules, actions, scopes (for the matrix UI)
GET    /access/me                         my roles + effective grants (web uses this)

GET    /companies/:cid/roles              list (+ user counts)
POST   /companies/:cid/roles              create (blank or from template)
GET    /companies/:cid/roles/:id          detail + grants
PUT    /companies/:cid/roles/:id          name, description, grants (full replace, versioned)
POST   /companies/:cid/roles/:id/duplicate
PATCH  /companies/:cid/roles/:id/status   ACTIVE | INACTIVE (with reassignTo)
DELETE /companies/:cid/roles/:id          only when no users and not owner/template copy in use

GET    /companies/:cid/users              search, filter (role, status), paginate
POST   /companies/:cid/users              invite (name, email, roleIds[]) → temp password email
GET    /companies/:cid/users/:id
PATCH  /companies/:cid/users/:id          name, roleIds[]
PATCH  /companies/:cid/users/:id/status   activate / deactivate (revokes sessions)
POST   /companies/:cid/users/:id/resend-invite
POST   /companies/:cid/users/:id/reset-password
```

Every response carries **`X-Access-Version`**; the web refetches `/auth/me/access`
when it changes → menus/buttons update right after an admin edits a role.

---

## 7. Web (Company portal → User Management)

- **Access store** (`useAccess()`): grants from `/auth/me/access`; helpers
  `can('leave.approve')`, `scopeOf('employee.view')`; `<Can perm="…">` component.
  Sidebar items and action buttons hide when not permitted (the API still enforces).
- **Users** (`/app/users`): table with search, role + status filters, last login;
  invite dialog (multi-select role picker + combined access summary); row actions:
  change roles, deactivate, resend invite, reset password; user detail drawer with
  the role's access summary and recent activity (audit log).
- **Roles & Permissions** (`/app/roles`):
  - Role list: name, description, users count, status, last edited; menu: edit,
    duplicate, deactivate, delete.
  - **Role editor:** name/description + **permission matrix** — rows = modules
    (grouped: People · Time · Pay · Company · Admin), columns = actions; a cell is a
    checkbox, and for scopable actions a small **scope picker** (Own / Team /
    Department / Company). Row "all", search, dependency auto-ticks with a hint,
    sensitive badges, `coming_soon` modules greyed.
  - **Plain-language summary** panel: "Can approve leave for their team · Can view
    all employees · Cannot see salaries".
  - Compare with another role; unsaved-changes guard (reuse `useUnsavedGuard`).
  - Owner role shown read-only with a lock and explanation.

---

## 8. Build order

| Step | What | Size |
|---|---|---|
| 1 | Catalog in `@hrms/types` + start-up sync | M |
| 2 | Migration: role/permission columns, templates, clone per company, repoint users, one-role-per-user | M |
| 3 | `AccessService` + cache + slim JWT + guard + `scopeWhere` + `assertSameCompany` | M |
| 4 | Roles API (CRUD, duplicate, status, escalation rules, audit diffs) | M |
| 5 | Users API (invite with role, edit, status, resend, reset) | M |
| 6 | Web access store, `<Can>`, nav gating, `X-Access-Version` refresh | S |
| 7 | Web Roles & Permissions (list + matrix editor) | L |
| 8 | Web Users (list, invite, detail) | M |
| 9 | Verification: scripted isolation/escalation tests + browser flows | M |

Realistically **two sessions**: steps 1–5 (backend, fully testable by script), then 6–9 (UI).
Company onboarding (Super Admin) automatically gets the template clone in step 2.

## 9. Tests that must pass

- Company A can't list/read/edit company B's users or roles (404).
- HR-role user without `role.edit` gets 403 on role endpoints; with `role.edit` but
  without `salary.view` can't grant `salary.view`.
- Editing a role's grants changes a signed-in member's access on the next request.
- Manager with `leave.view(team)` sees only direct reports' leave.
- Can't deactivate the last Company Admin, can't change own role.
- Invite → email → sign in with temp password → forced password change → correct menus.
