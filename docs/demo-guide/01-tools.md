# Part 1: Technical Stack and Tools

Each entry: What it is · Why an HRMS needs it · Where it is used · Alternatives · Pros / cons · Interview answer.
Versions come from `package.json` (checked 2026-10-10).

## 1.1 Monorepo: pnpm 11 + Turborepo 2
- **What:** one repository holding the API, the web app and shared packages. pnpm installs packages once and links them; Turborepo runs tasks (`dev`, `build`, `typecheck`, `lint`, `test`) across them in the right order and caches results.
- **Why needed:** the frontend and backend share types (`@hrms/types`), so a change in a data shape breaks the build in both places instead of failing at run time.
- **Used:** root `package.json` scripts, `turbo.json`, `apps/api`, `apps/web`.
- **Alternatives:** separate repos (type drift, two pull requests per change); Nx (heavier).
- **Pros / cons:** faster builds through caching, one command to run everything; slightly more setup, and the Windows/Turbopack dev quirks noted in the handoff.
- **Say:** "One repo with shared types means the API and UI can't silently disagree."

## 1.2 TypeScript 5
- **What:** JavaScript with types. **Why:** catches wrong field names and missing checks before the code runs, essential in a 100-table system. **Alternative:** plain JavaScript (faster to start, many more run-time bugs). **Con:** build step, stricter code.

## 1.3 Node.js 22 (runtime)
- **What:** runs the API and the Next.js server. **Why:** same language front and back, large ecosystem. **Alternatives:** Java/Spring, .NET (stronger for huge enterprises, slower to build with a small team).

## 1.4 Backend: NestJS 10
- **What:** a structured Node framework built on Express. Code is split into modules, controllers (routes), services (business rules) and guards.
- **Why needed:** an HRMS has 30+ modules and strict access rules. Nest gives a standard place for each thing, dependency injection, and global guards so **every route is protected by default** (`APP_GUARD` in `app.module.ts`).
- **Used:** `apps/api/src/modules/*` (33 modules), `main.ts` (helmet, compression, CORS, validation pipe, Swagger).
- **Alternatives:** plain Express (fast but no structure, easy to forget a check); Fastify; Spring Boot.
- **Pros:** consistent structure, decorators like `@RequirePermission`, `@Audit`, `@Throttle`, built-in testing. **Cons:** more boilerplate, a learning curve, decorators hide some behaviour.
- **Say:** "Nest lets me enforce security once, globally, instead of remembering it per route."

## 1.5 Database: PostgreSQL + Prisma 5
- **PostgreSQL:** relational database. **Why:** HR data is highly related (employee, manager, department, leave, approvals) and needs transactions and constraints (leave balances must never be half-updated). It also supports JSON columns and UUID generation (`gen_random_uuid()`). **Alternatives:** MySQL (similar), MongoDB (weak for relations and transactions).
- **Prisma:** ORM. The schema file (`prisma/schema.prisma`, 103 models) generates a typed client; migrations are SQL files in `prisma/migrations` (56). **Why:** type-safe queries, readable schema, safe migrations. **Alternatives:** TypeORM, Sequelize, raw SQL. **Cons:** very complex reports may need raw SQL; `prisma generate` locks a DLL on Windows while the API runs.
- **Example:** `Company -> Employee -> User` linked by ids; `RefreshToken` stores a hashed token with a `familyId` for reuse detection.
- **Say:** "Relational data, so a relational database; Prisma keeps queries typed and migrations reviewable."

## 1.6 Frontend: Next.js 14 (App Router) + React 18
- **What:** React framework with file-based routes (`apps/web/src/app/(app)`, `(auth)`, `(super-admin)`). Route groups separate the company portal, sign-in pages and the Super Admin console.
- **Why:** structured routing, layouts shared across pages, fast navigation, production build and optimisation. Dev server runs with `--turbo`.
- **Alternatives:** plain React + Vite (no routing/SSR), Angular (heavier), Vue/Nuxt.
- **Cons:** the App Router has a learning curve; the Turbopack dev cache sometimes goes stale.

## 1.7 Data fetching and state: TanStack React Query, Axios, Zustand
- **React Query:** caches server data, refetches, shows loading and error states. We use `isLoadingError` so a failed background refresh keeps the old numbers on screen. **Alternative:** Redux (more code for server data).
- **Axios:** HTTP client with interceptors: adds the token, and on a 401 refreshes once and replays queued requests (`lib/api.ts`). **Alternative:** fetch.
- **Zustand:** small store for the auth state (access token). **Alternative:** Redux, Context.

## 1.8 Forms and validation: React Hook Form, Zod (web); class-validator / class-transformer (API)
- **Why:** HR forms are large (onboarding wizard). The browser validates for quick feedback; **the server validates again**, because the browser can't be trusted. DTO classes on the API reject bad input with field-level errors.

