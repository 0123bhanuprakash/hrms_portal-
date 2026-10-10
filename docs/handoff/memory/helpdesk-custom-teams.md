---
name: helpdesk-custom-teams
description: "Company-made helpdesk teams BUILT 2026-10-09 (uncommitted) — picked members, manage_teams for Admin+HR, built-in 4 fixed, archive only (no delete)"
metadata:
  node_type: memory
  type: project
  originSessionId: 3832ecf2-9639-40e5-b268-75ab97c06c99
  modified: 2026-10-09T05:44:00.356Z
---

User asked 2026-10-09 to add helpdesk teams beyond IT/HR/Finance/DevOps. Answers:
- New teams: members picked on the team (Helpdesk → Ticket topics → Teams → New team). The built-in 4 keep role permissions (ticket.handle_*) and can't be renamed/archived ("mandatory for every company").
- Who manages: permission `ticket.manage_teams` (relabelled "Manage helpdesk teams"), Company Admin + HR for now (HR template + one-off grant in migration 20261029100000_custom_helpdesk_teams).
- **Archive only — user explicitly said no Delete option.** Archived teams take no new tickets; open ones can still be finished; archiving with open tickets asks first (409 → "archive anyway").

Build notes: ticket/topic/team `queue` columns are now TEXT (enum TicketQueue dropped, data converted in place); custom keys `T` + 8 hex; `HelpdeskTeamsService.catalog()` (3 s cache, cleared on team writes) decides who works a team; tickets carry `queueLabel`/`queueEmoji`; web `useHelpdeskQueues()` replaces QUEUE_INFO/QUEUES; `/helpdesk/counts` returns `works` for the sidebar. e2e helpdesk-teams has the custom-team checks.

Same session also built (uncommitted): resolved tickets lock topic + team, Kudos → "Shout-outs" (visible text only), Enter sends ticket replies. Related: [[helpdesk-design]], [[future-plans]].
