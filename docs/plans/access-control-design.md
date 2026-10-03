# Access Control Platform — Feature toggles · RBAC · Org hierarchy

Status: **proposed**, 2 Oct 2026. Supersedes and extends [rbac-design.md](rbac-design.md)
(its catalog, guardrails and API ideas still apply; this adds the platform layer and
hierarchy-based access).

> **Goal:** the Super Admin decides *what each company can use*; each Company Admin
> decides *who in their company can do what, over whom*. Every company can have a
> completely different structure, and it all stays configurable without code changes.

---

## 1. Three layers, one question

Every check answers: **"Can user U do action A on record R?"**
It is allowed only if **all three layers say yes**:

```
┌───────────────────────────────────────────────────────────────────────────┐
│ 1. ENTITLEMENT  (Super Admin)        Is the feature switched on for U's    │
│                                      company?  (plan + per-company toggles) │
├───────────────────────────────────────────────────────────────────────────┤
│ 2. PERMISSION   (Company Admin)      Does any of U's roles grant A?         │
│                                      (custom roles, union of grants)        │
├───────────────────────────────────────────────────────────────────────────┤
│ 3. SCOPE        (Company Admin +     Is R within the grant's reach?         │
│                  org hierarchy)      own · direct reports · all reports ·   │
│                                      department · location · company        │
└───────────────────────────────────────────────────────────────────────────┘
```

Key idea: **roles say WHAT, the hierarchy says WHOM.**
One "People Manager" role with *"view attendance — all reports"* gives a Team Lead
their members, and a Manager their Team Leads *and* everyone under them —
automatically, from the reporting tree. Nobody maintains per-level roles.

---

## 2. Layer 1 — Feature catalog & entitlements (Super Admin)

### 2.1 Catalog (code, versioned — single source of truth)

```
Module            Feature                       Permissions (actions)
──────            ───────                       ─────────────────────
People            Employee directory            employee.view / create / edit / delete / export
                  Employee documents            document.view / upload / delete
                  Org chart & hierarchy         org.view / manage
Time              Attendance                    attendance.view / mark / edit / approve / export
                  Shifts & rosters              shift.view / manage
                  Leave                         leave.view / request / approve / manage_types / adjust_balance
Pay               Payroll                       payroll.view / run / approve / export
                  Salary & compensation         salary.view / edit            (sensitive)
Insights          Reports                       report.view / export
Admin             Users & roles                 user.* / role.*
                  Settings & branding           settings.* / branding.manage
                  Audit log                     audit.view                    (sensitive)
(Recruitment, Performance, Assets, Expenses, Helpdesk … added as modules ship)
```

- Three levels — **Module → Feature → Permission** — so the Super Admin can switch on
  "Time" but leave "Shifts & rosters" off.
- Each feature declares: `dependsOn` (Leave → Attendance), `stage` (beta / GA),
  optional `limits` it understands (e.g. `maxEmployees`, `storageGb`).

### 2.2 Plans + per-company overrides

```
plans               Starter · Growth · Enterprise · (any custom plan)
plan_features       which features a plan includes (+ default limits)
company_plans       company → plan
company_features    per-company overrides: force ON / force OFF / custom limits,
                    with reason, who, when, optional expiry (trials!)
```

**Effective features(company) = plan features ± overrides**, with dependencies resolved.
Cached per company and versioned; a toggle takes effect on the company's next request.

### 2.3 What "switched off" means

| Where | Effect |
|---|---|
| API | Every route of the feature returns **403 `FEATURE_NOT_ENABLED`** (checked before permissions) |
| Web | Menu items, pages and buttons disappear (or show an "upgrade" hint — configurable) |
| Role editor | The feature's permissions are hidden; existing grants are **kept but dormant** |
| Data | Never deleted. Switching back on restores everything, grants included |

### 2.4 Super Admin screens

- **Plans** — create/edit plans as a feature checklist with limits.
- **Company → Plan & features** — plan picker, per-feature toggles with "override" badges,
  limits, trial end dates, history of changes.
- **Feature catalog** — every module/feature, stage, how many companies use it.
- All changes audited; optional "notify Company Admins" email.

---

## 3. Layer 2 — Roles & permissions (Company Admin)

