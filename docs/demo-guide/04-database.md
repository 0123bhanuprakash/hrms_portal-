# Part 4: Database

PostgreSQL, schema `hrms`. Prisma schema: `apps/api/prisma/schema.prisma` (about 3,090 lines, 103 models). 56 migrations in `apps/api/prisma/migrations`, one folder per change, applied with `prisma migrate deploy`. Ids are UUIDs (`gen_random_uuid()`); columns are `snake_case` in the database and `camelCase` in code (`@map`).

## 4.1 Conventions
- Almost every business table has `companyId` (tenant key). Names such as `employeeId` ("CL001") are unique **within** a company.
- Soft states instead of deletes where history matters (archive only for helpdesk teams, revoked tokens, grant events).
- "Event" tables keep history (`EmployeeEvent`, `LeaveGrantEvent`, `ProjectEvent`, `ResourceRequestEvent`, `AssignmentLog`).
- Version counters (`featuresVersion`, `hierarchyVersion` on `Company`) tell caches when to refresh.
- Enums for fixed sets: `EmploymentType` (FULL_TIME, PART_TIME, CONTRACT, INTERN), `EmploymentStatus` (ACTIVE, PROBATION, NOTICE_PERIOD, ON_LEAVE, TERMINATED), `Gender`, user and company status.

## 4.2 Table groups
| Area | Tables | Notes |
|---|---|---|
| Platform | `Company`, `CompanySettings`, `CompanyBranding`, `Plan`, `PlanFeature`, `CompanyFeature`, `PlatformSetting`, `SystemHealthSample`, `SystemEvent`, `EmailLog`, `CompanyTag`, `CompanyNote` | Plans define features; `CompanyFeature` overrides per company; Super Admin data |
| Identity | `User`, `UserPreferences`, `RefreshToken`, `PasswordResetToken`, `EmailVerificationToken`, `SignInAttempt`, `UserActivityDay` | `User` is the login; `Employee` is the HR record (1:1 through `userId`) |
| Access | `Permission`, `Role`, `RolePermission`, `UserRole`, `ApprovalDelegation` | Roles are sets of permissions with reach |
| Organisation | `OfficeLocation`, `Department`, `Designation`, `OrgLevel`, `EmployeeHierarchy`, `DepartmentHierarchy` | Hierarchy tables are closure-style lookups for fast "everyone under X" |
| People | `Employee`, `EmployeePersonal`, `EmployeeDocument`, `EmployeeBankDetails`, `EmployeeStatutory`, `EmployeeEvent`, `EmployeeChecklistItem`, `EmployeeSalary`, `ImportJob` | Sensitive fields are split into their own tables; bank and PAN encrypted |
| Attendance | `AttendanceRecord`, `AttendancePunch`, `AttendancePolicy`, `WorkShift`, `AttendanceRegularisation`, `PublicHoliday`, `HolidayChoice` | Punches roll up to a daily record; regularisation = correction request |
| Leave | `LeaveType`, `LeaveBalance`, `LeaveBalanceAdjustment`, `LeaveTypeMember`, `LeaveGrant`, `LeaveGrantEvent`, `LeaveGrantRequest`, `ExtraLeaveRequest`, `LeaveRequest`, `LeaveApproval`, `LeaveComment` | Balance per person, type and year; adjustments form the statement |
| Projects and time | `Project`, `ProjectMember`, `ProjectMilestone`, `ProjectUpdate`, `ProjectOpenRole`, `ProjectEvent`, `Timesheet`, `TimesheetEntry`, `ResourceRequest`, `ResourceRequestEvent`, `AssignmentLog` | Allocation total per person must stay at or under 100% |
| Money | `ExpenseCategory`, `ExpenseClaim`, `ExpenseItem`, `ExpenseComment`, `ExpenseApproval`, `PayrollRun`, `Payslip` | Payroll tables exist but the module is postponed |
| Assets | `AssetType`, `Asset`, `AssetAssignment`, `AssetRequest`, `AssetRepair`, `AssetDocument`, `AssetCheck`, `AssetCheckAnswer`, `StarterKitRule` | Yearly check, temporary loans |
| Helpdesk | `TicketCategory`, `HelpdeskTeam`, `Ticket`, `TicketMessage` | Built-in 4 teams plus company-made teams |
| Engagement | `Announcement`, `AnnouncementRead`, `AnnouncementReaction`, `AnnouncementRsvp`, `Kudos`, `KudosValue`, `KudosRecipient`, `KudosReaction`, `KudosThanks`, `CelebrationWish`, `Notification` | Wishes are separate from kudos |
| Look and feel | `Theme`, `SeasonalTheme` | Company themes and dated seasonal themes |
| Reports and audit | `AuditLog`, `ReportSchedule` | Audit has before/after JSON |

## 4.3 Key relations (draw these on a whiteboard)
```
Company 1--* User 1--1 Employee --* (Department, Designation, OfficeLocation, manager Employee)
Employee 1--* LeaveBalance (per LeaveType, per year) 1--* LeaveBalanceAdjustment
Employee 1--* LeaveRequest 1--* LeaveApproval
LeaveType 1--* LeaveGrant (people) ; LeaveType 1--* LeaveTypeMember (named include/exclude)
Project 1--* ProjectMember (Employee, allocation %) ; Timesheet 1--* TimesheetEntry (Project)
User 1--* RefreshToken (family) ; User *--* Role via UserRole ; Role *--* Permission via RolePermission
```

## 4.4 Important design points
- **User vs Employee:** login identity and HR record are separate, but joined 1:1. Everyone is an employee (the admin is employee #1 automatically).
- **Reporting line:** a manager id on `Employee`, plus the hierarchy tables rebuilt when lines change (inside a transaction) so "my team" queries are fast.
- **Leave balances:** one row per person, type, year, with carried/lapsed/owed fields. Year-end closes lazily the first time a balance is touched in the new year; adjustments are never deleted, they form the statement with a running balance.
- **Sensitive data split:** bank and statutory data live in separate tables so ordinary profile reads never load them.
- **Imports:** `ImportJob` tracks CSV progress (live "37 of 120 imported").

## 4.5 Migrations and seed data
- Recipe: edit `schema.prisma`, create SQL with `prisma migrate diff`, apply with `migrate deploy` (see HANDOFF section 3).
- Seeds: `db:seed` (base data, permissions), `db:seed-demo` (12 accounts for `aakash-portal`), `db:seed-seedsai` (136 people, a year of data, all modules), `resources-demo` and `perf-bench` (493 people) for specific tests.

## 4.6 Trade-offs and limits
- Shared tables rely on code for isolation (no RLS yet, see Part 3).
- Many joins in reports; large lists must be paginated (pagination round done; API audit will check remaining unbounded lists).
- Closure/hierarchy tables must be kept in sync; a bug there gives wrong "team" results.
- Prisma cannot express every constraint, so some rules are only in services (for example allocation at or under 100%).

## 4.7 Likely questions
1. *Why UUIDs?* Safe to expose in URLs, no guessable counters, easy to merge data.
2. *Why separate User and Employee?* Platform admins have logins but no HR record; also keeps auth data apart from HR data.
3. *How do you keep leave balances correct?* Adjustments are append-only; balance changes happen in transactions; tests simulate year closes (`year-close.spec.ts`, `leave-extra.e2e.js`).
4. *How do you handle history?* Event tables and audit log with before/after.
5. *How would you scale the database?* Indexes on `companyId` plus filter columns, read replicas for reports, partition big tables (attendance, audit) by date.
6. *What is not enforced by the database?* Cross-row rules, such as allocation at or under 100%; they live in services and tests.
