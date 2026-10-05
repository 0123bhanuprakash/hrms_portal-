---
name: two-step-sign-in-later
description: Two-step sign-in (authenticator app + recovery codes) for Super Admins is deferred — planned for later
metadata:
  node_type: memory
  type: project
  originSessionId: 8f157ff8-1021-4d62-8dd5-6a68f5d6e363
  modified: 2026-10-04T14:47:48.992Z
---

Two-step sign-in (TOTP authenticator app, QR setup, 6-digit code at platform sign-in, 8 recovery codes) was designed in the Profile & security screens (canvas board SAProfileSecurity) but the user said on 2026-10-04 to leave it for the future. Everything else on Profile & security was approved to build.

**Why:** user wants the rest first; 2FA is a bigger change to the sign-in flow.
**How to apply:** don't build 2FA until asked; when it comes up, the open question is whether it's mandatory for all Super Admins or optional. Related: [[roadmap-decisions]]
