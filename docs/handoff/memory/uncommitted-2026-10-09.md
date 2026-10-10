---
name: uncommitted-2026-10-09
description: "Everything built 2026-10-09 — helpdesk, leave, resources/skills, experience verification, branding — COMMITTED in 89b0d42, merged to main 97aa16e"
metadata:
  node_type: memory
  type: project
  originSessionId: 3832ecf2-9639-40e5-b268-75ab97c06c99
  modified: 2026-10-09T11:27:32.425Z
---

Built 2026-10-09 (on top of the pagination round); **committed in 89b0d42 and merged to main (97aa16e) on 2026-10-10.** Dev DB already has migrations 20261029 (custom helpdesk teams), 20261030 (leave questions), 20261031 (leave cancel requests), 20261101 (prior experience), 20261102 (experience verification).

- Helpdesk: resolved tickets lock topic/team; Enter sends replies; company-made teams (see [[helpdesk-custom-teams]]).
- Kudos renamed "Shout-outs" (visible text only; routes/keys stay kudos).
- Leave: approvals search/filters (facets in meta); questions + replies on requests (LeaveComment); compact full-width history; cancel requests for started approved leave (approver/HR decides, "came back early" gives days back); "Plan a break" card shows holidays only; holidays banner has a coming-up strip, no "take X off" tips.
- Branding: square icon removable; company favicon now set on the tab (useBrandFavicon).
- Resources: preferred-person picker (free people only, most free first, filters dept/role/availability/experience/skills); Select `overlay` prop for filter rows in popups.
- Skills: "Add skills" searchable picker (company skills + SKILL_CATALOG); × removes.
- Experience before joining: Employee.priorExperienceMonths (approved) + pending fields; employee entries wait for HR (employee.edit, never self), HR/import values verified at once; HR sees "Verify previous experience" in Needs your action; import column "Experience before joining (years)".
- Leave documents have NO retention/expiry (user asked; offered a rule, not built).

**Why:** record of what that round contains (HANDOFF.md links here). Related: [[future-plans]].
