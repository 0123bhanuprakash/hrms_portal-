# Part 5: Employees and Lifecycle

## 5.1 What it is and why an HRMS needs it
The master record of every person: profile, job details, reporting manager, documents, private data and their journey in the company. Every other module (leave, attendance, expenses, projects) hangs off an employee, so this is the foundation.

## 5.2 Business rules
- **Everyone is an employee.** The company admin becomes employee #1 automatically; invited users get a profile; there is a self-create button for the signed-in user (`POST employees/me`).
- **Employee id** is human readable (for example "CL001"), unique within the company; `GET employees/next-id` suggests the next one.
- **Lifecycle stages:** joining soon, probation, active, notice, left. Statuses: ACTIVE, PROBATION, NOTICE_PERIOD, ON_LEAVE, TERMINATED. Types: FULL_TIME, PART_TIME, CONTRACT, INTERN.
- **Who sees what:**
  - Probation dates: anyone whose `employee.view` reaches the person (HR, plus managers and leads for their own team).
  - Notice period, last day, exit reason and people who have left: only holders of `employee.terminate` (HR, Company Admin) and the person themselves. Everyone else sees a person on notice as Active; people who have left simply disappear from lists.
- **Probation:** confirm (`:id/confirm`) or extend (`:id/extend-probation`).
- **Interns:** convert to a different type (`:id/convert`) or extend (`:id/extend-internship`). A reminder job (every 6 hours) works like this: 14 days before the end, HR and the manager get a heads-up; on the end date, if the company is set to "convert" the intern becomes Full-time automatically, otherwise HR is reminded again; 7 days after with no decision, Company Admins are told. Nobody's type changes without a decision unless the company chose automatic conversion.
- **Exit:** give notice, withdraw notice, mark as left (`employee.terminate`), with an exit reason (resigned, let_go, contract_end, retired, other). Leavers who owe leave days are flagged "Leaving".
- **Checklists** per employee (onboarding/offboarding items).
- **Experience before joining** is recorded and verified by HR (the experience-verification feature).
- **Reports to:** a person or the PMO (see Projects).
- **Private data:** PAN and bank numbers are encrypted; a full view uses an audited "reveal" call.

## 5.3 How it works
| Layer | Where |
|---|---|
| Screens | `apps/web/src/app/(app)/app/employees/page.tsx`, components `add-employee-wizard.tsx`, `employee-board.tsx`, `employee-drawer.tsx`, `employee-hero.tsx`, `lifecycle-ui.tsx` |
| API | `modules/employees/employees.controller.ts` (create, import, board, export, bulk, lifecycle actions, checklist), `modules/employee-profile` (profile, private data, documents, directory) |
| Services | `employees.service.ts` (CRUD, filters), `lifecycle.service.ts` (stages, masking by role), `employee-import.service.ts`, `internship-reminders.service.ts` |
| Tables | `Employee`, `EmployeePersonal`, `EmployeeBankDetails`, `EmployeeStatutory`, `EmployeeDocument`, `EmployeeEvent`, `EmployeeChecklistItem`, `ImportJob`, hierarchy tables |

Example code idea to show: every route carries a decorator such as `@RequirePermission('employee.edit')` above `@Post(':id/confirm')`; the service then calls `lifecycle.mask(e, access)` so fields are removed for people who should not see them.

**Example flow, add an employee:** the wizard validates the form (Zod) and `POST /employees` runs the DTO validation, checks `employee.create`, creates the `User` and `Employee`, records an `EmployeeEvent`, rebuilds hierarchy rows if a manager is set, sends an invitation (email), and broadcasts a live "people changed" message so org chart and directory refresh.

**Bulk import:** `POST employees/import/preview` validates row by row and writes nothing; `POST employees/import` then imports only the valid rows, managers before their reports (so reporting lines resolve). Progress shows live ("37 of 120 imported") to the importer only.

## 5.4 Why this approach
- Preview-then-import avoids half-broken imports and lets HR fix a spreadsheet first.
- Masking in one service (`lifecycle.mask`) means the rules are not repeated in each screen.
- Splitting private data into separate tables and encrypting it limits damage from a leak and keeps normal profile queries light.
- A board view and a table view serve both browsing and filtering large companies (pagination round done).

## 5.5 Security and edge cases
- Every action is permission-checked and reach-limited: a manager can edit only their team.
- Duplicate employee ids or emails are rejected per company.
- A person cannot report to themselves or to someone below them (see Part 6).
- Date edge cases: joining date in the future (shows as "joining soon", not counted in headcount), probation end on weekends, time zones (the code uses the company time zone for "today").
- Terminating someone closes their sessions live and removes them from lists; their history stays in events and audit.
- CSV import: wrong columns, duplicates inside the file, manager appearing later in the file, very large files.

## 5.6 Limits and trade-offs
- Import is one pass of valid rows; no partial retry UI for failed rows beyond the preview report.
- Payroll data (`EmployeeSalary`, `Payslip`) exists but payroll is postponed.
- Profile search is by words; very large companies rely on pagination and the person-picker.

## 5.7 30-second demo pitch
"Open Employees: board and table views, search and filters. Open a profile: job, documents, private data masked. Show the Add Employee wizard. Show lifecycle: probation confirm, intern conversion, notice and exit, each with reasons and reminders. Point out that only HR sees notice and exit details."

## 5.8 Likely questions
1. *What happens when someone resigns?* Notice stage (visible to HR and the person only), last day, leave-owed flag, checklist, then Left; sessions are closed and history stays.
2. *How do you stop managers seeing other teams?* Permission reach (own, team, company) checked per request.
3. *Can two people have the same employee id?* Not within a company.
4. *How do you import 5,000 rows?* Preview validates; import runs managers first; progress goes over the socket. (Verify the practical size limit before quoting a number.)
5. *How is PAN protected?* AES-256-GCM, audited reveal.
6. *What do interns get at the end of the internship?* Reminders, then manual or automatic conversion based on the company setting.
7. *Is deletion possible?* The model uses terminate/left status, not hard delete, to preserve history.
8. *How does the new employee log in?* Invitation email and temporary password, forced change at first sign-in.
9. *What if the manager leaves?* Reports must be reassigned; the org health page flags people without a working manager.
