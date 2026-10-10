---
name: leave-adjustments-ledger
description: Leave adjustment kinds (extra/advance/correction/deduction), take-back next year, minus-balance recovery, leave ledger — PLANNED 2026-10-09
metadata:
  type: project
---
User asked 2026-10-09 for a proper leave adjustment/history mechanism where HR decides if extra leave is deducted from next year. Plan: docs/plans/2026-10-09-leave-adjustments-ledger.md.

**Why:** today every + adjustment is a gift, negative balances are forgiven at year end (carry = max(0, left)), and year-end carry/lapse is never recorded.
Decisions 2026-10-09: employees can ask HR for more days when out of balance; HR lends (go below 0, used part taken from next year) or gives extra (kept); limit reached = blocked, ask again; minus balances taken from next year; deciders via roles/permissions (leave.extra_decide, HR default); leavers owing days = exit list now, payroll later; no bulk, per person only.
**How to apply:** confirm 3 small points in the plan (single Lend option, cap at next year's quota, auto-apply default) then build. Related: [[leave-eligibility-grants]].

BUILT 2026-10-09, uncommitted. Hard cap = next year's quota; no auto-apply. The Extra leave tab is on /app/leave/approvals?tab=extra. Year close runs lazily in ensure() once the new year has begun; past years were marked closed by the migration. Tests: e2e leave-extra (38 checks). Also on 2026-10-09: the leave types page groups Active then Inactive (user request).
