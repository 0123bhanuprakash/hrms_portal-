---
name: live-updates
description: "WebSocket live updates BUILT 2026-10-05 (uncommitted) — Socket.IO gateway, rooms, what is live, what is next"
metadata:
  node_type: memory
  type: project
  originSessionId: 0bfd695c-c301-461b-8dce-50d853684037
  modified: 2026-10-06T20:28:37.542Z
---

User asked for WebSockets (reversing the old "no WebSockets" rule) and to build them first, before Helpdesk changes and emoji animations.

BUILT 2026-10-05, not committed:
- API `modules/realtime/`: RealtimeService (`notification`, `changed(rooms, topic)`, `broadcast`), RealtimeGateway (Socket.IO on /socket.io; token in handshake `auth.token`; rooms u:/c:/q:<company>:<queue>/t:<ticket>/sa; disconnect with "expired" at token exp; `ticket:watch|unwatch|typing`), LiveIoAdapter (CORS = CORS_ORIGINS) in main.ts. Global module.
- NotificationsService.notify pushes every new notification live; mark read → `changed notifications`. TicketsService.live() after every write (internal notes only to queue rooms); reminders auto-close too. MaintenanceService.set broadcasts `system`.
- Web: lib/live/socket.ts (singleton, status store, token refresh via api ping on expired), components/live/live-connection.tsx (LiveConnection: invalidate query families by notification type prefix, bottom-right pop-up; LiveDot next to the bell) in (app) + (super-admin) layouts; bell polling only when not live; lib/live/ticket.ts → "X is writing…" on the ticket page (never for internal notes).
- Tests: test/e2e/realtime.e2e.js 22/22. pnpm-workspace allowBuilds '@nestjs/core': true (was a placeholder from pnpm add).

HIGH-VALUE GROUP BUILT 2026-10-07 (uncommitted; realtime e2e 39/39):
- Area rooms `a:<company>:<area>` for attendance, leave, expenses, timesheets, assets — joined by people whose grant on AREA_VIEW perms is wider than "own", OR approvers without a permission (direct reports, active project TEAM_LEAD/MANAGER, delegations). In realtime.gateway.ts `placeFor()`.
- `@Live('<area>')` on those 5 controllers + global LiveInterceptor: any successful POST/PUT/PATCH/DELETE → `realtime.soon()` (coalesced per topic, 3 s) to the area room + actor's own room. Cron/reminder writes are NOT covered (no HTTP) → client keeps a 5-min refresh while live.
- `@LiveAccess('user'|'company'|'caller')` on company/users, company/roles, delegations, admin company status + admin status → `accessChanged()` (500 ms batch) → gateway `reroom()`: recompute rooms (fresh DB read), drop ticket rooms no longer allowed, emit `changed access`; inactive → `signed-out {reason:'inactive'}` + disconnect.
- `realtime.signOut(userId, {sid|exceptSid}, reason)`: auth revokeSession/revokeOtherSessions (incl. change password), reset password, token reuse, email change, Super Admin removed, re-invite (company users + admin). Socket stores `sid`.
- Web: socket.ts `signedOut` handler; LiveConnection TOPIC map (+access/areas) and sign-out → sessionStorage `hrms:signed-out` (SIGNED_OUT_KEY in lib/auth/workspace.ts) → LoginForm shows the reason once. Pending-count hooks poll only when not live; LIVE preset 5 min when live / 1 min when not.
- Server already re-reads status+roles per request (3 s cache) — only a revoked single device's access token stays valid ≤15 min (sockets now close live; API calls would still pass until expiry — possible future: check sid on requests).

Next live candidates (medium group): announcements/kudos posts, expense/asset/timesheet status for the owner, projects, delegation start/end; polish: branding/theme live, org chart, "who's viewing", import/export progress; Super Admin pushes. 2+ API servers → add Redis adapter in LiveIoAdapter. Related: [[helpdesk-design]], [[emoji-animations]].

2026-10-07 later: MEDIUM + POLISH groups BUILT too (realtime e2e 74/74). Full list, rooms, volume rules and "how to add one" now live in the repo: **docs/realtime.md** — keep it updated with every new live event. Added: announcements (company; reads/acks → managers only), kudos (company), projects (company), delegation start/end ticker (DelegationsLiveService, 1 min), branding + people areas (company), "also viewing" presence (`v:<kind>:<id>`, kinds employee/expense/leave, reviewers only, `ViewingNow` component), import progress (`realtime.progress`, progressId in import DTO), wishesToday on spotlight. @mentions in announcements (mentionIds column, migration 20261026100000) + notification withdraw on post/kudos delete (`NotificationsService.withdraw`).
Gotcha: system.e2e turns maintenance mode ON in the shared DB; if a run is killed mid-suite the dev app stays in "Back soon (e2e)" — reset platformSetting 'maintenance'.enabled=false.
