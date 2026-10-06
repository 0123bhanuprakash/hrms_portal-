---
name: perf-findings
description: 2026-10-06 speed investigation — slowness is mostly Next dev-mode compiling; list of real fixes found
metadata:
  node_type: memory
  type: project
  originSessionId: 41fd222d-2689-474c-832d-bb4df9eed381
  modified: 2026-10-06T09:23:38.266Z
---

Measured on 2026-10-06 with the perf-bench company (495 employees).

**Main cause.** The slow page switching is `next dev` compiling each page on its first visit:
- Webpack dev: 1–8.4 s per page and 1,500–2,800 modules. A full reload takes 9 s, and the first API call starts only at 9.4 s.
- Turbopack (`next dev --turbo`): 1.1–2.3 s per page; it works with this app. Launch config: "web-turbo".
- Production build: a full load in 0.7 s; page switches take 0.2–0.3 s on the first visit and 0.12–0.2 s after.

**API.** Most calls take 5–50 ms.

**Real fixes found** (not yet done, waiting for the user):
- The leave `pendingCount` builds the full 100-row review list just to count it: 110–200 ms on every page, and polled every 2 minutes.
- Home makes 31 calls, including `/announcements` three times; the layout alone makes about 14 calls on every page.
- The Leave page makes 3 overlapping `/leave/requests` calls.
- `/org/chart` sends 276 KB to every people picker.
- The reports overview takes 500 ms cold.
- Home has 142 running animations.
- Every page switch remounts the page and plays a 250 ms fade.

`next.config.mjs` now reads `distDir` from `NEXT_DIST_DIR`, so a production build can go to `.next-prod` while dev runs.

FIXED 2026-10-06 (uncommitted):
1. **Turbopack.** The web `dev` script is now `next dev --turbo`: about 1.2–1.5 s per page instead of 4.7–7.7 s. The first page after the server starts can still take 6–29 s.
2. **Leave pending count.** It uses `waitingForMe` (the light DECIDE_SELECT, ids only): 31–46 ms, down from 110–206 ms. The review list loads full rows only for the page it shows.
3. **Announcements.** They share `HOME_ANNOUNCEMENTS` (one request), and the "to confirm" list loads only when `needsAck > 0`. The Leave page's upcoming and year views share one request. Home now makes 29 calls with no repeats.
4. **People pickers.** `GET /org/people` plus `usePeoplePicker()` replace the org chart in 10 picker screens; the Org page still uses the full chart.
5. **Motion.** The page-switch fade is now 150 ms, `m-stagger`/`m-rise` take 0.32 s, and every animation pauses while the tab is hidden.

Not done: reports overview speed, and one call for all sidebar badges.
