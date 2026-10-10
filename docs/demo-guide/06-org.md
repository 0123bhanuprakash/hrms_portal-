# Part 6: Organisation: Departments, Designations, Locations, Org Chart

## 6.1 What it is and why it is needed
The structure of the company: who sits where and who reports to whom. It is needed because **approvals, team access and reports all follow this structure**. A manager approves their team's leave; "my team" and department-wide permissions come from reporting lines.

## 6.2 Business rules
- **Departments** form a tree (parent department) with an optional head. A head must belong to the same company; a parent must exist (errors: "Parent department not found", "Department head not found in this company"). Departments in use cannot be removed carelessly (conflict errors in `departments.service.ts`).
- **Designations** (job titles) and **office locations** are simple company lists used on profiles and in leave rules (departments, offices, designations are all eligibility rule fields).
- **Org levels** (`OrgLevel`) are named layers such as CEO, Director, Manager. They can be created, reordered, deleted, or generated from a suggested set.
- **Reporting line:** each employee has one manager (or reports to the PMO). Setting it is a two-step action: **preview**, then **save**.
  - You cannot report to yourself.
  - A loop is rejected: if the new manager already reports (directly or indirectly) to the employee, the preview says so and names the person.
  - The preview lists people whose access changes through team scopes (direct reports or all reports), so the admin sees the effect before saving.
- **Health check** (`GET org/health`): wide spans, missing managers, departments without a head, hierarchy depth.
- **Org chart** (`GET org/chart`): who is visible depends on the viewer's permission (`org.view`); future joiners are shown with a join date, people who left are hidden. The chart is kept as one whole page (about 37 KB gzipped) on purpose.

## 6.3 How it works
| Layer | Where |
|---|---|
| API | `modules/departments/departments.controller.ts` (create, list, get, update, delete), `modules/designations`, `modules/locations`, `modules/org/org.controller.ts` (levels, people, chart, health, reporting-line preview and save) |
| Services | `org.service.ts`, `departments.service.ts`, `access/hierarchy.service.ts` |
| Tables | `Department`, `DepartmentHierarchy`, `Designation`, `OfficeLocation`, `OrgLevel`, `Employee.reportingManagerId`, `EmployeeHierarchy` (ancestor, descendant, depth) |
| Frontend | org chart page, departments/designations/locations admin pages, "Reports to" selector (`components/employees/reports-to.tsx`) |

**Why a hierarchy (closure) table:** `EmployeeHierarchy` stores every ancestor-descendant pair with a depth. "Everyone under Priya" is one indexed lookup instead of a recursive query, which keeps approvals and permission checks fast. Loop detection is also one lookup (`ancestorId_descendantId`). When a line changes, `setReportingLine` rewrites the rows inside a transaction and bumps `hierarchyVersion` so cached access refreshes.

## 6.4 Why this approach and not alternatives
| Choice | Alternative | Reason |
|---|---|---|
| Closure table | Recursive SQL query each time | Faster reads for frequent permission checks; cost is more writes when lines change |
| Preview before save | Save directly | Moving a manager changes who can see and approve what; the admin should see the impact |
| One manager per person | Matrix (several managers) | Simpler approvals; project roles cover the second reporting relationship |

## 6.5 Security and edge cases
- Changes need permission and are audited; they broadcast live so org chart and directory refresh everywhere.
- Moving a team re-routes pending approvals according to the new manager; confirm this behaviour in the leave module before explaining it in detail.
- Cycles are blocked; self-reference blocked; cross-company ids are rejected (lookups filter on `companyId`).
- Deleting a department with people or children is refused.
- A manager who leaves leaves orphans, so the health check flags it.

## 6.6 Limits and trade-offs
- Single reporting line; no dotted-line.
- Closure rows grow with depth (people x levels), fine for hundreds or thousands.
- Org chart renders everything at once; for tens of thousands of people it would need lazy loading.

## 6.7 30-second demo pitch
"This is the org chart. Reporting lines drive approvals. When I change someone's manager, I first get a preview that shows who gains or loses access, and loops are rejected. The health page tells HR where the structure is weak."

## 6.8 Likely questions
1. *Why does structure matter to leave?* Approvers come from reporting lines and project roles.
2. *How do you prevent circular reporting?* Check the hierarchy table for the new manager already being a descendant.
3. *What is `hierarchyVersion`?* A counter bumped on every structural change so access caches refresh on the next request.
4. *Can a department have sub-departments?* Yes, with a parent and a `DepartmentHierarchy` table.
5. *What if a department head leaves?* The health page shows departments without a head.
6. *Why a closure table and not nested sets or recursive CTE?* Simple to query and to maintain with small writes; nested sets are costly to update, CTEs are slower per request.
7. *How do you handle a reorganisation of 50 people?* Change lines one by one with preview, or in bulk edit; each is transactional (verify whether a bulk reporting-line tool exists before promising one).
