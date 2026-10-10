# HRMS Portal — Postman collection

Ready-to-import Postman files for every REST endpoint of the HRMS API (**506 requests in 39 module folders**).

| File | What it is |
|---|---|
| `HRMS.postman_collection.json` | The collection (Postman v2.1) |
| `HRMS.local.company.postman_environment.json` | Environment for a **company user** (defaults to the SeedsAI Company Admin) |
| `HRMS.local.super-admin.postman_environment.json` | Environment for the **Super Admin** (platform portal) |

## Get started (2 minutes)

1. Start the API (`pnpm dev` from the repo root). It listens on `http://localhost:4000`.
2. In Postman: **Import** → drop in all three JSON files.
3. Open the environment you need and fill in the **Current value** column:
   - `email`, `password` — a user of your local database
     (SeedsAI: `<first>.<last>.seedsai@yopmail.com`, password = `SEEDSAI_PASSWORD` in `apps/api/.env`;
     Super Admin: `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` in the same file).
   - `companySlug` — the company workspace (e.g. `seedsai`). Leave empty for the Super Admin.
   - `baseUrl` — change only if the API runs elsewhere.
4. Select the environment (top-right) and send any request.

You don't need to copy tokens. A collection-level pre-request script signs in with the environment's `email`/`password` whenever `accessToken` is missing or about to expire (tokens last 15 min), and stores it. **Authentication → Login with email and password** does the same by hand.

> Keep passwords in **Current value** only — that column is never synced or exported. The environment files in this folder ship with empty passwords.

## How requests are set up

- **Auth** — `Bearer {{accessToken}}` is set once on the collection; public endpoints (login, password reset, health…) are marked *No Auth*.
- **Path parameters** (`:id`, `:employeeId`…) are blank — copy an `id` from a list response into the request's **Params** tab.
- **Query parameters** are all listed, with types and allowed values; optional ones are unticked — tick the ones you want.
- **Bodies** carry a sample payload built from the validation rules (enums, dates, lengths). Ids in bodies are `00000000-0000-0000-0000-000000000000` — replace them with real ones.
- **Uploads** (avatars, documents, receipts, attachments) are `multipart/form-data`; choose the file in the **Body** tab.
- **Descriptions** on each request explain what it does, the **permission** (e.g. `leave.approve`) and **company feature** it needs, every parameter and body field, and the source file + line of the handler.
- **Example responses** — 187 requests carry a saved example: real responses from the local seeded data (trimmed to 2 list items, secrets redacted), or a shape from the schema. Login also shows the 400/401 error shapes.

## API conventions

- Base path `/api/v1` (except `/health`, `/health/ready`).
- Requests are camelCase; responses are snake_case wrapped in `{ "data": …, "meta": { "request_id": … } }`.
- Lists take `page` (1-based) and `limit`.
- Errors are `application/problem+json`: `{ type, title, status, detail, instance }`.
- **Two portals:** `portal: "platform"` signs in Super Admins only; `portal: "company"` (+ `companySlug`) company users only. Another company's ids return **404**, not 403.
- Missing permission → **403**; feature switched off for the company → **403**.
- Live updates use Socket.IO and aren't in this collection — see [`docs/realtime.md`](../realtime.md).
- Swagger UI: `http://localhost:4000/api/docs` (non-production only).

## Folders

| Module | Requests |
|---|---|
| Authentication | 11 |
| Account | 9 |
| Access | 5 |
| Users | 19 |
| Roles | 8 |
| Delegations | 9 |
| Organisation (org chart, levels) | 11 |
| Departments · Designations · Locations | 5 · 5 · 5 |
| Employees | 26 |
| Employee profile · documents · experience reviews | 10 · 4 · 1 |
| People | 5 |
| Attendance | 23 |
| Holidays | 7 |
| Leave | 46 |
| Timesheets | 15 |
| Projects | 21 |
| Resource requests | 20 |
| Expenses | 25 |
| Assets | 45 |
| Helpdesk | 25 |
| Announcements | 20 |
| Kudos | 15 |
| Celebrations | 3 |
| Notifications | 4 |
| Reports | 15 |
| Themes · Seasons | 7 · 6 |
| Companies (Super Admin + branding) | 18 |
| Admin · Plans · System · Platform admins (Super Admin) | 22 · 13 · 16 · 3 |
| Platform · Health · Root | 1 · 2 · 1 |

Big modules are split into sub-folders (e.g. Leave → Requests, Types, Grants, Ledger…).

## Regenerating

The collection is generated — don't edit it by hand; re-run the generator after API changes:

```bash
pnpm --filter @hrms/api postman              # rebuild from the running API (dev mode)
pnpm --filter @hrms/api postman -- --capture # also refresh the example responses
```

The generator ([`apps/api/scripts/postman/build-postman.mjs`](../../apps/api/scripts/postman/build-postman.mjs)) reads the live OpenAPI spec (`/api/docs-json`), the controller source (permissions, features, uploads, comments) and `examples.json`. `--capture` signs in with `SEEDSAI_PASSWORD` and `SUPER_ADMIN_*` from `apps/api/.env`, calls the GET endpoints and saves trimmed, redacted responses.
