---
name: ui-roadmap-phases
description: "User's UI phases — now: mixed dashboard (balanced + Bento hero + motion); phase 2 module UI + 2–3 whole-UI themes; phase 3 font styles"
metadata:
  node_type: memory
  type: project
  originSessionId: 8f157ff8-1021-4d62-8dd5-6a68f5d6e363
  modified: 2026-10-03T21:53:05.157Z
---

Decided 2026-10-04:
- **Now (phase 1):** dashboards = "mix" — balanced layout (hero + 8/4 main/side columns, no gaps) with Bento-style dark hero elements and meaningful animations. Add moving cards: one **Celebrations** card (today's birthdays — multiple per day — and work anniversaries with years of service, showing profile photos) and a moving **Kudos** card. User liked all motion ideas EXCEPT the Super Admin globe (do not use it). Reviewed on the design canvas https://claude.ai/artifact/95bXqxb9Go7gRcVnvPXpPv.
- **Phase 2:** after modules are fixed, enhance the UI of every module/section, then create 2–3 separate themes where the WHOLE UI style differs (not just colours).
- **Phase 3:** font styles (user-selectable fonts).
- Sidebar and top bar stay unchanged; Classic menu stays default.

**Why:** user wants functionality and layout balance first, bigger style variation later.
**How to apply:** design tokens/components now should leave room for whole-style themes (shape, depth, density, motion) and a font setting; don't hard-code styles that would block phase 2/3. Related: [[next-session-plan]].

Update 2026-10-04 (later): FINAL screens canvas https://claude.ai/artifact/9SGEgQWW4kE8VNjjztW8yE (builder: scratchpad hrms-design/build-final.js). User dislikes the 3D globe AND the gold orb in the hero → replaced by meaningful hero art (employee day arc, admin team presence, super admin pulse line). Kept animations: milestone progress, approve swipe-away, success tick, toast with timer at TOP-RIGHT, kudos heart burst, bell ring, date range sweep, greeting reveal, pointer spotlight, hover lift + round-1 ones (count-up, fills, check-in pulse, confetti, medal/badge, stagger, shimmer). Theme toggle: ONLY Light and Dark (remove "System"). Charts: per-chart "View as" switch (user preference, admin default). All motion colours from theme tokens; status colours stay semantic.

Update 2026-10-04 (round 3, canvas 9SGEgQWW4kE8VNjjztW8yE row 3): user approved ALL screens. Joiners & leavers: all 4 designs liked (default = D story tiles + A mirror bars; B bridge and C faces as View-as options). Atmosphere: build all EXCEPT on-time streak plant and month tide (keep: birthday balloons, anniversary fireworks, Diwali, Holi, Christmas/New Year, monsoon, office lights, Friday wind-down; priority personal > holiday > season > weekly > sky). Component ideas (Ctrl K, person hover card, one approvals inbox, team leave planner, day timeline, onboarding checklist, pulse, number+change, notifications by day, smart tables, status chip, customise home): all liked — they are the pool for the 2 more UNIQUE whole-UI themes (phase 2); each theme uses a subset, not everything. Check-in sessions + early check-out design approved. Who's off calendar: hover preview + click to pin, Calendar/List switch. Company icon default = monogram with shine.
Decisions: shift stays 09:30; hours = sum of sessions; night shift = per project member flag (ProjectMember.nightShift); demo avatars for testing; birthdays always visible (day+month only, no opt-out).

Super Admin → Companies redesign (canvas row 4: SACompanies, SACompaniesCards, SACompanyPanel): summary row, needs-attention strip, richer table (plan, seats vs limit, 7-day sign-ins, health score, setup %, last activity, tags), filters/saved views, bulk actions, card view, onboarding pipeline, company side panel. DECISION 2026-10-04: do NOT build "View as admin" (impersonation) — leave it out of the build and screens.
