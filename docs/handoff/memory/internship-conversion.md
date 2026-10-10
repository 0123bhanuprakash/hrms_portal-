---
name: internship-conversion
description: Internship end date + convert/extend/end + remind-vs-auto-convert rule — BUILT 2026-10-10, COMMITTED f33b2b2
metadata:
  node_type: memory
  type: project
  originSessionId: 4a4c71c8-955a-4a85-a4e6-213d6dd40280
  modified: 2026-10-09T23:39:09.971Z
---

BUILT 2026-10-10, committed f33b2b2 on feat/super-admin-portal (2026-10-11). Migration 20261105100000_internship_end (employees.internship_end_date, skip_auto_convert; company_settings.internship_end_action).

Decisions (user approved "best" option): default = remind HR (14 days before → HR + manager; overdue reminder; 7 days after → Company Admins). Opt-in company rule "convert automatically to Full-time" (Active, no probation), per-intern "Don't convert automatically". HR (company-wide employee.edit) sets the rule from the Employees page, not only Company Admin. Convert = type + optional probation + optional title; the role named "Intern" is swapped for Employee (also when type changed via the edit form). End internship = notice flow with reason contract_end. Interns need an end date except via import.

Code: lifecycle.service.ts (convertIntern, extendInternship, applyConversion, swapInternRole), internship-reminders.service.ts, e2e test/e2e/internships.e2e.js (36 checks).

**Gotcha:** never run `prisma generate --no-engine` — it switches the client to prisma:// (Data Proxy) and breaks the dev API. If generate hits EPERM on the engine DLL, the running dev API holds it.
