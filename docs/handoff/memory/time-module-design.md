---
name: time-module-design
description: Time section (attendance + leave, 9 pages) redesign — 13 canvas boards designed 2026-10-05, waiting for the user's answers before building
metadata:
  type: project
---

2026-10-05: user asked to "plan and design screens" for the Time section (My attendance, Team attendance, Attendance approvals, My leave, Leave approvals, Who's off, Holidays, Attendance settings, Leave types) with animation / new UI ideas. Designed 13 boards (builder docs/design/builders/build-time.js → CATime*/CALeave*.dc.html, canvas row note n21, published to the canvas). Sidebar TIME group unchanged.

Open questions asked (answers needed before building): 1) limit corrections per month (how many)? 2) can managers nudge or only HR? 3) too many off → block approval or warn? 4) multiple shifts + alternate Saturdays now? 5) optional holidays: pick how many? 6) which new leave rules (probation, document, sandwich, negative balance, carried-days expiry)? 7) can employees see their own team on Who's off?

**How to apply:** when the user answers, record the decisions here, then build (API + web + e2e) in the order UI-only → small API → bigger items. Related: [[ambient-backgrounds]], [[project-approval-routing]].

DECISIONS (user, 2026-10-05):
1. Corrections: NO monthly limit. Instead, insight to higher-ups (lead / manager / HR) when a person goes over 8 corrections in a month.
2. Nudge (remind to check in / fix): manager, team lead and HR can nudge.
3. Too many people off: WARN only, never block approval.
4. Shifts: yes — add a Night shift (multiple shifts). Alternate Saturdays not answered → don't build.
5. Optional holidays: each person may pick 5 for now; the number must be a company setting.
6. New leave rules (probation, document, sandwich, negative balance, carried-days expiry): build them all as per-type settings that HR / anyone with leave.manage_types can turn on and tune.
7. Employees can see their own team on Who's off.

BUILT 2026-10-06 (uncommitted): migration 20261022100000_time_plus (WorkShift + Employee.shiftId, HolidayChoice, PublicHoliday.locationIds, policy correctionAlertAt/lateAlertAt/autoCloseAfterMinutes/optionalHolidayLimit, AttendanceRecord.autoClosed, LeaveType blockDuringProbation/documentAfterDays/sandwichRule/negativeBalance/carryExpiry, LeaveRequest document*). API: shifts CRUD + members (lateness/auto-close/night carry follow the person's shift), /attendance/team-month, /insights, /nudge, corrections monthCount/overLimit/recent + alert over N, auto-close in reminders job, holidays per location + optional picks (limit) + /holidays/import (India 2026–28), leave rules enforced, /leave/requests/:id/document + /question, clashes (team) in approval lists, Who's off includes own team for everyone, /leave/types/usage + /:id/year-end (+remind). Web: all 9 Time pages + apply dialog rebuilt (components/time/visuals.tsx + today-hero.tsx, .tm-* in motion.css); Who's off menu item no longer hidden for own-scope users. Tests: e2e time-plus 73/73, leave.e2e updated for decision 7, leave-rules.spec. Not built: alternate Saturdays, Week/Year views + PDF on My attendance, "office network only" (coming soon).
