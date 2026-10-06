---
name: ui-polish-round
description: 2026-10-06 dropdown/branding/theme-toggle fixes (uncommitted) + chart-motion demo boards waiting for user answers
metadata:
  node_type: memory
  type: project
  originSessionId: 41fd222d-2689-474c-832d-bb4df9eed381
  modified: 2026-10-06T14:32:33.975Z
---

Done on 2026-10-06 (uncommitted):
- **Dropdowns.** All 89 native `<select>`s now use `Select` in `components/ui/pickers.tsx`, a drop-in that takes `<option>` children and is built on `SearchSelect`. Outside popups the list floats in a portal so cards can't clip it; inside `[role=dialog]` it stays inline. "Label — text" options show as two lines.
- **Branding stuck on a skeleton.** Companies with no `CompanyBranding` row (the perf-bench seed) never loaded; `GET /companies/:id/branding` now creates the row. The user tests as bhanu1@yopmail.com, the Company Admin of perf-bench. The seed and e2e `makeCompany` now create branding.
- **Theme toggle.** The sun's rays fold into a moon, and a view-transition circular reveal with a glow ring runs from the switch (styles `m-switch-*` and `m-reveal` in `motion.css`). It is skipped when the page isn't drawing. The Claude browser pane can't show view transitions; verify in headless Edge via CDP instead.
- **Test company.** brand-check (admin@brand-check.test, e2e password) was created for branding checks.

Waiting: chart motion boards CAChartMotion + CAChartReports (note n27) are on the canvas, and the user's answers decide what gets built. Related: [[design-canvas-link]], [[perf-findings]].

Round 2 (2026-10-06, uncommitted):
- **Chart motion BUILT.** Answers: play once when seen, morph on data change, the countdown ring changes colour, and apply it to all charts. `MotionVisibility` holds `.m-fill-w/.m-grow-y/.m-draw/.m-sweep/.m-line/...` with `[data-wait]` until they are in view. `.m-line` is now a clip-path wipe, because a dash draw breaks with non-scaling-stroke. `WhenSeen` wraps Recharts, and `CountUp` waits until it is seen.
- **Instant page switch.** `components/layout/pending-nav.tsx` moves the menu highlight at once, shows a top bar and a `PageSkeleton` while the next page loads.
- **Rail removed** everywhere; migration 20261025100000_drop_rail_menu.
- **Sidebar boards** CASideGlide/Motion/Peek/Phone (note n28) designed; they wait for the user's answers. Glide = floating card that folds to icons with tree-line sub-pages; Peek = hover-open icon rail with a pin.
- **User's dev server :3000** had a stale Turbopack build for /app (useContext null). A fresh server renders it fine, so the fix is to restart `pnpm dev`.

Round 3 (2026-10-06, uncommitted): Glide + Peek menu styles BUILT. Answers: build both; each person chooses (no forced default); no Pinned area; remember open/folded on the account. Code: components/layout/tree-nav.tsx (TreeNav, useGlideFolded 'menu:glide-folded', usePeekPinned 'menu:peek-pinned', usePeekHover), styles .m-nav-tree/.m-glide/.m-peek in motion.css, wired in app/(app)/layout.tsx. Super Admin console falls back to classic for glide/peek. A parallel "Bug fixes" session added BrandMedia (3D logos via public/vendor/model-viewer.min.js) and also edits layout.tsx — re-read before editing.
