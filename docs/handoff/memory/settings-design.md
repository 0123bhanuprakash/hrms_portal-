---
name: settings-design
description: "Settings section (branding, theme, delegation, preferences) designed 2026-10-06; 6 questions pending"
metadata:
  node_type: memory
  type: project
  originSessionId: 41fd222d-2689-474c-832d-bb4df9eed381
  modified: 2026-10-06T06:11:37.568Z
---

On 2026-10-06 I designed the Settings section. Builder: `docs/design/builders/build-settings.js`, 10 CASet* boards, canvas note n24, published. It reuses the CSS from build-admin.js, which now exports `css`/`note` and only writes files when run directly.

Main ideas:
- **Branding:** a brand kit with live previews (browser tab, side menu, sign-in page, email). Colours are taken from the logo and can go straight to the theme.
- **Theme:** a theme studio — real-screen preview with light and dark side by side, contrast checks, a before/after slider, version history, seasonal themes.
- **Delegation:** a "going away?" prompt based on approved leave, suggested covers, a team timeline, a welcome-back recap, and an admin Gantt view.
- **Preferences:** an index with search, saves as you go, a live preview, notifications per topic, quiet hours, home order, accessibility.

The user answered:
1. Sign-in welcome line, photo and dark logo — yes.
2. No version history. Seasonal themes were designed first: 5 CASeason* boards from `build-seasonal.js`, note n25.
3. Hand over all 4 approvals by default, and allow unticking some.
4. Only suggest a cover, plus a reminder 2 days before the leave. Never automatic.
5. Notifications per topic plus quiet hours. Quiet hours are off by default; each person turns them on.
6. No Auto light/dark.

Still open (seasonal themes): the festival list, whether HR can set seasons, seasons per office, and whether an employee's own colour theme overrides the season.

The original questions were:
1. Sign-in welcome line, photo and a dark-mode logo?
2. Theme version history, and scheduled seasonal themes?
3. Hand over all 4 approvals, or let people pick?
4. When leave is approved: suggest a cover, or set it up automatically?
5. Notifications per topic plus quiet hours?
6. An "Auto" light/dark mode?

**Why / How to apply:** follow the usual flow — the user answers, then says "start working".

Seasonal answers:
- National festivals only: 11 of them plus a company birthday.
- Whole company only; no office-wise seasons yet.
- New permission "Manage seasonal themes", given to Company Admin and HR. Other roles can be ticked, e.g. a CEO.
- The season goes on for everyone, with a side popup: "Keep it" / "Switch back to my theme". The choice is remembered for that season.

BUILT 2026-10-06 (uncommitted):
- **API.** Migration `*_settings_round`. Seasons module (presets.ts holds the 11 national festivals with 2026–28 dates; `/seasons` list, active, presets and create/update/delete; the active season also appears on the sign-in branding). Branding fields: tagline, logoDarkUrl, signInMessage, signInBackground, signInPhotoUrl, plus logo-dark and sign-in-photo uploads. Delegation: a `permissions` list, `covering()` in access.types used by every approval kind, and cover.service.ts (away, suggest, timeline, gaps, recap, and a 2-day reminder). Notifications: topics.ts with per-topic app/email choices, quiet hours, and a held email released by `releaseHeld` or the daily summary at 09:00. New permission `theme.seasonal` (HR + Admin). Tests: e2e settings-plus (53 checks); role-templates spec.
- **Web.** components/season (season.tsx, seasons-tab.tsx) and app/season.css; the theme tabs live at `/app/settings/theme?tab=seasonal`; Branding, Delegation and Preferences rewritten; a11y-prefs and home-cards components. The theme editor gained "Light + dark" and "Before / after" views. The layout applies the season colours and shows SeasonPopup. Home has the SeasonBanner and hidden cards.
- Not done: dragging Home cards into a new order (only show/hide).
