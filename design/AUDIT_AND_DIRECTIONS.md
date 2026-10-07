# Current UI audit and design directions

Version 0.2 · 6 Oct 2026 · Design Director
Status: **audit done · direction A rejected · new direction "Clear desk" awaiting approval**

This file has three parts:
1. What the app is made of today (structure)
2. The current UI design audit (10 points) and AI-slop findings
3. Design directions: the rejected first round, user needs per role, and the new direction

---

## 1. What the app is made of today

### Frontend architecture

| Part | What it is |
|---|---|
| Framework | Next.js 14 app router, React Query, Zustand (`store/useAuthStore`) |
| Styling | Tailwind with HSL CSS variables (`globals.css`), shadcn-style tokens: background → surface → raised → overlay |
| Theme engine | Company and personal themes override `--primary`, `--radius`, `--shadow-*`, `--font-sans`, density (`--space`) and text size. Light and Dark only (no "System"). |
| Fonts | Inter (sans) + JetBrains Mono, loaded with `next/font` |
| Motion | `app/motion.css` (78 `m-*` classes: stagger, fills, lift, tilt, shine, sky hero, confetti, heart burst, pulse...), `emoji-motion.css`, Lively / Calm / Off setting, `data-motion="reduce"` |
| Backgrounds | 4 packs (Signature, Terra, Prism, Simple) with a mood per section: `backdrops.css` + `backdrop-packs.css` (1,830 lines) |
| Seasons | Seasonal themes (11 national festivals) with banner + popup |
| Shared UI | `components/ui/`: Button, Badge, StatusBadge, Card + CardHeader + Tabs + EmptyState + Skeleton (`feedback.tsx`), Field, Modal (sizes, bottom sheet on phone, discard guard), Pickers, ConfirmDialog, DropdownMenu, Tooltip, StatCard, PageHeader |
| Layout | `(app)/layout.tsx`: sidebar (4 menu styles: Classic, Rail, Floating, Collapsible) + sticky top bar (breadcrumb, live dot, bell, theme toggle) |

### Pattern counts (rough, from `apps/web/src`)

| Pattern | Uses |
|---|---|
| `<Card` | ~494 |
| `rounded-full` | ~370 |
| `rounded-xl` / `rounded-2xl` | ~192 |
| `gradient` | ~78 |
| `backdrop-blur` | ~27 |

Almost everything on every screen is a rounded card with a border and a shadow.

### Modules and screens

