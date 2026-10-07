# Design DNA — "Clear desk"

Version 0.2 · 6 Oct 2026
Status: **PROPOSED — awaiting approval.** Nothing here is built. Do not implement until the user approves.

v0.1 ("Roster") was rejected by the user. Do not reuse its ideas: no time-scale signature, no people-squares matrix, no pine-first palette.

This file is the source of truth for the visual and interaction language. Every screen is checked with `UI_REVIEW_CHECKLIST.md`.

---

## 0. Principles (in priority order)
1. **Start from the person's job.** Every screen lists its users and their top jobs before any layout is drawn.
2. **What now?** The top of every screen answers "what needs me" and "what can I do".
3. **One place per number, one home per action.**
4. **Plain words.** Say what it is and what happens ("Fix timesheet", "5 of 8 days left").
5. **Accessible by default.** WCAG 2.2 AA in light and dark, keyboard, screen reader, reduce motion.
6. **Honest states.** Every block designs its loading, empty and error states.
7. **Calm.** Decoration only if it helps understanding.

## 1. Brand personality
A helpful, calm colleague. Clear, polite, quick. Never flashy, never cute.
Voice: short plain sentences, active verbs, no jargon, no blame in errors ("We couldn't load your list. Try again.").

## 2. Typography system
| Role | Face | Why |
|---|---|---|
| UI + text | **Public Sans** 400/500/600/700 | Made for public-service interfaces: clear letters, open shapes, good numbers |
| Numbers | Public Sans with `tabular-nums` | Columns line up |

- Fallback: `ui-sans-serif, system-ui, "Segoe UI", sans-serif`.
- The phase-3 font setting can replace it; layouts must not depend on one font's width.

## 3. Font hierarchy (16 px root; follows the text-size setting)
| Token | Size / line | Weight | Use |
|---|---|---|---|
| `h1` | 28 / 35 (phone 24 / 30) | 700 | Page title (one per page) |
| `h2` | 17 / 22 | 700 | Block title |
| `h2-lead` | 19 / 25 | 700 | The main status line ("You're checked in") |
| `body` | 15 / 23 (phone 16 / 24) | 400 | Default |
| `body-strong` | 15 / 21 | 600 | Row titles, names |
| `meta` | 14 / 21 | 400 | Secondary line |
| `small` | 13 / 19 | 400–700 | Group labels, hints. **Nothing smaller than 13 px.** |
| `figure` | 24–28 / 30 | 700 | A key number inside its block |

No all-caps labels (harder to read). Headings use `text-wrap: balance`.

## 4. Color system
The company / personal theme colour stays the **primary**. Default stays indigo (familiar to current users).

| Token | Light | Dark | Contrast (on surface) |
|---|---|---|---|
| `--bg` | #F6F6F9 | #101015 | — |
| `--surface` | #FFFFFF | #18181F | — |
| `--subtle` | #F0F0F5 | #212129 | — |
| `--text` | #17171C | #EDEDF2 | 17.9 / 15.1 |
| `--text-2` | #4F5260 | #B9BBC7 | 7.8 / 9.3 |
| `--text-3` | #626574 | #9EA0AD | 5.8 / 6.8 |
| `--border` | #DEDFE6 | #2C2C36 | decorative only |
| `--border-strong` | #8E91A0 | #6E7080 | 3.1 / 3.6 (controls) |
| `--primary` | #4B44D6 | #A09CFF | 6.8 / 7.3 |
| `--ok` | #1A7543 | #63CF92 | 5.7 / 9.1 |
| `--warn` | #8A5300 | #F0B957 | 6.3 / 9.9 |
| `--bad` | #B42318 | #FF8F80 | 6.6 / 8.0 |
| `--info` | #1D5FA8 | #82B6F7 | 6.5 / 8.4 |

Rules:
- Primary only for: the main action, links, focus ring, selected state.
- Status = colour **+ icon + word**, always.
- Text on a coloured fill uses its `--on-*` token (checked ≥ 4.5:1).
- If a company colour fails 4.5:1 on white, the theme engine darkens it for text use (to check when built).

## 5. Surfaces
- Page `--bg` → block `--surface` with 1 px border, 12 px radius → floating (menus, dialogs, toasts) with shadow.
- A block = one job (Your day, Needs you, Quick actions...). No block inside a block.
- Proposals in concepts use a dashed border and a "Proposal" tag.

## 6. Borders
1 px `--border` for blocks and row dividers. 1 px `--border-strong` for inputs and secondary buttons (3:1 rule for controls).

## 7. Radius
| Use | Radius |
|---|---|
| Blocks, dialogs, toasts | 12 px |
| Buttons, inputs, tiles, segmented controls | 8 px |
| Badges / counts | full |
| Avatars | round |

## 8. Elevation
Blocks: none. Floats: `0 1px 2px / 6%, 0 10px 28px -10px / 22%` (stronger in dark). No coloured shadows, no glow.

