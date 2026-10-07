---
name: seedsai-test-company
description: "SeedsAI end-to-end test company seed (136 people, Oct 2025 → today, all modules) — how to run, logins, status"
metadata:
  node_type: memory
  type: project
  originSessionId: 472614f8-3801-4e40-9b63-c284c337956c
  modified: 2026-10-07T05:37:34.266Z
---

User asked 2026-10-07 for a full test company "SeedsAI" with a year of realistic data in every module, org per their hierarchy (CEO → HR Mgr, 3 Delivery Directors, IT/DevOps/Finance/UI-UX/CyberSec heads, PMO; DD → project → PM → Lead → employees; HR has no leads; PMO pool via reportsToPmo).

- Seed code: `apps/api/prisma/seedsai/` (roster.ts = org, org/work/time/ops/engage.ts = steps). Run `pnpm --filter @hrms/api db:seed-seedsai` (add `-- --reset` to rebuild). Photos from randomuser.me in `prisma/seed-assets/seedsai-photos/` (user approved the download).
- Logins: `<first>.<last>.seedsai@yopmail.com`, all share `SEEDSAI_PASSWORD` in apps/api/.env (never repeat it in chat). Company Admin = rohan.kapoor; CEO aditya.varma, COO meera.krishnan (also company admin).
- History window starts 2025-10-01; future leave up to Dec 2026, Esha's maternity leave to Jan 2027.
- Validated against a throwaway `seedtest` schema (same DB) on 2026-10-07: no over-allocation, no orphans, no negative balances, timesheets ⊂ attendance.
- LOADED into the real DB 2026-10-07 11:00 IST (after the resource-request session went idle). API checks per role passed; browser walk-through not done (pane was signed in to the Resources Demo admin). [[resource-requests-design]]

**Why:** end-to-end testing of dashboards, filters, reports, approvals, edge cases and performance.
**How to apply:** if the schema changed after this seed was written, re-run the seedtest dry run first; drop schema `seedtest` when done.
