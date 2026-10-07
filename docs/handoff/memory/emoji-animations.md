---
name: emoji-animations
description: Emoji animations across the app — BUILT 2026-10-06 (uncommitted); shared <Emoji> component + emoji-motion.css
metadata:
  node_type: memory
  type: project
  originSessionId: 0bfd695c-c301-461b-8dce-50d853684037
  modified: 2026-10-05T23:37:31.034Z
---

User asked to animate emojis wherever the app uses them. Design boards: build-emoji.js (EmojiMotion, EmojiInPlace). BUILT 2026-10-06, not committed:
- `components/motion/emoji.tsx`: `<Emoji e play="hover|appear|none" fire burst label>` + `EmojiText` (splits "🎂 Birthday"), `moveOf()` map (~70 emojis → 21 moves, unknown → pop). `app/emoji-motion.css` (imported in app/layout.tsx): moves via `--emo-anim` per `data-move`; plays on `.emo-hover:hover`, parent `.emo-host:hover`, or `[data-play]` (appear / fire, keyed so it replays). Reduce motion → globals.css shortens to 0.
- Wired: kudos reactions (inside existing HeartBurst), announcement ReactionPill + Wave button (old sc-burst removed) + greeting 👋 + caught-up, stories reactions + toast, cover picker, kudos toast/insights, people ribbons/quick-look/birthday, timesheet week chips + approvals 🌴, leave calendar 🙌, holidays art, project milestone toast, helpdesk hero chips/team cards, raise page team cards/topics, rating faces. EmptyState title now ReactNode.
- Status dots 🔴🟠🟢🔵, ⏸, ⚑, ★ deliberately NOT wrapped.
Verified in browser (hover sway, appear wave, reduce motion). Related: [[helpdesk-design]], [[live-updates]].
