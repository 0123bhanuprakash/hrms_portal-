# Part 2: Architecture

## 2.1 Big picture
```
Browser (Next.js app, React Query, Socket.IO client)
   |  HTTPS REST (JSON) + one WebSocket per tab
   v
NestJS API (:4000)
   Guards (throttle, JWT, password-change, maintenance, permission, super-admin, re-auth)
   Controllers -> Services -> Prisma ORM -> PostgreSQL (schema "hrms")
   Side systems: Socket.IO gateway (live), BullMQ queue (only if REDIS_URL set), email (Nodemailer / Resend), file storage (local disk or S3/MinIO)
```
- **Monorepo (pnpm + Turborepo):** `apps/api`, `apps/web`, shared packages (`@hrms/types`, `@hrms/config`).
- Two apps, one repo. Types shared between them, so the frontend and backend agree on data shapes.

## 2.2 Life of one request (example: employee applies for leave)
1. The employee fills the apply dialog (React Hook Form + Zod validation in the browser).
2. Axios sends `POST /leave/...` with `Authorization: Bearer <access token>`. If the token expired (15 min), the Axios interceptor calls `/auth/refresh` once, queues other calls, then retries.
3. On the API, middleware decodes the token to attach the tenant (company) context.
4. Global guards run in order: rate limit, JWT check, forced-password-change check, maintenance mode, permission check (`@RequirePermission`), Super Admin check, re-authentication for risky actions.
5. A DTO (class-validator) checks the body. Invalid input returns a 400 with the field errors.
6. The service applies the business rules (balance, eligibility, overlaps, approver routing) and writes with Prisma, inside a transaction where several rows change.
7. A notification is created (in-app, plus email), fire-and-forget.
8. The live interceptor sends "something changed" to the approvers' socket rooms.
9. The approver's open screen reloads through the normal API.
10. The audit interceptor records `@Audit()` actions (who, what, before/after, IP, request id).

## 2.3 Multi-tenancy (companies kept apart)
- One database, one set of tables. Almost every business row has a `companyId`.
- The token carries the company. Services filter every query by it. Super Admin has `companyId = null` and uses separate `@SuperAdminOnly()` routes.
- **Why shared tables, not a database per company:** simpler to run, migrate and back up, cheaper, good enough for many small and mid-size companies.
- **Trade-off:** a missing `companyId` filter in one query would leak data, because isolation is enforced in code. Mitigations: e2e tests create separate companies; the code comments mention PostgreSQL row-level security (RLS) as a further layer. Verify whether RLS is actually switched on before claiming it in the demo.

## 2.4 Roles, permissions and reach
- Catalog of permissions in `modules/access/catalog.ts` (example: `leave.extra_decide`, `project.pmo_lead`).
- A role is a set of permissions; each can have a **reach**: own, team, company.
- Company Admin can make custom roles; plans and per-company feature toggles can switch whole modules off (`@RequireFeature`).
- An "explain" endpoint tells why someone can or cannot do something (useful for support).
- Access is cached and refreshed by version numbers (`featuresVersion`, `hierarchyVersion`) bumped on any change.
- **Delegation:** an approver can hand approvals to a cover for a date range.

## 2.5 Approval routing
Approvers come from reporting lines and project roles (project lead approves timesheets and project leave; HR approves expenses; PMO pool for people reporting to PMO). Resource requests move Lead, PM, Delivery Director, PMO.

## 2.6 Live updates
Socket.IO, one connection per tab, rooms like `u:<user>`, `q:<company>:<queue>`, `t:<ticket>`. Messages only say "changed" plus ids, so permission logic stays in the REST API. Full list: `docs/realtime.md`.

## 2.7 Background work and email
BullMQ queue runs only when `REDIS_URL` is set. Without Redis, emails are sent inline. This keeps local development simple (no Docker), at the cost of no retries or scheduled jobs in that mode. The app also has timers for things like the minute-by-minute delegation check and internship reminders.

## 2.8 Storage
`STORAGE_DRIVER=local` serves files from `/uploads` with safe headers (`nosniff`, sandboxed CSP so an uploaded SVG cannot run scripts). The other driver is MinIO/S3 (AWS SDK, presigned URLs).

## 2.9 Key decisions and trade-offs
| Decision | Chosen | Alternative | Why / trade-off |
|---|---|---|---|
| Architecture | Modular monolith | Microservices | One deploy, simple transactions; harder to scale parts separately |
| API style | REST + Swagger | GraphQL | Simple, cacheable, easy to guard per route; some over-fetching (audit item) |
| Tenancy | Shared DB, `companyId` | DB per company | Cheaper and simpler; isolation relies on code and tests |
| Live data | WebSocket "changed" signals | Polling; send full data | Instant, permissions in one place; needs a connection per tab |
| Files | Local disk first | Cloud from day one | No setup for dev; S3 driver ready for production |
| Queue | Optional BullMQ | Always-on queue | No Docker needed locally; fewer guarantees without Redis |
| Rate limit | In-memory throttler | Redis-backed | Fine for one server; per-server counts if scaled out |
| Sessions | Access token (15 min) + rotating refresh token (7 days) | Server sessions | Stateless API; refresh reuse detection and device list |

## 2.10 Likely questions
1. *Why a monolith?* Small team, many modules sharing data (leave touches attendance, projects, notifications); a monolith keeps transactions simple. Modules are separate so it can be split later.
2. *How do you stop one company seeing another's data?* `companyId` from the token on every query, e2e tests with separate companies; further hardening: RLS.
3. *What happens if the WebSocket drops?* Screens still work through REST; the client reconnects and refreshes.
4. *How would it scale?* Add Redis for the throttler, queue and Socket.IO adapter, run several API instances behind a load balancer (`TRUST_PROXY`), move files to S3.
5. *Why Prisma?* Typed queries from the schema, migrations, fewer SQL mistakes; trade-off: complex reports may need raw SQL, and the Prisma engine adds startup weight.
