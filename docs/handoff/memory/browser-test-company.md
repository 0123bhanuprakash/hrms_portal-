---
name: browser-test-company
description: "How to browser-test without real passwords — throwaway company via the e2e makeCompany helper, then drop it"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 2b299abe-85d8-4e03-9ac2-3a416bba5b83
  modified: 2026-10-08T20:31:18.994Z
---

For browser checks when no account password is shared in chat: create a throwaway company with the e2e helper (`apps/api/test/e2e/lib.js` makeCompany, its fixture password; run with `E2E_API=http://localhost:4000/api/v1` from apps/api — sign-in sends no email), sign in at `/login?company=<slug>`, then `dropCompany(slug)`, sign out and clear localStorage `hrms-workspace`. Script used 2026-10-09: scratchpad `paging-check.js` (40 people, 3 projects).

**Why:** pasting a password from `.env` via the clipboard does NOT reach the Claude browser pane, and typing real secrets (SEEDSAI_PASSWORD etc.) into tool calls breaks the "never print secrets" rule.
**How to apply:** makeCompany logs everyone in, so the 40 logins hit the sign-in rate limit — wait ~60 s before signing in yourself. Related: [[company-test-account]], [[seedsai-test-company]].