As in `rbac-design.md`, now **bounded by entitlements**:

- Company-owned roles, created from templates (Company Admin · HR · Manager · Team Lead
  · Employee) or from scratch; **create / edit / duplicate / deactivate / delete / assign**.
- **Users can hold multiple roles**; effective access = union, broadest scope wins.
- **Company Admin** = locked owner role: all permissions of *enabled* features.
- **Grant = permission + scope** (scope options below). Sensitive permissions flagged.
- Guardrails: no privilege escalation, can't edit own roles, ≥ 1 active Company Admin,
  every change audited with a diff.
- Role editor only shows permissions of features the company has.

---

## 4. Layer 3 — Organisational hierarchy & scopes

### 4.1 Each company models its own structure

| Concept | What it is | Notes |
|---|---|---|
| **Reporting line** | each employee → one reporting manager | already in DB (`reporting_manager_id`) |
| **Org levels** *(new)* | company-defined ranks: e.g. Member < Team Lead < Manager < Director < CXO | name, rank, colour; one company can have 3 levels, another 8 |
| **Departments** | tree (sub-departments) + department head | already in DB |
| **Locations** | offices | already in DB |
| Designation | job title (e.g. "Senior Engineer") | already in DB, linked to a level |

Access comes from **reporting lines**, not titles — so any shape works
(flat startups, deep enterprises, matrix-like departments).
Levels are for structure, validation (warn if someone reports to a lower level),
the org chart, and later for approval chains ("escalate to next level").

### 4.2 Hierarchy store — closure table

