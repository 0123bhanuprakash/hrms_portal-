# HRMS Portal

A full-featured, multi-tenant Human Resource Management System built as a production-grade SaaS platform.

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | Turborepo + pnpm workspaces |
| Frontend | Next.js 14+ (App Router) + TypeScript |
| UI | Tailwind CSS |
| Backend | NestJS + TypeScript |
| ORM | Prisma |
| Database | PostgreSQL (local, or hosted on [Supabase](https://supabase.com)) |
| Queue | BullMQ + Redis *(optional)* |
| Search | Elasticsearch *(optional, Phase 2+)* |
| Storage | Local disk, or MinIO / S3 *(optional)* |
| Checks | Git pre-push hook (`pnpm verify:fast`) + `pnpm verify` locally — see [CONTRIBUTING.md](CONTRIBUTING.md) |

No containers are needed for local development — only Node.js, pnpm and a PostgreSQL database.

## Prerequisites

- Node.js 20+
- pnpm 11+ (`npm install -g pnpm`)
- Git
- PostgreSQL — installed locally (recommended, fastest), or a free [Supabase](https://supabase.com) project

## Local Setup

### 1. Create the database

Install PostgreSQL and create an empty database called `hrms`:

```sql
CREATE DATABASE hrms;
```

Using Supabase instead? Skip this step — see the Supabase URLs in step 4.

### 2. Clone the repo

```bash
git clone <repo-url>
cd hrms_portal
```

### 3. Install dependencies

```bash
pnpm install
```

This also generates the Prisma database client (`apps/api` runs `prisma generate` after install). Run it again with `pnpm --filter @hrms/api db:generate` after changing `schema.prisma`, with the API stopped (Windows locks the engine file while it runs).

### 4. Configure environment variables

The env files are never committed. If a teammate sent you theirs, put them at `apps/api/.env` and `apps/web/.env.local`, change the database password in `DATABASE_URL` / `DIRECT_URL` if yours differs, and go to step 5.

Otherwise, copy the templates:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

In `apps/api/.env`, set:

- `DATABASE_URL` and `DIRECT_URL` — URL-encode special characters in the password (`@` → `%40`, `!` → `%21`) and keep `?schema=hrms`.
  - **Local PostgreSQL:** both are `postgresql://postgres:<password>@localhost:5432/hrms?schema=hrms`
  - **Supabase** (dashboard → **Connect**): `DATABASE_URL` = **Transaction pooler** (port 6543, keep `&pgbouncer=true&connection_limit=10`); `DIRECT_URL` = **Session pooler** (port 5432). Don't use the session pooler for `DATABASE_URL` — it allows only ~15 clients and requests fail with `EMAXCONNSESSION`.
- `JWT_SECRET`, `JWT_REFRESH_SECRET` — two different random strings:
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `PII_ENCRYPTION_KEY` — **required**, the API won't start without it:
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
  Keep it safe: data encrypted with one key can't be read with another, so anyone sharing or restoring your database needs the same key.
- `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` — the platform admin account created by the seed.

Everything else works with the defaults.

### 5. Set up the database (first time only)

```bash
pnpm db:setup
```

This applies all Prisma migrations (schema `hrms`) and seeds permissions, default roles and the Super Admin. It creates **empty tables** — it does not copy anyone's existing data.

Optional — fill a company with demo data (~12 people with reporting lines, departments, two projects, 30 days of attendance, announcements):

1. Start the API once (`pnpm dev`) so the default roles exist, sign in as Super Admin and create a company — note its slug (e.g. `acme-portal`).
2. From `apps/api`, run it with a password for the demo accounts and the slug:

```bash
DEMO_PASSWORD='choose-a-password' node prisma/seed-demo.cjs acme-portal
```

The accounts are `<first>.<slug prefix>@yopmail.com` (e.g. `ravi.acme@yopmail.com`), all with `DEMO_PASSWORD`. Safe to run twice. (PowerShell: `$env:DEMO_PASSWORD='…'; node prisma/seed-demo.cjs acme-portal`.)

To copy real data from another machine instead, restore a dump into the empty `hrms` database and **skip `db:setup`** (the dump already has the tables):

```bash
pg_dump -U postgres -d hrms -n hrms -F c -f hrms_backup.dump   # on the source machine
pg_restore -U postgres -d hrms hrms_backup.dump                 # on the new machine
```

### 6. Start the apps

```bash
pnpm dev
```

| App | URL |
|---|---|
| Frontend (Next.js) | `http://localhost:3000` |
| Backend API (base URL) | `http://localhost:4000/api/v1` |
| API Docs (Swagger) | `http://localhost:4000/api/docs` |
| Health check | `http://localhost:4000/health/ready` |

Log in at `http://localhost:3000/login` with the `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` from `apps/api/.env`.

### 7. Postman collection (optional)

With `pnpm dev` running, regenerate the collection in `docs/postman/`:

```bash
pnpm --filter @hrms/api postman             # build from the running API
pnpm --filter @hrms/api postman --capture   # also save real example responses from your database
```

`--capture` signs in with the Super Admin from `apps/api/.env`, so run `db:setup` first.

## How local development works without extra services

| Feature | Default (no setup) | Optional upgrade |
|---|---|---|
| Email | `EMAIL_PROVIDER=console` — printed in the API terminal (with links) and saved as `.html` in `apps/api/.mail/` | `smtp` (any SMTP server) or `resend` |
| Background jobs | Emails are sent inline | Set `REDIS_URL` → BullMQ queue with retries + Bull Board at `/api/v1/admin/queues` |
| File uploads | `STORAGE_DRIVER=local` — saved in `apps/api/uploads/`, served at `http://localhost:4000/uploads` | `STORAGE_DRIVER=s3` with `MINIO_*` vars (MinIO, AWS S3, Supabase Storage) |
| Search | Not used yet | Set `ELASTICSEARCH_URL` (Phase 2+) |

`/health/ready` reports optional services as `disabled` when they are not configured.

## Database scripts

```bash
pnpm db:setup     # Apply migrations + seed (fresh database)
pnpm db:migrate   # Create & apply a new migration after editing schema.prisma
pnpm db:seed      # Re-run the seed (idempotent)
pnpm db:studio    # Browse data in Prisma Studio
```

## Project Structure

```
hrms-portal/
├── apps/
│   ├── web/          ← Next.js Frontend
│   └── api/          ← NestJS Backend (Prisma schema + migrations in apps/api/prisma)
├── packages/
│   ├── types/        ← Shared TypeScript types & Zod schemas
│   └── config/       ← Shared ESLint configs
├── turbo.json
└── pnpm-workspace.yaml
```

## Available Scripts

```bash
pnpm dev          # Start all apps in development mode
pnpm build        # Build all apps
pnpm lint         # Lint all apps
pnpm lint:fix     # Auto-fix lint errors
pnpm typecheck    # TypeScript type-check all apps
pnpm test         # Run all unit tests
pnpm format       # Format all files with Prettier
```

## Architecture Highlights

- **Multi-tenancy**: Shared schema with `company_id` on every table + PostgreSQL RLS
- **RBAC**: `resource:action` permission model with Redis caching
- **Auth**: JWT access tokens (15min) + refresh token rotation with reuse detection
- **Audit**: WHO/WHAT/WHEN/WHERE/BEFORE/AFTER on all sensitive actions
- **Import**: 8-stage secure pipeline with strict tenant isolation
- **India Payroll**: PF, PT (state-wise), TDS, ESI with configurable slabs

