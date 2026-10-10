---
name: leave-eligibility-grants
description: Leave "who can use it" rules + per-person leave grants — BUILT 2026-10-09 (uncommitted), plan in docs/plans/2026-10-09-leave-eligibility-grants.md, decisions agreed
metadata:
  type: project
---
User asked (2026-10-09) for leave types restricted to specific people and a way to grant leave to one person; noticed maternity was gender-only.
Plan written: docs/plans/2026-10-09-leave-eligibility-grants.md (availability EVERYONE/RULES/GRANT_ONLY, LeaveGrant model not tied to calendar year, reuse leave.adjust_balance).

**Why:** gender-only eligibility misses adoption, missing gender, and any real life-event check.
**How to apply:** decisions: HR grants maternity with required document; employees can request a grant (no marital-status rule — legal reasons); only company-scope HR grants; unused days lapse, HR can extend, 14-day reminder. Rules also cover manager team + project team.

BUILT 2026-10-09, uncommitted. Migration 20261103100000 is applied. Tests: e2e leave-grants (48 checks) and eligibility.spec. Existing companies keep Maternity as a women-only rule until HR switches it to 'Only when granted'. The year-end '+N more' list now expands.
