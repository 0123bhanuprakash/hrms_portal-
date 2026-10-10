# HRMS Demo and Technical Guide: Master Plan

Goal: one Word file (`HRMS-Demo-Guide.docx`, about 50-60 pages, compact but industry level) that lets the owner demo the whole HRMS, defend every technical decision and answer follow-up questions.

## Rules for every session (keeps token cost low)
- Use Sonnet. Start each session in a new conversation.
- Read this file first, then `docs/handoff/HANDOFF.md`, `docs/realtime.md` and the memory notes in `docs/handoff/memory/`. Read code only for what the part needs (controller, key service methods, that module's part of `schema.prisma`).
- Write each part once, to `docs/demo-guide/NN-name.md`. Never rewrite finished parts.
- Facts come from the code or notes. If unsure, say "verify" instead of guessing.
- Real code snippets (5-15 lines) only for the demo modules: Employees, Leave, Live updates, Auth/access.

## Parts

### Part 0: Demo script (3 pages)
10-minute walkthrough: which account to log in with, what to click, what to say, in which order, and a fallback if something breaks.

### Part 1: Technical stack and tools (10 pages)
One entry per tool, same template for each:
1. What it is
2. Why an HRMS needs it
3. Where it is used in this project (file or module)
4. Alternatives and why they were not chosen
5. Advantages and disadvantages
6. Interview answer in 2 lines

Tools to cover (confirm each against `package.json` in Session 1): Turborepo monorepo, Node.js and TypeScript, Next.js (React), NestJS, Prisma ORM, PostgreSQL, WebSocket (live updates), job queue, email service, file storage (local disk), validation (DTOs), authentication (tokens/cookies), UI libraries, charting, testing (e2e), dev tooling.

### Part 2: Architecture (8 pages)
- Diagram: browser, web app, API, database, queue, WebSocket.
- Life of one request, step by step (example: apply for leave).
- Multi-tenancy (how one company's data is kept apart from another's).
- Roles and access: Super Admin, Company Admin, HR, Manager, Lead, PMO, Employee.
- Module map and how modules talk to each other.
- Key decisions and trade-offs (monolith vs microservices, REST vs GraphQL, local disk vs cloud storage, WebSocket vs polling).

### Part 3: Security (5 pages)
Sign-in and sessions, role checks, encryption of personal data, input validation, file upload safety, rate limiting, audit trail, known gaps (two-step sign-in deferred, API/access audit pending), and how to answer "is it secure?".

### Part 4: Database (6 pages)
103 tables grouped by area (company and plans, people, org, attendance and time, leave, projects and timesheets, expenses and assets, helpdesk, engagement, system). For each group: main tables, key relations, important rules. Plus migrations, seed data (demo company, SeedsAI company) and indexes/pagination.

### Parts 5-12: Feature modules (3-5 pages each)
Same layout for each module:
1. What it is and why an HRMS needs it
2. Business rules (bullets)
3. How it works: screen, API endpoint, service, tables
4. Why this approach and not the alternatives
5. Security points and edge cases
6. Limits and trade-offs
7. 30-second demo pitch
8. 8-12 likely questions with short answers

Modules:
5. Employees and lifecycle (onboarding wizard, import, internship end, exit, experience letter)
6. Org: departments, designations, locations, org chart
7. Attendance and Time
8. Leave (types, eligibility, grants, lend/give days, year-end take-back, statement, approval routing)
9. Projects, Timesheets, Resource requests and PMO
10. Expenses and Assets
11. Helpdesk (teams, priorities, live updates)
12. Engagement (announcements, kudos, celebrations, wishes) and Notifications

### Part 13: Platform and admin (4 pages)
Super Admin portal, plans, Administration, Settings, themes and seasons, delegations.

### Part 14: Frontend (4 pages)
App structure, shared UI kit, popup forms, motion, themes, pagination, performance fixes, live-update handling.

### Part 15: Question bank (10 pages)
About 100 questions with short model answers: general, architecture, security, database, per module, "why didn't you use X?", "what would you improve?", and "what if..." edge cases.

### Part 16: Limits and next steps (2 pages)
Honest list of weaknesses, what is deferred (two-step sign-in, multi-tab sessions, API audit) and the roadmap.

## Sessions
| Session | Parts | Budget |
|---|---|---|
| 1 | 0, 1, 2 | about 6-7% of weekly limit |
| 2 | 3, 4, 5, 6 | about 6% |
| 3 | 7, 8, 9, 10, 11, 12 | about 7% |
| 4 | 13, 14, 15, 16, then build the .docx | about 6% |

After Session 1, check Settings -> Usage. If it cost more than 7%, shrink the later parts.

## Build the Word file
At the end, a small script joins the `.md` files in order and converts them to `HRMS-Demo-Guide.docx` (pandoc, or the docx skill) with a title page, table of contents and numbered headings.

---

# DOCUMENT B: User Guide for Customer Companies (added)

File: `HRMS-User-Guide.docx` (about 45-55 pages). Audience: HR, managers, employees and company admins who have never seen the product. Plain language, no code, no internal technology. Written from the user's point of view.

## Structure
- Front matter: cover, version, how to use this guide, who sees what (role table), glossary.
- 1. Getting started: invitation, first sign-in, profile, themes, notifications, live updates.
- 2. Quick start by role (one page each): Employee, Manager/Lead, HR, Company Admin, IT Admin, PMO.
- 3. Feature chapters (same template each): What it does, who can use it, step-by-step (numbered, with screenshot placeholders), rules and limits in plain words, common questions, troubleshooting.
  Chapters: Home and announcements, Employees and onboarding, Org chart and departments, Attendance and Time, Leave (apply, balances, extra days, statement), Timesheets and Projects, Resource requests, Expenses, Assets, Helpdesk, Kudos, Celebrations and Wishes, Reports, Administration and Settings.
- 4. Admin handbook: set up a company, roles and permissions, leave rules, approval routing, teams, branding.
- 5. FAQ (about 60) and troubleshooting table.
- 6. Security and privacy summary for the customer's IT team.
- Appendix: role/permission matrix, field glossary, release notes.

## Rules
- Screenshots are taken once in the browser (test company), saved in `docs/user-guide/img/`, and reused.
- Same session budget as Document A, using Sonnet. Write chapters from the existing screens and notes.

## Combined schedule (6 sessions, about 6% of weekly limit each)
| Session | Work |
|---|---|
| 1 | A: Parts 0, 1, 2 |
| 2 | A: Parts 3-6 |
| 3 | A: Parts 7-12 |
| 4 | A: Parts 13-16 and build `HRMS-Demo-Guide.docx` |
| 5 | B: front matter, quick starts, chapters 1-7 |
| 6 | B: remaining chapters, admin handbook, FAQ, build `HRMS-User-Guide.docx` |

Order: if the demo is first, do A first. If a customer handover is first, do B first.
