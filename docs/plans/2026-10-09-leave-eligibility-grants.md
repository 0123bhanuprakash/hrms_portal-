# Leave eligibility rules + leave grants — plan (2026-10-09)

Status: **BUILT 2026-10-09 (uncommitted).** Migration `20261103100000_leave_eligibility_grants` is applied. Tests: unit tests in `eligibility.spec.ts`, e2e suite `leave-grants.e2e.js` (48 checks), and a browser check.

What differs from the plan below:
- Grants work only on "Only when granted" types. Extra days on an ordinary type still use balance adjustments.
- Leave types that existing companies had restricted by gender became "Only some people" with the same gender. New companies get Maternity as "Only when granted" with a document. Existing companies switch Maternity over in the leave type form.

## The problem today

- A leave type applies to everyone. The only filter is `LeaveType.gender`.
- `eligible()` in `apps/api/src/modules/leave/leave-balances.service.ts:21` is the only check. It runs in three places:
  - `summary()`, which shows balances. The apply dialog takes its list of types from here.
  - `yearEndPreview()`.
  - `evaluate()` in `leave-requests.service.ts:179`, which runs when someone applies.
- HR can only change days through `adjust()`, which adds or removes days on a type the person is already eligible for.
- Maternity and paternity leave depend only on the gender on the profile. Anyone without a gender gets neither. Adoption isn't covered. Nothing links the leave to a real event.

Because `eligible()` is the single check, changing that one function changes eligibility everywhere.

## What we're adding

### 1. "Who can use it" on each leave type

Each leave type gets one of three availability modes:

| Mode | Meaning |
|---|---|
| **Everyone** | Today's behaviour, and the default. |
| **Only some people** | A set of rules. Different rule types combine with AND; values inside one rule combine with OR. |
| **Only when granted** | Nobody has the type until HR grants it. Used for maternity, sabbatical, bereavement and similar leave. |

Rules available under "Only some people":
- Gender (more than one allowed). Replaces the single `gender` field.
- Departments
- Office locations
- Designations
- Employment types: full-time, part-time, contract, intern
- Minimum service, in months since joining. For example, earned leave only after 6 months.
- **Manager's team:** everyone who reports to the chosen managers. An option adds people further down the chain (all levels below). This uses `reportingManagerId`.
- **Project team:** current members of the chosen projects (`ProjectMember`). Joining or leaving the project changes who has the leave.
- **Also include** named people, who get the type even if the rules don't match.
- **Exclude** named people, who never get it even if the rules match.

Example: "Female, Pune or Bangalore, full-time, 3+ months' service, plus Ravi K., but not Anita S."

### 2. Leave grants

A grant gives one person a set number of days of a leave type for a set period. HR records why.

- Fields: person, leave type, days, valid from, valid to, reason, optional document, granted by, and status (active or revoked).
- A grant always makes the type available to that person during its window, even if the rules would block them. That's how an "Only when granted" type gets used.
- Leave applied under a grant must fall inside the window. Days left over at the end of the window lapse.
- **A grant isn't tied to a calendar year.** Maternity leave from November to April is one grant. Today's rule that a single request can't cross a year still applies, so the person makes two requests that use the same grant.
- HR can revoke a grant only while it has no approved or pending leave against it. Otherwise HR shortens it, either fewer days or an earlier end date, but never below what's already been taken.
- The person gets a notification and a live update when a grant is made or changed.

Grants vs. adjustments: an adjustment still means "+2 days on this year's earned leave". A grant means "you now have this leave for this period".

## Data model (one migration)

