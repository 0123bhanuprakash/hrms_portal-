---
name: aakash-demo-org
description: "aakash-portal has a seeded demo organisation (12 accounts, <first>.aakash@yopmail.com) for end-to-end testing; how to re-seed"
metadata:
  node_type: memory
  type: project
  originSessionId: 8f157ff8-1021-4d62-8dd5-6a68f5d6e363
  modified: 2026-10-02T14:59:22.693Z
---

On 2026-10-02 the user asked for dummy profiles in aakash-portal. Seeded with `apps/api/prisma/seed-demo.cjs` (`DEMO_PASSWORD=… pnpm --filter @hrms/api db:seed-demo -- aakash-portal`; idempotent, no emails). The shared password is the one the user chose — ask them rather than storing it.

Accounts (email = `<first>.aakash@yopmail.com`): vikram (Head of Operations, Manager role, top), ravi (Eng Manager), priya + karan (Team Leads under ravi), amit + neha (under priya), sara (under karan), hema (HR Manager, HR role), divya (HR Exec under hema), meena (Sales Manager, Mumbai), rahul (Sales Exec under meena), pooja (Finance Officer, custom "Payroll Officer" role). Departments OPS > ENG/HR/SALES/FIN; levels Executive…Member; locations Bengaluru HQ (default), Mumbai Office.

User's own accounts there: bhanu@yopmail.com (Company Admin, no employee profile), bhanu001@yopmail.com (AAK001), bhanusingh@yopmail.com (invited, no profile — left for the user to test "Add employee profile"). See [[company-test-account]].
