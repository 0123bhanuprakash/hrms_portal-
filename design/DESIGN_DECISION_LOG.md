# Design decision log

Approved decisions only go into the "Approved" table. Proposals wait in "Proposed" until the user says yes.

## Earlier decisions carried over (from `docs/handoff/memory/`)
| Date | Decision | Source |
|---|---|---|
| 2026-10-04 | No 3D globe; no gold orb in the hero | ui-roadmap-phases |
| 2026-10-04 | No "View as admin" / impersonation | ui-roadmap-phases, HANDOFF |
| 2026-10-04 | Theme toggle: only Light and Dark (no System) | ui-roadmap-phases |
| 2026-10-04 | Charts have a per-chart "View as" switch (user preference, admin default) | ui-roadmap-phases |
| 2026-10-04 | Toast with timer at top-right | ui-roadmap-phases |
| 2026-10-04 | Joiners & leavers default = story tiles + mirror bars | ui-roadmap-phases |
| 2026-10-04 | Birthdays always visible (day + month only) | ui-roadmap-phases |
| 2026-10-05 | Sidebar and top bar must not change (items) | HANDOFF §2 |
| 2026-10-06 | User now allows sidebar, top bar and layout changes, after design approval | User, via coordinator |
| 2026-10-06 | No Auto light/dark; no theme version history | settings-design |
| — | 2FA deferred; Payroll postponed | HANDOFF |

## Rejected
| Date | Proposal | Reason | Note |
|---|---|---|---|
| 2026-10-06 | Direction A "Roster" (Day Rule time scale, Roster Matrix, Ledger figures, pine green, Schibsted/Hanken fonts) — DNA v0.1, concept v0.2 | User did not like it: "I just don't like the idea." | Whole concept rejected. Do not reuse its core ideas in a softer form. |

## Proposed (awaiting approval)
| # | Decision | Reason | Applies to | Replaces | Version |
|---|---|---|---|---|---|
| P1 | Adopt direction "Clear desk" (Design DNA v0.2): design starts from each role's top jobs | User brief: user-centric, clarity, usability, accessibility | Whole app | Current card style; rejected Roster | 0.2 · 2026-10-06 |
| P2 | Home order: Your day → Needs you → Quick actions → role blocks → people | Matches how often each role needs things | Home | Sky hero + 15 cards | 0.2 |
| P3 | One "Needs you" list (approvals + to-dos), each row with reason + one button | One place per number, clear next action | Home | Approvals card + Needs your action card + hero count | 0.2 |
| P4 | One Quick actions block (6 tiles + All shortcuts) | Four shortcut lists repeated links | Home | Quick actions, Admin shortcuts, Make it yours, hero actions | 0.2 |
| P5 | WCAG 2.2 AA as a hard rule (tokens with checked contrast, 3 px focus, 44 px phone targets, icon + word status) | Accessibility brief | Whole app | — | 0.2 |
| P6 | Public Sans as default UI font | Legibility | Whole app | Inter | 0.2 |
| P7 | Phone: same task order, check-in in a sticky bottom bar | Mobile-first | Home | Stacked desktop | 0.2 |
| P8 | Sidebar / top bar visual restyle (same items) | User allowed layout changes after approval | Layout | Current look | 0.2 |

## Approved
| Date | Decision | Reason | Applies to | Replaces | Version |
|---|---|---|---|---|---|
| — | (none yet) | | | | |