```
employee_hierarchy (company_id, ancestor_id, descendant_id, depth)
```
- One row per (manager, anyone below them, how many levels down).
- "All reports of X" = one indexed lookup, no recursion at request time.
- Maintained in the same transaction whenever a reporting manager changes
  (move = delete old subtree links, insert new ones). **Cycle check** built in
  (can't make someone report to their own subordinate).
- Same pattern for the department tree (`department_hierarchy`).

### 4.3 Scopes a grant can have

| Scope | Records included | Example |
|---|---|---|
| `own` | the user's own | Employee views own payslips |
| `direct_reports` | depth = 1 below the user | Team Lead approves members' leave |
| `all_reports` | entire subtree below the user | Manager sees Team Leads + their members |
| `department` | user's department | HR partner of Engineering |
| `department_tree` | user's department + sub-departments | Head of Technology |
| `location` | user's office | Branch HR |
| `company` | everyone | HR head, Company Admin |
| `custom` *(later)* | chosen departments/locations | HR handling 2 regions |

Scopes can **combine** with `own` (managers usually see their own records too —
the engine adds `own` automatically to any reports scope).

### 4.4 Worked example (one company)

```
CEO (Director level)
 └── Ravi — Manager            role: People Manager   (attendance.view: all_reports)
      ├── Priya — Team Lead     role: People Manager   (same role!)
      │    ├── Amit — Member    role: Employee
      │    └── Neha — Member    role: Employee
      └── Karan — Team Lead     role: People Manager
           └── Sara — Member    role: Employee
```
- Priya sees Amit, Neha (+ herself). Karan sees Sara. **Ravi sees Priya, Karan, Amit, Neha, Sara.**
- If the company wants Team Leads to only see members *but approve nothing*, it creates
  a "Team Lead" role with `leave.approve: none` — different companies, different rules.
- Move Neha under Karan → closure rows update → Priya loses access, Karan gains it, instantly.

---

## 5. The access engine (API)

```
request ─► Throttle ─► JWT (+user, roles, company in 1 query) ─► FeatureGuard ─► PermissionGuard ─► service
                                                                  (entitled?)    (granted? which scope?)
service ─► scopeWhere(access, 'attendance.view')  →  Prisma filter, always AND company_id
```

- **`@RequireFeature('attendance')`** on controllers, **`@RequirePermission('attendance.view')`** on routes.
- **`AccessContext`** per request: `{ companyId, userId, employeeId, featureSet, grants: Map<perm, Scope[]>, isOwner }`.
- **Caching (in-memory now, Redis later), all version-keyed:**
  `features@companyVersion`, `grants@roleVersion`, `subtree@hierarchyVersion`.
  Any change bumps a version → picked up on the next request. JWT no longer carries permissions.
- **`scopeWhere()`** turns a scope into a filter, e.g. `all_reports` →
  `employee.ancestors.some({ ancestorId: me.employeeId })`.
- **Record checks** (`canAccess(access, perm, record)`) for single-record routes → 404 if outside scope.
- **`X-Access-Version`** response header → the web refreshes its menus when access changes.
- **Explain mode:** every decision can return *why* (which layer, which role, which scope) —
  powers the Access Explorer and makes support easy.

---

## 6. Company Admin experience ("advanced user manager")

| Area | What it does |
|---|---|
| **Users** | list with search / filters (role, department, level, status), invite (single + bulk CSV), edit, multi-role assignment, deactivate (revokes sessions), resend invite, reset password, last login, sessions |
| **Roles & Permissions** | role list (users count, status); editor with permission matrix grouped by module, scope picker per cell, dependency auto-ticks, sensitive badges, plain-language summary, compare roles, duplicate |
| **Org structure** | org levels editor; department tree; **interactive org chart** (drag a person onto a new manager → preview who gains/loses access → confirm) |
| **Access Explorer** | *"What can Priya do?"* (effective permissions + where each came from) and *"Who can see Amit's salary?"* — the audit/compliance view |
| **Plan view** | read-only list of the company's enabled features and limits (+ "request upgrade") |
| Audit | every user/role/hierarchy change with before/after |

Later (same foundation): delegation ("Ravi's approvals go to Priya until 15 Oct"),
time-boxed access, approval chains by level, field-level masking, SSO/SCIM provisioning.

---

## 7. Data model summary (new / changed)

```
# Platform
plans(id, key, name, description, is_active)
plan_features(plan_id, feature_key, limits jsonb)
company_plans(company_id, plan_id, started_at)
company_features(company_id, feature_key, mode ON|OFF, limits jsonb, reason, expires_at, set_by)
companies + features_version int

# Catalog (synced from code)
permissions + feature_key, label, scopes text[], sensitive, deprecated

# Company RBAC
roles + key, is_owner, is_template, status, version, created_by/updated_by  (company_id required for company roles)
role_permissions + scope text
user_roles (user_id, role_id, company_id, assigned_by, assigned_at)       -- many per user

# Org
org_levels(id, company_id, name, rank, color)
designations + org_level_id
employee_hierarchy(company_id, ancestor_id, descendant_id, depth)          -- closure table
department_hierarchy(company_id, ancestor_id, descendant_id, depth)
companies + hierarchy_version int
```

---

## 8. Phased delivery

| Phase | Scope | Result |
|---|---|---|
| **A. Engine** (backend) ✅ done 2 Oct | catalog sync, plans/entitlements tables, roles+grants migration (clone templates per company), closure tables + maintenance, AccessContext, FeatureGuard, PermissionGuard v2, `scopeWhere`, caches | Everything enforced server-side; scripted tests |
| **B. Super Admin** ✅ done 2 Oct | Plans page, Company → Plan & features, feature catalog | Super Admin controls each company's modules |
| **C. Company Admin core** ✅ done 2 Oct | Users (invite/multi-role/manage), Roles & Permissions editor | Companies run their own RBAC |
| **D. Org structure** ✅ done 2 Oct | org levels, department tree, org chart with drag-to-reassign + access preview | Hierarchy-based access usable end to end |
| **E. Advanced** ✅ done 2 Oct | Access Explorer, bulk import, delegation, approval chains | "Super advanced" user manager |

A is the foundation and must come first; B and C can then run in either order.

---

## 9. Tests that must always pass

- Feature OFF → its routes 403 `FEATURE_NOT_ENABLED` even for Company Admin; grants preserved; ON → restored.
- Company A never sees company B's users, roles, levels, hierarchy (404).
- Team Lead (`all_reports`) sees members only; Manager sees Team Leads + members; after a reassignment access follows within one request.
- Hierarchy cycle rejected. Last Company Admin protected. No privilege escalation.
- A permission added in code appears in the catalog, is OFF for companies until entitled, and auto-granted to owner roles.
