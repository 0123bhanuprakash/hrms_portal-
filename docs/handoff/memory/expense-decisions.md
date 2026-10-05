---
name: expense-decisions
description: "Expenses refinement decisions (2026-10-05) — HR approves every claim, over-limit allowed with reason, payments only \"upcoming\""
metadata:
  node_type: memory
  type: project
  originSessionId: 8f157ff8-1021-4d62-8dd5-6a68f5d6e363
  modified: 2026-10-05T11:04:31.277Z
---

Expenses refinement (boards on the canvas artifact, "Company · Expenses" rows, designed 2026-10-05):
- HR step stays mandatory on every claim (manager step → Finance + HR → paid). No per-category HR rule.
- Over a category limit: allowed with a reason, flagged to approvers (today the API blocks it).
- Payments: the company doesn't pay through the app yet — payment batches / bank file / pay runs are shown as an upcoming ("coming soon") feature; keep the existing "mark paid".
- No mileage, per diem or team budgets (user said no need).

**Why:** user's answers when reviewing the expense boards.
**How to apply:** build expenses from these.
