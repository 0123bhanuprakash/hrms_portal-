# Live updates (WebSocket)

Everything in the app that updates without a reload, who receives it, and how to add more.

**Stack:** Socket.IO on the API (`/socket.io`), one connection per open browser tab.
**Rule:** live messages only say *"something changed"* (plus ids). The screen then reloads through the normal API, so every permission check stays in one place. The only data sent over the socket itself is notification text, "who's viewing" names and import progress, and each goes only to people allowed to see it.

---

## 1. What is live today

### Notifications and system
| What | Who receives it | How |
|---|---|---|
| New notification (bell + pop-up) | The person notified | `notification` event to `u:<user>` |
| Notification read / withdrawn | That person's other tabs | `changed notifications` |
| Any notification also refreshes its module (leave, expenses, assets, timesheets, projects, kudos, celebrations, announcements, delegation, helpdesk) | The person notified | Web `FAMILY` map in `live-connection.tsx` |
| Maintenance mode on / off | Everyone connected | `changed system` broadcast |

### Helpdesk
| What | Who | How |
|---|---|---|
| Ticket created / updated / replied / closed | The queue's agents + the ticket owner | `changed helpdesk` to `q:<company>:<queue>` and `u:<owner>` |
| "Ravi is writing…" | Other tabs watching the ticket (never for internal notes) | `ticket:typing` → `typing` in `t:<ticket>` |

### Work areas (any successful change under the controller)
| Area | Sent to | Refreshes on screen |
|---|---|---|
| Attendance (check-in/out, corrections, records) | People who view attendance wider than "own" or approve it, line managers, project leads, covers | Who's in, present counts, team board, approval badges |
| Leave (apply, approve, reject, cancel) | Leave viewers / approvers (same rule) | Who's off, leave calendar, balances, approval badges |
| Expenses | Expense approvers (manager, Finance, HR) + covers | Review lists, badges |
| Timesheets | Timesheet approvers, project leads | Review lists, badges |
| Assets | IT / HR approvers, asset managers, line managers | Request lists, badges |
| Projects | Whole company | Project teams, "my projects" |
| Announcements: post, edit, pin, delete, react, RSVP | Whole company | Feed, Home ticker |
| Announcements: read, confirm | People who manage announcements only | Read / confirmation counts |
| Kudos: give, react, thank, delete | Whole company | Kudos feed, Home ticker |
| Celebration wish sent (birthday / work anniversary) — topic `celebrations` in `CelebrationsService` | The person celebrating + the sender's own tabs (counts are private) | Celebrant's "N wishes so far today", sender's "Wished ✓" |
| Celebration wish received — one grouped notification per occasion (`NotificationsService.notifyGrouped`, rewritten + unread again on each wish) | The person celebrating | Bell, festive pop-up, `/app/wishes` |
| Branding, theme, page defaults, seasonal themes | Whole company | Logo, colours, sign-in look, re-themes every open screen |
| People: employees, departments, designations, locations, org chart, profiles, CSV import | Whole company | Org chart, directory, profiles |

Each change also goes to the person who made it (their other tabs).

### Access and sessions
| What | Effect |
|---|---|
| Role or permission change, user turned on/off, delegation created/revoked, company or admin status (Super Admin) | The affected people's live rooms are recalculated, their menus refresh, and anyone no longer active is **signed out live** |
| Delegation starts or ends (its own clock) | Checked every minute: the cover's menus and approval badges switch over on time |
| Sign out one device / all other devices / change password | Those devices' open tabs close at once |
| Password reset, email changed, re-invite, Super Admin removed, stolen-token alarm | All that person's tabs close at once |

The sign-in page then says why (`hrms:signed-out` in sessionStorage → `LoginForm`).

### Collaboration
| What | Who |
|---|---|
| "Ravi is also viewing" on an employee profile, expense claim, or leave decision popup | Reviewers of that kind of record only (employee viewers / managers; expense or leave approvers). The server checks before showing anything. |
| Live "37 of 120 imported" bar on Employees → Import | Only the person importing |

---

## 2. Rooms

| Room | Members |
|---|---|
| `u:<userId>` | Every tab of one person |
| `c:<companyId>` | Everyone in a company |
| `a:<companyId>:<area>` | People who watch an area (`AREA_VIEW` permissions wider than "own"; for attendance, leave, expenses, timesheets and assets also line managers, active project leads/managers and covers) |
| `q:<companyId>:<queue>` | Helpdesk agents of a queue |
| `t:<ticketId>` | Tabs with that ticket open (checked on join) |
| `v:<kind>:<id>` | Tabs viewing an employee / expense / leave record (reviewers only) |
| `sa` | Super Admins |

Rooms are decided when a tab connects (`placeFor()` in `realtime.gateway.ts`) and recalculated on any access change (`reroom()`).

---

## 3. Volume control

* **Bursts are combined:** many changes to one area within 3 seconds send one message (`RealtimeService.soon`). 500 check-ins at 9 AM become a handful of refreshes, not 500.
* **Only screens on view reload:** the web refetches only queries that are mounted; others are just marked stale.
* **Polling only as a fallback:** approval badges poll every 2 min only while the connection is down; attendance / who's-away screens re-check every 5 min while live (1 min when not), for things with no event, such as the automatic end-of-day check-out.

---

## 4. What is deliberately NOT live

* **Reports and analytics:** heavy to compute; they refresh when opened.
* **Exports:** each export is built in one step and downloaded directly, so there's no progress in between. Live progress would need background export jobs (planned with Redis).
* **Scheduled / cron writes** (reminders, auto check-out, scheduled announcements) aren't HTTP requests, so the interceptor doesn't see them. Scheduled announcements still notify their audience, which refreshes the feed, and attendance screens have the 5-minute safety refresh.
* **Personal settings:** only that person sees them.
* **A single revoked device's API calls:** its tab closes live, but its access token is accepted by the API until it expires (≤ 15 min). Possible future: check the session id on every request.

---

## 5. How to add a live update

1. **A whole area:** put `@Live('<area>')` (watchers) or `@Live('<area>', 'company')` on the controller. Add the area to `LIVE_AREAS` and `AREA_VIEW`. Use `@NoLive()` on handlers that only preview.
2. **Access changes:** `@LiveAccess('user' | 'company' | 'caller')`.
3. **From a service** (no HTTP request): `realtime.changed(rooms, topic)` or `realtime.soon(rooms, topic)`; `realtime.signOut(userId, …)`; `realtime.progress(userId, …)`.
4. **Web:** map the topic to its query families in `TOPIC` (`components/live/live-connection.tsx`) and add it to `LiveChange['topic']` (`lib/live/socket.ts`).
5. **Test it** in `apps/api/test/e2e/realtime.e2e.js` (opens real sockets per role).

## 6. Files

* API: `apps/api/src/modules/realtime/` (`realtime.service.ts`, `realtime.gateway.ts`, `live.decorator.ts`, `live.interceptor.ts`, `live-io.adapter.ts`), `delegations/delegations-live.service.ts`
* Web: `apps/web/src/lib/live/socket.ts`, `components/live/live-connection.tsx`, `components/live/viewing-now.tsx`, `lib/live.ts`
* Tests: `apps/api/test/e2e/realtime.e2e.js` (74 checks)

## 7. Scaling note

With **two or more API servers**, add the Socket.IO Redis adapter in `LiveIoAdapter` so a change on one server reaches tabs connected to another. Until then, run one API instance (see the deferred Redis plan).
