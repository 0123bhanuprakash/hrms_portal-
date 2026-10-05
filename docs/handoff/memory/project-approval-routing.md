---
name: project-approval-routing
description: "User's 2026-10-03 rules for project-based leave / attendance-correction approval, PMO role and allocation %"
metadata:
  node_type: memory
  type: project
  originSessionId: 8f157ff8-1021-4d62-8dd5-6a68f5d6e363
  modified: 2026-10-02T21:16:19.358Z
---

Decided 2026-10-03 (before building Projects early, ahead of payroll):
- Leave AND attendance corrections route by project: member → their team lead or PM; team lead → PM; PM → PM's reporting manager. Not on a project → reporting line (old behaviour).
- On several projects: ANY one of the involved leads/PMs can approve (all notified).
- 1-level: lead or PM, whoever acts first. 2-level: lead first, then PM.
- The line (reporting) manager can ALSO still approve at each step.
- New "PMO" template role: only PMO (plus Company Admin, which has everything) creates projects and assigns people. HR/PMs view only.
- Allocation % per assignment; total across overlapping dates must never exceed 100% (hard block).
- Approval authority comes from the project role (no extra RBAC needed); HR override, delegation and no-self-approval still apply.

**Why:** user's org runs on projects. **How to apply:** keep chains snapshotted per request; company setting chooses routing mode. Related: [[roadmap-decisions]], [[aakash-demo-org]].