## 1.9 UI: Tailwind CSS 3, Radix UI, shadcn-style components, Lucide icons, cmdk, Sonner, next-themes, Recharts, Lottie
- **Tailwind:** utility CSS with HSL CSS variables, which makes company branding and seasonal themes possible without rebuilding.
- **Radix:** accessible unstyled primitives (dialog, select, tabs, tooltip) with keyboard support. **Why:** accessibility without writing it ourselves.
- **Recharts:** dashboards and reports. **Lottie / emoji motion:** celebrations and kudos animations. **Sonner:** toasts. **cmdk:** command search.
- **Alternatives:** Material UI / Ant Design (faster start, harder to make a custom look).

## 1.10 Authentication: JWT + refresh-token rotation, Passport, bcrypt
- **Flow:** sign-in returns an access token (15 minutes) and a refresh token (7 days). The refresh token is stored **hashed** (`RefreshToken.tokenHash`) in a family; using an old token again (reuse) revokes the whole family, which is the stolen-token alarm. Users can see and end sessions per device.
- **bcrypt (12 rounds):** slow on purpose, resists brute force on a leaked database.
- **Rules:** temporary passwords force a change (`PasswordChangeGuard`); risky actions ask for the password again (`@Risky` + `ReauthGuard`); credential routes are limited to 10 requests/minute per IP.
- **Alternatives:** server sessions with cookies (revocation is simpler, needs shared session storage); OAuth/SSO (planned for enterprise). **Con:** the access token lives in browser memory/state, so cross-site scripting (XSS) matters; two-step sign-in is deferred.

## 1.11 Security middleware: Helmet, CORS, throttler, compression
- **Helmet:** safe HTTP headers. **CORS:** only the listed web origins. **Throttler:** 600 requests/minute per user (about 50 page loads) and 10/minute on sign-in routes; in memory today, so per server. **Compression:** smaller responses.

## 1.12 Live updates: Socket.IO 4
- **What:** WebSocket library with automatic reconnect and rooms. **Why:** approvers and helpdesk agents should see changes instantly (badges, lists, "is typing"). **Design:** messages carry only "changed + ids", the screen re-reads via REST, so permissions are never duplicated. **Alternatives:** polling (wasteful, slow), Server-Sent Events (one-way only), raw WebSocket (no reconnect or rooms). **Con:** one connection per tab; scaling to many servers needs the Redis adapter.

## 1.13 Queue: BullMQ + Redis (ioredis), Bull Board
- **What:** background job queue. **Used for:** emails with retries. **Optional by design:** only active with `REDIS_URL`; otherwise emails are sent inline so developers need no Docker. **Con:** inline mode has no retry. **Bull Board** shows job status.

## 1.14 Email: Nodemailer and Resend
- Templates in `modules/email/templates`; Nodemailer for SMTP (Gmail in dev), Resend as an API provider. Email jobs can be encrypted (`email-job-crypto.ts`) so secrets in links are not left in the queue. Dev rule: never trigger emails on :4000 during tests.

## 1.15 File storage: local disk or S3/MinIO (AWS SDK v3)
- Profile photos, documents, branding. Local driver for development; S3/MinIO with presigned URLs for production. Uploads are served with `nosniff` and a sandbox CSP.

## 1.16 Personal-data encryption: AES-256-GCM (Node `crypto`)
- PAN and bank numbers are encrypted with `PII_ENCRYPTION_KEY` (`pii-crypto.service.ts`). GCM also detects tampering. **Why:** a database leak alone does not reveal the numbers. **Con:** losing the key loses the data; keys must be kept safe and rotated by a plan.

## 1.17 API documentation and health: Swagger (@nestjs/swagger), Terminus
- Swagger lists every endpoint for developers; Terminus gives health checks for monitoring/deploy.

## 1.18 Testing and quality: Vitest, custom e2e runner, ESLint, Prettier, git hooks
- Unit tests with Vitest (e.g. `eligibility.spec.ts`, `year-close.spec.ts`); **36 e2e suites** under `apps/api/test/e2e` run against a throwaway API on :4001 with a console email driver and a fresh test company each (`makeCompany`). The pre-push hook runs `pnpm verify:fast` (typecheck + lint + unit tests). GitHub CI was removed on purpose.

## 1.19 Audit and logging
- `AuditLog` table (who, action, resource, before/after, IP, request id) written by a global interceptor for `@Audit()` actions; request-id and logging interceptors; a global exception filter gives one error shape (`detail`, `errors`).

## 1.20 Tool questions you may get
1. *Why not Firebase/Supabase?* Complex business rules and approval routing need a real backend; full control of data and access.
2. *Why REST, not tRPC/GraphQL?* Simple, documented with Swagger, guards per route.
3. *Is JWT in memory safe?* Not immune to XSS; mitigated by short life, rotation with reuse detection, Helmet/CSP; next step is httpOnly cookies and two-step sign-in. (Verify where the refresh token is stored in `auth` store before answering in detail.)
4. *What happens without Redis?* Emails go inline, rate limits are per server, live updates work on one server only.
5. *How is the schema changed safely?* Prisma migrations, reviewed SQL, `migrate deploy` in production.
