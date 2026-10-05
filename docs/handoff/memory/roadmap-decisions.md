---
name: roadmap-decisions
description: "User's 2 Oct 2026 decisions for Phase 2 finish and later phases (PII encryption, documents storage, WFH, projects/timesheets)"
metadata:
  node_type: memory
  type: project
  originSessionId: 8f157ff8-1021-4d62-8dd5-6a68f5d6e363
  modified: 2026-10-02T20:52:02.091Z
---

Decided 2026-10-02 after reviewing the TalentFlow employee dashboard:
- PAN, Aadhaar, bank account numbers encrypted at app level with a key; Aadhaar shown/stored as last 4 wherever possible. Users see/manage their own full details (incl. profile photo upload); others see only basic profile; sensitive data gated by role permission.
- Documents: local server disk for now; migrate to S3/Supabase Storage later.
- Work From Home = a leave type, not a separate request system.
- Projects, Tasks & Timesheets: on the roadmap, after Payroll.

Progress: Phase 2 finish committed 8fd2f60; Phase 3 attendance committed 91f432b; Phase 4 leave committed e26e7e3 on 2026-10-03 (multi-level approval up the reporting chain, WFH = leave type with countsAsPresent, leave feeds attendance status). Notifications (option A: inbox + emails + missing check-out reminder) built 2026-10-03; next planned: B (announcements, kudos, assets, expenses, helpdesk). Tests that trigger notifications must run on a temp API (:4001, EMAIL_PROVIDER=console, REMINDERS_ENABLED=false) — :4000 sends real Gmail. User chose to POSTPONE payroll (Phase 5) — don't start it unless asked; open payroll decisions: PT states, TDS depth, payroll lock.

**Why:** user's product calls. **How to apply:** order = finish Phase 2 (employee home, My Profile, HR employee detail, PII, Spotlight, documents) → Attendance → Leave (incl. WFH) → Payroll → Projects/Tasks/Timesheets. See [[aakash-demo-org]] for test accounts.