```prisma
enum LeaveAvailability { EVERYONE RULES GRANT_ONLY }

model LeaveType {
  // …existing fields…
  availability     LeaveAvailability @default(EVERYONE)
  genders          Gender[]          @default([])          // replaces `gender` (migrated, then dropped)
  departmentIds    String[]          @default([]) @db.Uuid @map("department_ids")
  locationIds      String[]          @default([]) @db.Uuid @map("location_ids")
  designationIds   String[]          @default([]) @db.Uuid @map("designation_ids")
  employmentTypes  EmploymentType[]  @default([])          @map("employment_types")
  minServiceMonths Int?                                    @map("min_service_months")
  managerIds       String[]          @default([]) @db.Uuid @map("manager_ids")      // "reports to"
  managerDeep      Boolean           @default(false) @map("manager_deep")      // include all levels below
  projectIds       String[]          @default([]) @db.Uuid @map("project_ids")
  members          LeaveTypeMember[]
  grants           LeaveGrant[]
}

/// Named people added to or removed from a type's rules
model LeaveTypeMember {
  leaveTypeId String @db.Uuid
  employeeId  String @db.Uuid
  mode        LeaveMemberMode  // INCLUDE | EXCLUDE
  @@id([leaveTypeId, employeeId])
}

model LeaveGrant {
  id, companyId, employeeId, leaveTypeId
  days         Float
  validFrom    DateTime @db.Date
  validTo      DateTime @db.Date
  reason       String
  documentKey  String?            // same local-disk storage as leave documents
  status       LeaveGrantStatus   // ACTIVE | REVOKED
  grantedById  String? (User), revokedById, revokedAt, createdAt
  requests     LeaveRequest[]
  @@index([companyId, employeeId])
}

model LeaveRequest { … leaveGrantId String? @db.Uuid }   // set when the leave uses a grant
```

Design notes:
- **Plain array columns** hold the department, location and designation IDs. They're small, they're read together with the type, and a deleted ID just stops matching. Proper join tables would only be needed for referential integrity, which we don't need here.
- **Named people use a join table** so that deleting an employee removes their rows automatically (cascade delete).
- **Migrating existing data:** run `genders = ARRAY[gender]` where `gender` is set, then drop `gender`. Every existing type becomes `EVERYONE`, or `RULES` if it had a gender. Nothing changes for current users.

## API changes (`apps/api/src/modules/leave`)

1. **`leave-rules.ts`:** add a pure function `isEligible(type, person, members, today)` and unit-test it in `leave-rules.spec.ts`. `eligible()` in the balances service now calls it. `Person` gets `departmentId`, `designationId` and `employmentType`; one `select` in `person()` changes.
2. **Grant-aware balances:**
   - For "Only when granted" types, available days = grant days − used − pending on that grant.
   - The `LeaveBalance` row still tracks used and pending by year, so the usage cards and reports keep working.
   - `summary()` lists these types only when the person has an active grant whose window overlaps the year. Each row includes `grant { id, days, validTo }`.
3. **`evaluate()`:**
   - Picks the matching active grant automatically: the dates must fall inside its window, and the oldest grant is used first.
   - Stores it in `leaveGrantId`.
   - If no grant matches, it rejects with a clear error, for example "Your maternity leave grant covers 1 Nov – 30 Apr."
4. **Leave type DTO and service:** add the new fields to `SaveLeaveTypeDto`, `data()`, `SELECT` and `validate()`. Validation rules:
   - An "Only when granted" type doesn't use a yearly quota, monthly build-up or carry-forward.
   - Department, location and designation IDs must belong to the company.
5. **New endpoints:**
   - `POST types/eligible-preview`, permission `leave.manage_types`: takes draft rules and returns `{ count, sample: [up to 20 people] }`. The form shows "Applies to 42 people" from this.
   - `GET grants?employeeId=&leaveTypeId=&status=`: scoped by `leave.view`.
   - `POST grants`, permission `leave.adjust_balance`, audited: takes an `employeeIds[]` list so HR can grant to several people at once, for example a team sabbatical.
   - `PATCH grants/:id`: shortens a grant (fewer days or an earlier `validTo`), never below what's used.
   - `POST grants/:id/revoke`: only when nothing has been used.
   - `POST grants/:id/document` and `GET grants/:id/document`.