## 9. Spacing
4 px base × existing `--space` density. Inside blocks 16–18; between blocks 20 (phone) / 24 (desktop); page padding 16 (phone) / 28 (desktop).

## 10. Grid
- Desktop ≥ 1100 px content: main column + 340 px side column.
- Below: one column **in task order** (Your day → Needs you → Quick actions → role blocks → people).
- Two half-width blocks side by side from 860 px.

## 11. Icons
lucide, 18–22 px, stroke 1.9. Icons are used when they carry meaning: status, action tiles, row type. Never decorative tiles.

## 12. Buttons
| Variant | Use |
|---|---|
| Primary (filled) | The one main action of a block (Check in) |
| Secondary (outlined, 3:1 border) | Row actions (Review, Fix, Confirm) |
| Text link (always underlined) | Navigation ("See all", "Full calendar") |
| Danger | Destructive, in dialogs |

Sizes: 40 px desktop, 48 px phone; small 36 / 44. Labels are verbs. Screen readers get the object too ("Review 3 leave requests"). Pressed = 1 px down; busy = spinner + "Checking in…".

## 13. Inputs
Label above (14/600), help below (13), error below with how to fix. 3:1 border. 44 px+ on phone. Placeholder never replaces a label.

## 14. Tables
Used for real tabular data (My week). Header row + caption for screen readers. Today's row marked with a bar **and** "(today)" for screen readers. On phone, tables scroll inside their block.

## 15. Blocks (instead of "cards everywhere")
Each block: `h2` + optional count + optional hint + optional right-side switch/link, then content. Content first, chrome second.

## 16. Navigation
- Sidebar: same groups, items, order and permissions. 36 px rows, 18 px icons, clear selected state (tint + bold + coloured icon), count badges with an accessible label.
- Top bar: 56 px, sticky; menu button on phone, breadcrumb, live status, bell (count), theme toggle. All 44 px targets.

## 17. Tabs
Underline tabs with 3 px indicator, `role="tablist"`, arrow keys + Home/End, count in the label.

## 18. Data visualisation
- Labelled horizontal bars with icon + word + number. Donut / rings only as "Show as" options.
- Every chart has the numbers in text.
- Bars grow once (Lively only).

## 19. Empty states
Inline, one line of what happened + what will appear ("You're all caught up. New approvals and to-dos will show here.").

## 20. Loading
Skeleton in the final shape, `aria-busy`, screen-reader "Loading…". Shimmer only in Lively.

## 21. Errors
Inside the block: icon + what failed + reassurance + "Try again". `role="alert"`. Never a full-page error for one block.

## 22. Success
The item changes state, and a toast confirms ("Checked out at 10:43"). Done items leave the list.

## 23. Toasts
Top-right (user decision), max 3, 4.5 s, in a polite live region. Errors stay until closed.

## 24. Dialogs
Existing Modal kit behaviour. Focus goes to the first field, Tab is trapped, Esc closes, focus returns to the button that opened it. Bottom sheet on phone.

## 25. Drawers
Right side for "look without leaving" (later modules). Same focus rules as dialogs.

## 26. Tooltips
Only for extra detail, never the only place for information. Shown on hover **and** focus.

## 27. Motion
| Token | Time | Use |
|---|---|---|
| quick | 120 ms | hover, press |
| base | 160–200 ms | page arrive, toasts, disclosure |
| data | 500 ms | bars grow on first load (Lively) |

Lively = all of the above. Calm = fades only. Off / device reduce-motion = none. Nothing loops or moves forever (WCAG 2.2.2). Only `transform` and `opacity`.

## 28. Responsive (phone first)
- Design the phone order first; desktop adds a side column.
- Phone: one column, 16 px body, 48 px buttons, check-in in a sticky bottom bar (safe-area aware), the block's own check-in button hidden to avoid two homes.
- No horizontal page scroll at 320 px.

## 29. Accessibility (WCAG 2.2 AA)
- Contrast as in §4; focus ring 3 px + 2 px gap.
- Targets ≥ 24 px (AA), we use 40 px desktop / 44–48 px phone.
- Landmarks: nav (menu), main, "Your day" region; one `h1`, `h2` per block.
- Status by icon + word; links underlined.
- Live regions for toasts and counts; `aria-busy` while loading; `role="alert"` for errors.
- Keyboard order = visual order; no `tabindex > 0`.
- Text resize to 200% without loss (rem-based).

## 30. Interaction patterns
- **One list for "Needs you"**: approvals then to-dos, each with reason + one button.
- **Look before you leave**: buttons say where they go.
- **Disclosure** for less-used content ("All shortcuts", admin "My week"), with `aria-expanded`.
- **Confirm only when it matters** (early check-out), never for routine actions.
- **Remember choices** ("Show as" is saved per person, as today).
