---
name: everyone-is-employee
description: Rule (2026-10-06) — every person in a company is an employee; admin gets employee #1 automatically; profile completed by the person
metadata:
  type: project
---

User rule (2026-10-06): whoever is in a company is an employee. The Super Admin enters nothing extra when creating a company — the Company Admin automatically gets employee profile #1 (prefix + 001, joining = creation day) and keeps full access; they complete job title / department themselves. Invited users (Users → Invite) always get a basic profile too. Older accounts without a profile get a "Create my employee profile" button (POST /employees/me, once) on My profile / attendance / leave / expenses / helpdesk / assets / timesheets; Home shows "Complete your profile" when job title, department or office is missing. No automatic backfill (the user has separate admin + employee accounts in aakash-portal). e2e: everyone-employee 13/13.

**How to apply:** never create a company user without an employee profile; Super Admins stay outside companies.
