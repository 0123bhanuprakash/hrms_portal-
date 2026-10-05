---
name: timesheet-decisions
description: "Tempo-style timesheet refinement decisions (2026-10-05) — lead approves, submit any unsent days, time ranges only, no overlaps"
metadata:
  node_type: memory
  type: project
  originSessionId: 8f157ff8-1021-4d62-8dd5-6a68f5d6e363
  modified: 2026-10-05T09:45:14.533Z
---

Timesheet refinement (designed 2026-10-05, boards on the canvas artifact, "Company · Timesheets" row):
- Logging is always time ranges (10:00–12:00 + project + description); no durations-only mode. A plain "2h" in the form places the block right after the previous one.
- An employee can't have overlapping blocks (even across different projects).
- Approver per block = the person's team lead set on that project (ProjectMember lead); no lead → project PM; General (non-project) time → line manager; HR can approve on behalf. A day can be "partly approved".
- No daily/weekly setting: Submit sends every logged, unsent day up to today (e.g. Mon alone, later Tue–Fri together); "Just today" option too; leave/holidays skipped; empty days warned.

**Why:** user said the lead knows best who worked on what; keep submitting flexible.
**How to apply:** build on existing Timesheet/TimesheetEntry + ApprovalRouter; see [[project-approval-routing]].
