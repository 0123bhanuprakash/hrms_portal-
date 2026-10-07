---
name: celebration-wishes
description: Birthday / work-anniversary wishes are their own feature (not kudos) — rules, grouped festive notification, /app/wishes; BUILT 2026-10-08 (uncommitted)
metadata:
  type: project
---

User asked 2026-10-08: Home → Celebrations "Send wishes" must stay a celebration feature, not kudos; the celebrant gets "[Name] wished you on your [celebration]"; nobody can wish themselves.

BUILT 2026-10-08 (uncommitted): table `celebration_wishes` (migration 20261028100000), one wish per sender per person per occasion, only on the day (company time zone), sticker + optional 280-char line, private. API `CelebrationsService` in engagement module: POST /celebrations/wishes, GET /celebrations/today, GET /celebrations/wishes/mine. Notification = ONE grouped row per occasion via `NotificationsService.notifyGrouped` ("Priya, Amit and 3 others wished you a happy birthday 🎂"), re-marked unread each wish, in-app only, follows the "Kudos & celebrations" topic setting. Festive look: `.celebrate-note` / `.celebrate-icon` (motion.css) in bell row, pop-up and the dialog's preview. Web: `WishDialog` (components/engagement/wish-dialog.tsx), Celebrations card `WishActions` (Wished ✓, celebrant gets "See your wishes"), People page Wish button, page /app/wishes. Live topic `celebrations` (docs/realtime.md). e2e: celebrations.e2e.js 25/25.

Test data (2026-10-08): SeedsAI birthdays moved to 10-08 so wishes could be tried — originals: Sachin Pawar 1997-09-28, Kavitha Reddy 1987-08-15, Vivek Nair 1990-09-13, Suresh Venkataraman 1999-06-20, Girish Shenoy 1993-10-22. Work anniversaries moved to 10-08 (joining date, same year): Manoj Pillai was 2017-11-06, Lakshmi Iyer was 2018-04-16. Restore when the user asks.

Later 2026-10-08 (user): Celebrations card shows ONE PERSON PER SLIDE (birthdays like anniversaries; >6 slides → "3 / 12" counter; dialog opens on that person, others celebrating can be ticked). The wish COUNT is visible only to the celebrant (spotlight returns wishesToday only on the caller's own entry; live ping only to celebrant + sender) — avoids comparing who got more.

**Why:** user wants celebrations to feel personal and separate from recognition (kudos).
**How to apply:** other "Send kudos" buttons (photo card, quick look, employee hero, reports anniversaries) are deliberately still kudos. Related: [[plan-b-decisions]], [[live-updates]].
