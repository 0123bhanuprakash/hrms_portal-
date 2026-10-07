---
name: celebration-wishes
description: Birthday / work-anniversary wishes are their own feature (not kudos) — rules, grouped festive notification, /app/wishes; BUILT 2026-10-08 (uncommitted)
metadata:
  type: project
---

User asked 2026-10-08: Home → Celebrations "Send wishes" must stay a celebration feature, not kudos; the celebrant gets "[Name] wished you on your [celebration]"; nobody can wish themselves.

BUILT 2026-10-08 (uncommitted): table `celebration_wishes` (migration 20261028100000), one wish per sender per person per occasion, only on the day (company time zone), sticker + optional 280-char line, private (others see only the count). API `CelebrationsService` in engagement module: POST /celebrations/wishes, GET /celebrations/today, GET /celebrations/wishes/mine. Notification = ONE grouped row per occasion via `NotificationsService.notifyGrouped` ("Priya, Amit and 3 others wished you a happy birthday 🎂"), re-marked unread each wish, in-app only, follows the "Kudos & celebrations" topic setting. Festive look: `.celebrate-note` / `.celebrate-icon` (motion.css) in bell row, pop-up and the dialog's preview. Web: `WishDialog` (components/engagement/wish-dialog.tsx), Celebrations card `WishActions` (Wished ✓, celebrant gets "See your wishes"), People page Wish button, page /app/wishes. Live topic `celebrations` (docs/realtime.md). e2e: celebrations.e2e.js 25/25.

Test data: SeedsAI Sachin Pawar's birthday was moved to 10-08 (was 1997-09-28) so wishes could be tried.

**Why:** user wants celebrations to feel personal and separate from recognition (kudos).
**How to apply:** other "Send kudos" buttons (photo card, quick look, employee hero, reports anniversaries) are deliberately still kudos. Related: [[plan-b-decisions]], [[live-updates]].