| Module | Screens (routes under `/app`) |
|---|---|
| Home | Home dashboard (role-aware: company-wide vs employee) |
| My profile | `/profile` |
| People | `/people` (directory) |
| Reports | `/reports` |
| Employees | `/employees`, `/employees/[id]`, `/employees/import` |
| Organisation | `/org` |
| Announcements | `/announcements`, `/[id]`, `/new` |
| Kudos | `/kudos`, `/kudos/insights` |
| Projects | `/projects`, `/projects/[id]`, `/projects/planner` |
| Timesheets | `/timesheets`, `/timesheets/approvals` |
| Expenses | `/expenses`, `/[id]`, `/approvals`, `/payments`, `/categories` |
| Assets | `/assets/mine`, `/assets/requests`, `/assets` (register), `/assets/[id]`, `/assets/request`, `/assets/types` |
| Helpdesk | `/helpdesk`, `/[id]`, `/new`, `/queue`, `/categories` |
| Attendance | `/attendance`, `/team`, `/approvals`, `/holidays`, `/settings` |
| Leave | `/leave`, `/approvals`, `/calendar` (Who's off), `/types` |
| Administration | `/users`, `/roles`, `/roles/[id]`, `/roles/compare`, `/access-explorer` |
| Settings | `/settings/branding`, `/settings/theme`, `/settings/preferences`, `/delegations` |
| Notifications | `/notifications` |
| Super Admin | overview, companies (+ new, [id]), plans (+ [id]), system, audit logs, themes (+ editor), profile |
| Sign-in | company + platform: login, forgot, reset, verify email, change password |

### How the Home dashboard differs by role

| | Company-wide view (Company Admin, HR, anyone with company scope) | Employee view |
|---|---|---|
| Hero | Greeting + "X of Y people are in. N approvals waiting." + 4 stats (Employees · depts, Present today / total, On leave · WFH, Waiting for you) + up to 4 actions (Add employee, Post announcement, Reports, Apply leave...) | Greeting + "You're checked in since 09:41. 2 things need you." + 3 stats (Present this month, Avg a day, Leave left) + actions (Apply leave, Work from home, Timesheet, Give kudos) |
| Next to hero | Attendance today (donut or list) | Today card (check-in ring, sessions, check in / out button) |
| Main column | Waiting for your approval · My week · Who's off + By department · Joiners & leavers · Needs your action + Probation & notice · Quick actions | My week · Leave balance · Needs your action + My projects · Waiting for your approval (if approver) · Quick actions |
| Side column | Celebrations today · Today (if employee) · Admin shortcuts · Coming up · My team · Make it yours · Kudos | Celebrations today · Coming up · My team · Make it yours · Kudos |
| Bottom | Announcements | Announcements |
| Extra | Season banner, Complete-profile nudge, atmosphere "moments" (birthday balloons, festivals, monsoon, Friday wind-down, office lights), hidden cards from Preferences | same |

---

## 2. Current UI design audit

### 2.1 What works
- **Solid token base.** Every colour comes from HSL variables, and the theme engine can change primary, radius, shadow, font and density. This is a strong foundation for a real design system.
- **Role-aware content.** Home already shows different content for company-wide people and employees. The information is right; the presentation is the problem.
- **Data is honest and specific.** "Shift 09:30 – 18:30", "2 sessions · break 40m", "Missed check-out", "Week of 28 Sep". This real HR vocabulary is the best raw material for identity.
- **Accessibility basics.** Focus rings, reduce-motion support, Lively / Calm / Off, text-size and density settings.
- **Good components to keep:** Modal kit (sizes, phone bottom sheet, discard guard, Ctrl+Enter), Pickers, Tabs with sliding indicator, "View as" switch per chart, Skeleton.
- **Tabular numbers and short helper text** are already used in many places.

### 2.2 What feels generic
- Every block is the same object: `rounded-xl border bg-surface shadow-card` + a CardHeader. ~15 identical cards on Home.
- Indigo primary (hsl 243°) is the default Tailwind / shadcn indigo. It is the most common SaaS colour today.
- Inter with the default scale. Titles, numbers and labels all use the same face at similar weights.
- Icon tiles: a soft-tinted rounded square with a lucide icon in front of every row (quick actions, approvals, shortcuts).
- 12-column "hero 8 + side 4", then "main 8 + side 4" with stacked cards. This is the default dashboard template.

### 2.3 What feels AI-generated
- **The sky hero**: time-of-day gradient, sun, clouds, hills, stars, pointer spotlight, glass stat tiles (`bg-black/20 backdrop-blur`), and "Good morning, Hema" as the biggest text on the screen.
- **Glass pill buttons on the hero** (`rounded-full bg-white/10 backdrop-blur`).
- **Gradient logo tile with shine** in the sidebar.
- **Hover lift with coloured glow** (`m-lift`: translateY(-4px) + primary-coloured shadow) on many tiles; **3D tilt + shine** on others.
- **A soft radial glow** at the top of every page (`.bg-canvas`).
- **Count-up numbers** and staggered rise on every card on every page load.
- **Emoji and moving tickers** used as decoration (kudos marquee, celebration carousel).

### 2.4 What feels visually inconsistent
- Radii mix: `rounded-md` buttons, `rounded-lg` tiles, `rounded-xl` cards, `rounded-full` badges, buttons and hero actions.
- Two button languages: the `Button` component (rounded-md) and hand-made pill links on the hero.
- Links in card headers are plain text ("Full calendar", "Team", "Calendar"); actions in rows are bordered buttons ("Review"); quick actions are tiles. Three ways to say "go there".
- Status colour is drawn in four ways: soft pill, dot badge, ring, coloured text.
- Backdrop packs (13 moods × 4 packs) add a second, separate visual language under the cards.

### 2.5 What feels unnecessarily complex
- Home has ~15 blocks for an admin. Several repeat the same fact: "Waiting for you 9" appears in the hero, the approvals card, the sidebar badges and the bell.
- "Quick actions", "Admin shortcuts", hero actions and "Make it yours" are four shortcut lists on one page.
- Motion library of 78 classes, 4 background packs with 13 moods each, seasonal themes, and atmosphere moments all run at once. The page has many voices.
- Equal-height card pairs (`Pair`) stretch content and create empty space.

### 2.6 What should be removed (visually; nothing functional)
- Sky gradient, sun, clouds, hills, stars and pointer spotlight in the hero.
- Glass tiles and glass pill buttons.
- Gradient + shine logo tile.
- Coloured glow on hover lift; 3D tilt.
- Radial page glow.
- Soft icon tiles in front of every row.
- Count-up on every visit (keep only on first load of the day, Lively only).

### 2.7 What should be retained
- All information and every action on Home, for both roles.
- Token architecture and the theme engine (company primary, density, text size, font setting).
- "View as" switches, Who's off calendar/list, Joiners & leavers views (D tiles + A mirror bars default).
- Check-in / check-out flow, sessions, early check-out, night shift.
- Celebration moments (birthdays, anniversaries) and seasonal themes, but quieter.
- Modal kit, pickers, tabs indicator, skeletons.
- Lively / Calm / Off, reduce motion.

### 2.8 What should be redesigned
- The Home composition (both roles).
- The hero: from a decorative sky to a factual "Today" header with the day timeline.
- Card system: fewer, clearer blocks ordered by user need.
- Sidebar and top bar look (same items, same order; see question Q1).
- Status language: one way to show status everywhere.
- Typography: a real scale with a display face for figures and titles, and mono for clock times and IDs.
- Colour use: company colour only for actions, links, focus and selection; status colours always with icon + word.

### 2.9 What can become part of the new design system
- The Today card (check-in, sessions, early check-out dialog) → becomes **Your day**, the first block for everyone.
- The "Needs your action" ActionRow → becomes the standard **task row** (icon + title + reason + one button).
- "View as" switch → standard segmented control.
- Modal kit → standard dialog.
- Tabs with sliding indicator → standard tabs.
- ActionRow ("Missed check-out · 2 Oct · Fix") → standard **task row**.

### 2.10 What should NEVER be repeated
- A decorative hero with a greeting as the largest element.
- Sky, sun, clouds, buildings, globe, orb or any illustration behind data. (Globe and gold orb were already rejected by the user.)
- Glass surfaces over gradients.
- Pill-shaped primary buttons.
- Hover effects that move a block up and add coloured glow.
- A grid of identical cards as the page layout.
- An icon in a tinted square in front of every list row.
- The same number shown in 3 places on one screen.

### 2.11 AI-slop findings (problem → why generic → replacement → how it builds identity)

| # | Problem | Why it feels generic | Replace with | How it builds identity |
|---|---|---|---|---|
| 1 | Sky hero with "Good morning, Hema" | Every AI dashboard opens with a big greeting on a gradient. Says nothing about work. | **Your day** block (am I checked in, since when, hours worked, one button) followed by **Needs you**. Greeting stays as a normal-size heading. | The top of Home answers the user's real first question. |
| 2 | Glass stat tiles on the hero | Glassmorphism stat tiles are a Dribbble cliché. | Numbers live in the block they belong to (count on "Needs you", totals in "Company today"). | One place per number; less to read. |
| 3 | ~15 equal rounded cards | Bento / card-grid template. No hierarchy. | About 8 blocks ordered by how often people need them; size follows importance. | Order and clarity become the identity. |
| 4 | Indigo used everywhere as decoration | Default shadcn look. | Keep the company colour, but use it only for the main action, links, focus and selection. Status uses its own colours with icon + word. | Colour means something, so people learn it. |
| 5 | Pill buttons + glass pills | Consumer-app / AI landing-page style. | 6 px radius buttons, one primary per area, text links for navigation. | Restraint reads as enterprise. |
| 6 | Hover lift + glow + tilt + shine | Motion for its own sake. | Hover = surface tint and underline. Motion only for state change. | Calm, fast, "tool" feeling. |
| 7 | Icon tile before every row | Pads the UI, slows scanning. | Icons only where they help find something (sidebar, file types). Rows start with text or a person. | Typography does the work. |
| 8 | Donut for "attendance today" | Donuts are the default AI chart; hard to read. | Labelled bars: icon + word + number per status ("In office 11"). Donut stays as a "Show as" option. | Readable at a glance, works for screen readers and without colour. |
| 9 | Moving kudos ticker / carousel | Motion that competes with work. | Static list of the 3 latest kudos; motion only when a new one arrives. | Human content stays readable. |
| 10 | Four shortcut lists | Repetition fills space. | One **Quick actions** block: 6 role-based tiles + "All shortcuts". | Each link has one home. |

---

## 3. Design directions

### 3.1 First round (v0.1–v0.2): rejected
| Direction | Idea | Result |
|---|---|---|
| A "Roster" | People + time as the visual identity (Day Rule time scale, Roster Matrix squares, pine green) | **Rejected by the user, 6 Oct 2026.** User: "I just don't like the idea." The whole concept is dropped, not just details. Do not bring back the time-scale or people-squares identity in any form. |
| B "Dossier" | Editorial, serif, printed HR file | Not chosen |
| C "Console" | Dense, dark, keyboard-first tool | Not chosen |

Lesson: starting from a visual signature was the wrong starting point. The user wants the design to start from **people's needs**.

### 3.2 New brief (user, 6 Oct 2026)
> "Make the entire design more user-centric and experience-focused, prioritizing user needs, clarity, usability, accessibility, and intuitive interactions."

### 3.3 Who uses Home and what they need

| Person | Top jobs on Home (most frequent first) | How often | What they must see first |
|---|---|---|---|
| **Employee** (Amit, Neha, Sara) | 1. Check in / check out · 2. Fix what was sent back, confirm things (timesheet, laptop, missed check-out, announcement) · 3. Apply leave / WFH, log timesheet, claim expense · 4. See my week and leave left · 5. Celebrations, kudos, news | 1–4× a day · a few times a week · weekly · weekly · casual | "Am I checked in?" and "Does anything need me?" |
| **Manager / lead** (Priya, Karan, Ravi, Vikram) | 1. Approve what waits for me (leave, timesheets, corrections) · 2. Everything an employee does · 3. Know who in my team is in or off | daily · daily · daily | "What is waiting for my decision?" |
| **HR / Company Admin** (Hema, Bhanu) | 1. Approvals across modules · 2. Who is in, off, not in yet · 3. Add people, post news, open reports · 4. Probation, notice, joiners, departments · 5. Their own employee jobs | daily · daily · weekly · weekly · daily | "What needs me, and is the company running normally today?" |

What this means for the layout:
1. **Your day** first, for everyone. Everyone is an employee (user rule), and check-in is the most frequent job.
2. **Needs you** second: one list with approvals ("Waiting for your approval") and personal to-dos ("Your to-dos"). Each row has a reason and one clear button.
3. **Quick actions** third: the 6 most used actions for that role as large targets, plus "All shortcuts" for the rest.
4. Then role information: employees get My week, leave and projects; HR gets Company today, Who's off and Workforce.
5. Then people things: celebrations, coming up, team, kudos, announcements.

### 3.4 New direction: "Clear desk" (recommended)
**Idea:** Home is a desk you clear. The top always answers three questions, in this order: *Where am I today? What needs me? What can I do?* Everything else sits below, in order of how often people need it. Identity comes from behaviour and clarity (one list, plain words, one button per item, honest states), not from a decoration.

Two variants were considered:

| Variant | How it works | Strengths | Weaknesses | Verdict |
|---|---|---|---|---|
| **1. One column of priorities + side rail** | Your day → Needs you → role blocks in the main column; Quick actions + people in a right rail. Phone: the same order in one column, check-in in a bottom bar. | Same mental order on every screen size; everything visible without clicking; easy to scan | Long page for HR | **Recommended** |
| 2. Tabs "My work / My team / Company" | Home split into tabs by scope | Short pages | Hides information behind clicks; people miss approvals; more taps on phone | Not chosen |

**Why variant 1:** daily jobs stay on top for every role, nothing is hidden, and the phone gets the same order instead of a squeezed desktop.

Current concept: https://claude.ai/artifact/Tmk1ebtXJVRnBa2Ywa5Snx (v1.0)
