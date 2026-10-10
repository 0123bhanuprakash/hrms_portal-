---
name: postman-collection
description: "Postman collection for the whole API is GENERATED (docs/postman) by apps/api/scripts/postman/build-postman.mjs — regenerate, don't hand-edit"
metadata:
  node_type: memory
  type: project
  originSessionId: 50a06222-abca-43c0-8ca3-f06f174dc141
  modified: 2026-10-10T23:11:46.880Z
---

Built 2026-10-11, committed ed03100: `pnpm --filter @hrms/api postman` (add `-- --capture` to refresh real example responses from SeedsAI + Super Admin) writes docs/postman/HRMS.postman_collection.json + 2 environments + README. 506 requests / 39 folders; reads live /api/docs-json + controller AST (permissions, features, uploads, inline @Query) + enum values from schema.prisma. Auto-login pre-request script uses env email/password.

Same session: Swagger fixes in apps/api — bearer scheme renamed to `bearer` + global security requirement (main.ts), nest-cli.json swagger plugin now also reads `dto.ts` files (was missing query/body docs for 15 modules).

**Why:** user wants to hand the API to another developer without manual request setup.
**How to apply:** after API changes, re-run the generator; known API bug spun off as a task: GET /companies?status=bogus → 500 (inline unvalidated @Query).
