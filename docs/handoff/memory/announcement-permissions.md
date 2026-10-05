---
name: announcement-permissions
description: "Who may post / pin announcements — HR pins one, IT Admin posts to all, managers & team leads post to their own team"
metadata:
  node_type: memory
  type: project
  originSessionId: 8f157ff8-1021-4d62-8dd5-6a68f5d6e363
  modified: 2026-10-04T22:44:15.062Z
---

Decided 2026-10-05 (user):
- **HR / Company Admin** (`announcement.manage`): pin — only ONE pinned announcement company-wide at a time; edit/remove anyone's posts; see every read report.
- **IT Admin** ("IT heads") (`announcement.post`): post to everyone / departments / locations; manage own posts only; cannot pin.
- **Managers & Team Leads** (`announcement.post_team`): post only to their own reporting line (everyone below them).
- Employees: read, confirm, react, RSVP.

**Why:** user wanted IT heads to announce company-wide (outages etc.) and line managers to reach their teams, while HR keeps control of the top slot.
**How to apply:** keep these splits if touching announcements; related screens in [[ui-roadmap-phases]].
