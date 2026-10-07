---
name: helpdesk-design
description: "Helpdesk redesign (13 CAHelp* boards) + user's 2026-10-05 answers — DevOps team, team heads assign, WebSocket live, priority targets"
metadata:
  node_type: memory
  type: project
  originSessionId: 0bfd695c-c301-461b-8dce-50d853684037
  modified: 2026-10-05T22:56:44.625Z
---

Canvas row "Company · Helpdesk" (y≈51400, note n21), builder docs/design/builders/build-helpdesk.js → CAHelpOverview, Mine, Raise, Thread, Queue, Board, Desk, Teams, Live, Topics, TopicEdit, Motion, WhoSees. Published canvas version 3.

User's answers (2026-10-05):
- Quick answers while typing: YES.
- WebSocket: YES — wants it for live notifications app-wide, typing indicator, new tickets (reverses the old "no WebSockets" rule). Plan: Socket.IO in NestJS, rooms me/company/team queues, events only say "changed" then refetch via API; fall back to 1-min polling; Redis adapter only when 2+ API servers.
- Reply targets: priority based only (no per-topic targets).
- Teams: add a 4th team DevOps (new permission ticket.handle_devops). Each team has a HEAD who gets new tickets and assigns them to people under them (IT head → IT members, same for HR/Finance/DevOps); backup when head is away; team load panel for heads.
- Board view, animations: "whatever you think is best" — my call: build List improvements first, Board second; Lively all animations, Calm only rings/journey.
- Saved replies: user asked for an explanation (explained: ready-made answers; recommend personal + team-shared, head edits team ones) — confirm.

Later answers (2026-10-05): saved replies = an UPCOMING plan item (show as "coming soon", don't build now). Assignment: ONLY the team head assigns — members cannot "take" unassigned tickets (drop the per-team toggle).

Decided: DevOps head in demo = Dev Menon (Arjun under him). Build order: WebSocket (done, see [[live-updates]]) → Helpdesk changes → emoji animations.

BUILD STEP 1 DONE 2026-10-05 (uncommitted): DEVOPS queue (enum + ticket.handle_devops + "DevOps" role template), ticket.manage_teams (Company Admin), table helpdesk_teams (migration 20261023100000_helpdesk_teams, applied) + HelpdeskTeamsService (heads, leads/onDuty with leave-today, list, save). Rules when a head is set: only head/backup/Company Admin assign; members reply/resolve/change only tickets assigned to them, notes on any; new/unowned alerts → head (backup while head on leave); reminder for Urgent/High unassigned >30 min (ticket.unassigned). No head = old behaviour. Web: Ticket topics → "Teams & heads" tab (components/helpdesk/teams-panel.tsx), ticket page assign only for leads + "Assign to <suggested>" button, notes-only composer for members, DevOps everywhere. Demo seed: Dev Menon + Arjun Nair (devops), DevOps topics, heads IT=Karan HR=Hema FIN=Pooja DEVOPS=Dev — user must run db:seed-demo with their password. Tests: helpdesk-teams.e2e.js 36/36.
STEP 2 BUILT 2026-10-05 (uncommitted): migration 20261024100000_ticket_topics_plus (topic icon, description, defaultPriority, routeToId, questions JSON, quickAnswer, helpedCount; ticket answers JSON). ticket-categories.service: list with used30 for agents, save validation (route-to must be in queue, ≤5 questions, 1 device question), reorder, helped, answers search (quick answers + own solved ticket titles), readAnswers (device = an asset the employee holds → ticket.assetId), routeFor, per-queue starter topics with icons (+ one-time icon backfill). Web: Topics page redesign (drag/Alt+arrow reorder, use bars), components/helpdesk/topic-editor.tsx (settings + live preview), raise dialog shows quick answer/"That helped"/questions/device picker, ticket page Answers card. Test: helpdesk-topics.e2e.js.
STEP 3 BUILT 2026-10-06 (uncommitted): GET /helpdesk/directory (median first reply 30d, ≥3 tickets, + head). Web: My tickets redesign (AskHero with live quick answers + team cards, TicketCard with TargetRing + Journey, Solved sidebar), new page app/(app)/app/helpdesk/new (3 steps, these-may-help, who will help, paper-plane send; query params queue/topic/subject), chat-style ticket page (bubbles, event pills, "What we did" card, solved Burst once, rating faces). components/helpdesk/ticket-visuals.tsx; motion.css .hd-*. Old new-ticket-dialog.tsx removed. Checked in browser (dark). NOTE: another session runs e2e on :4001 too — check for running test/e2e/run.js before running suites.
STEP 4a BUILT 2026-10-06 (uncommitted): POST /helpdesk/tickets/bulk (assign/priority/move, ≤50, per-ticket rules, returns done+failed). Queue page rewrite: time bars, overdue glow, "To assign" tab for heads, quick assign picker + suggestion per row, bulk bar, preview panel (components/helpdesk/queue-preview.tsx, quick reply + ask-for-details + notes), team load (leads), keyboard J/K/Enter/X/A/R//, private saved views via useUiState('helpdesk:queue-views') (user said private). ticket-list.tsx removed.
STEP 4b BUILT 2026-10-06: components/helpdesk/queue-board.tsx — List/Board switch (useUiState 'helpdesk:queue-layout'), lanes New/Working/Waiting/Resolved or By owner; drag rules mirror API (New→Working assigns me, →Waiting/→Resolved open a dialog, →New unassigns, owner lanes assign; Waiting→Working blocked). Helpdesk plan steps 1–4 all built; tests: helpdesk 53, teams 42, topics 36, realtime 22. Saved replies stay "coming soon" on the boards (2026-10-06: I removed them by mistake after a misread; user meant the empty space in the My tickets hero — fixed: full-width search, Popular topic chips, team cards in one row).
Old plan: 2) topics upgrade (icon, starting priority, route-to, questions, quick answer) 3) employee screens (how can we help, 3-step raise page, chat thread) 4) queue upgrade (burn bars, bulk, team load) then Board view.

Related: [[plan-b-decisions]], [[emoji-animations]], [[design-canvas-link]], [[live-updates]].