6. **Permissions:** reuse `leave.adjust_balance` (company scope for HR, team scope where roles allow it). No new permission is needed, so the role screens don't change.
7. **Live updates:** emit `leave.grant.changed` to the employee and to anyone viewing the leave types page, following `docs/realtime.md`.
8. **Updated callers of `eligible`:** `yearEndPreview` (skip "Only when granted" types) and `usage`.

## Web changes (`apps/web`)

- **Leave type form** (`app/leave/types/page.tsx`): the current "Only for" gender select becomes a **"Who can use it"** section.
  - Three cards to pick the mode: Everyone / Some people / Only when granted.
  - Under "Some people": rule chips using the existing dropdown and multi-select controls, with people pickers for Include and Exclude.
  - A live line, "Applies to 42 people · see who", fed by the preview endpoint and debounced.
- **Leave type cards:** the badge summarises the rules, for example "Female · Pune, Bangalore · 3+ months" or "Granted only · 2 active".
- **Grant dialog:** opens from two places:
  - the employee profile **Leave** tab (`BalanceCards`, next to Adjust), with the person filled in;
  - each leave type card ("Grant to people…", multi-select).

  Fields: type, days, from–to, reason, optional document. The days default to the type's quota; for maternity that's 182 days counted as calendar days.
- **Grants list:** a new tab on the Leave types page, filterable by type and status, with Shorten and Revoke actions.
- **Employee side:** a granted type appears in the balances with "Granted · use by 30 Apr". The apply dialog needs no change because it already takes its types from the balances.

## Default leave types after the change

| Type | Availability |
|---|---|
| Maternity Leave | **Only when granted** (see Q1). Default grant: 182 days, ask for a document. |
| Paternity Leave | Only some people: Male. Or "Only when granted", the same choice as Q1. |
| Others | Everyone, as before. |

Existing companies: only the new mode is added. Their current gender filter carries over unchanged. HR switches maternity to "Only when granted" if they want it.

## Tests

- **Unit** (`leave-rules.spec.ts`): rules combine with AND / OR; include beats the rules and exclude beats include; minimum service at its exact boundary; grant windows; choosing the oldest grant first.
- **e2e:**
  - Create a rules-based type. A matching person sees it; a non-matching person gets the "isn't available" error.
  - Grant maternity leave. The person sees it, applies from Nov to Dec and Jan to Apr against one grant, and runs out of days at the right point.
  - Revoke is refused after the person has used part of the grant.
- **Browser check:** a throwaway company (e2e `makeCompany`), using both the HR and employee views.

## Order of work

1. Migration, `isEligible`, unit tests
2. Leave type DTO, service and preview endpoint
3. Grants service, endpoints, and the `evaluate`/`summary` changes
4. Web: "Who can use it" form, badges
5. Web: grant dialog, grants tab, employee balance row
6. Live updates, seed updates (demo, SeedsAI), e2e, browser check

## Decisions (2026-10-09)

1. **Maternity:** HR grants it, and a document is required. A grant for a type marked "needs a document" can't be saved without one (for example a doctor's certificate, an adoption order or a surrogacy agreement).
2. **Employees can ask for a grant.** An "Only when granted" type shows a **Request** button to people who match its rules. For maternity the rule is gender = female.
   - The request includes the expected dates and a document, and goes to HR.
   - When HR approves, a grant is created from the request. HR can change the days and dates before approving.
   - New model: `LeaveGrantRequest` with person, type, from, to, note, document, status PENDING / APPROVED / REJECTED / CANCELLED, and `decidedById`.
   - **Marital status is not a rule.** The Maternity Benefit Act doesn't require marriage. It also covers adopting and commissioning (surrogacy) mothers. Marital status is private data that's often left blank. HR checks the document instead.
3. **Who grants:** HR only. That means people with `leave.adjust_balance` at **company** scope. Team-scoped holders can't grant.
4. **Unused days:** they lapse at the end of the window, and HR can **extend** it.
   - Extending needs a reason and is recorded with the grant's history.
   - The employee gets a reminder **14 days before** the window ends if days are left.
   - Maternity grants default to a window of start date + 12 months, so ordinary date changes don't need an extension.
