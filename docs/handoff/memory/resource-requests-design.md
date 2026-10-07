---
name: resource-requests-design
description: "Resource request & release workflow (Lead→PM→Delivery Director→PMO), hold, PMO reporting layer — decisions 2026-10-07, screens being designed"
metadata:
  node_type: memory
  type: project
  originSessionId: 449c1e50-e726-4782-bb05-81b97925b6c6
  modified: 2026-10-06T22:22:25.900Z
---

User asked 2026-10-07 for an employee (resource) request + release/reassignment workflow. Not built yet — screens first (hrms-designer agent, boards CARes* on the design canvas [[design-canvas-link]]), build after approval.

Decisions (user's answers):
- **Delivery Director (DD) is per project**, set by the PMO next to the PM. Typically the PM's reporting manager (suggest it, editable), but stored at project level; one DD covers many projects/PMs ("one PM and his leads have one DD").
- **Request**: Lead gives role/skills + allocation/dates/reason + optional preferred employee. PM may fill with the preferred person OR a better-matching available person. If the preferred person isn't under that PM/DD (= on projects they manage), it must reach the PMO, who assigns if available.
- **Chain** Lead → PM → DD → PMO; PM and DD may fill directly from people under them (both directions).
- **Reject** = closes with a required reason, back to the Lead (who can raise again).
- **Hold** at every approval step: reason required, Lead notified, stays On hold until Unhold → then approve / reject / move forward; all of it in the audit history.
- **Release**: Lead tells PM; PM/DD send to PMO pool or reassign directly within their projects (or keep). Lead can **request back** a released person.
- **PMO = central reporting layer**: on creating ANY employee (all departments/designations), choose "Reports to: a person OR the PMO"; PMO people form the pool/bench.
- Per-employee **assignment history** (requested/approved/assigned/reassigned/released, who/when) + per-request step timeline; inbox with badge; live updates; 100% allocation rule stays.

**Why:** user's org staffs projects through a PMO with this hierarchy.
**How to apply:** build only after the user approves the CARes* boards; one additive migration (DD on project, requests, steps, assignment log, PMO-reporting flag on employee). Related: [[project-approval-routing]], [[live-updates]].

Screens done 2026-10-07: canvas row 29, 21 boards CARes* (builder docs/design/builders/build-resources.js). Menu decision (user, 2026-10-07): exception to "sidebar unchanged" — add two items to the existing **Work** section, NO new sections: Projects · **Resource requests** (badge; Leads/PMs/DDs/PMO) · **PMO pool** (PMO only) · My timesheet · Timesheet approvals. Resource planner stays reached from Projects. Designer's 13 open questions (open roles merge, skills store, several PMs, lower %, moving people, hold reminders, preferred-person visibility, withdraw, release notice timing, PMO deciding releases, history visibility, PMO-lead approvals, PM %) still await the user's answers + "start working".

ANSWERS to the 13 questions (user, 2026-10-07) — BUILD STARTED ("start working"; build screens like the CARes* boards):
1. Merge Open roles into requests (one list, one form).
2. Skills: new Skills section on the profile, the employee adds their own; projects get a **tech stack** list added by the project's Leads. Best match = skills vs request skills/tech stack + free %.
3. **One PM per project** (enforce).
4. Approver may fill at a lower % than asked, with a note to the Lead.
5. Taking time off another PM's project: **that PM must agree** (consent step) — only when the person's time there has to be cut.
6. Optional "remind me on" date on hold + nudge after 7 days on hold.
7. Employee is NOT told they were requested (only once assigned).
8. Lead can withdraw any time before it's filled.
9. Employee told about a release only after the PM/DD decides.
10. Releases decided by PM or DD only; **PMO can nudge** them (not decide).
11. Assignment history visible to: the person, their manager/team, PMs/DDs of their projects, PMO, HR.
12. People reporting to the PMO: leave/timesheet/attendance approvals go to holders of a new permission "Lead the PMO pool" — the user creates the "PMO lead" role manually in Roles & permissions.
13. Picking a PM also creates their assignment (default 30%, editable); Delivery Director has no %.
Menu: Work section only grows to 5 items (Projects · Resource requests · PMO pool · My timesheet · Timesheet approvals); no new sections.
