# Part 0: Demo Script (10 minutes)

## Before you start (5-minute checklist)
- Run `pnpm dev`. The API must be on :4000 and the web app on :3000.
- Do not send any real email from :4000. It sends real Gmail. Avoid actions that trigger emails (invites, password resets) during the demo unless you want them.
- Open two browser windows: one signed in as **HR (Hema)** and one as **Employee (Amit)**, both in company `aakash-portal` (`/login?company=aakash-portal`). Ask yourself for the shared demo password; it is not stored in the repo.
- Optional: the `seedsai` company (136 people, a full year of data) is best for reports and charts.
- If a page shows a strange error after hours of dev work, stop `pnpm dev`, delete `apps/web/.next` and restart (known Turbopack issue).
- Have a fallback: screenshots of each step, in case Wi-Fi or the server fails.

## The story (say this first, 30 seconds)
"This is a multi-tenant HRMS. Each company gets its own portal, roles and rules. A Super Admin manages companies and plans. Inside a company, people manage employees, leave, attendance, timesheets, projects, expenses, assets and a helpdesk. Everything updates live without a reload. Every action is checked on the server against the person's role."

## Walkthrough
| Min | Screen | What to do | What to say |
|---|---|---|---|
| 0:00 | Sign-in (Hema, HR) | Sign in, show Home | "Home shows what needs my action, announcements, celebrations. Menus change by role." |
| 1:00 | Employees | Open list, search, open one profile, show Add Employee wizard (do not submit) | "Onboarding wizard, CSV import, profile with private data. PAN and bank numbers are encrypted at rest." |
| 2:30 | Org chart / Departments | Show org chart | "Reporting lines drive approvals: who approves leave, expenses, timesheets." |
| 3:30 | Leave (Amit window) | Apply for leave, show balance | "Leave types have rules: who can use them, carry-over, grants." |
| 4:30 | Leave approvals (Hema window) | Approve; point at Amit's window updating live | "Live update: only a 'something changed' message goes over the WebSocket; the screen reloads via the normal API, so permissions are checked once, in one place." |
| 5:30 | Leave types, Ask HR for more days, Statement | Show eligibility rules and the leave statement | "Lend/give extra days, year-end take-back, a running-balance statement." |
| 6:30 | Attendance and Time | Show who's in, a correction request | "Corrections go to the right approver." |
| 7:15 | Projects, Timesheets, Resource requests | Show a project and a request flow | "Lead to PM to Delivery Director to PMO chain." |
| 8:00 | Expenses / Assets / Helpdesk | Create a helpdesk ticket as Amit, reply as Hema | "Typing indicator and ticket updates are live." |
| 9:00 | Settings / Roles | Show roles and permissions, theme change | "Roles are made of permissions with a reach: own, team, company." |
| 9:30 | Super Admin (optional) | Plans, companies, system health | "Platform-level control and per-company feature toggles." |

## If something goes wrong
- Page fails to load: click "Try again" (built-in retry), or refresh once.
- Live update does not appear: refresh; say "the WebSocket reconnects automatically, and every screen also loads via normal API calls, so no data is lost".
- Blank page after long dev session: the Turbopack stale build (see checklist). Use the screenshots meanwhile.

## Closing line (20 seconds)
"Key points: multi-tenant, role-based access enforced on the server, live updates, encrypted personal data, an audit trail, and 36 end-to-end test suites. Next steps: payroll, two-step sign-in, Redis for scale."
