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
| Database | PostgreSQL ([Supabase](https://supabase.com)) |
| Queue | BullMQ + Redis *(optional)* |
| Search | Elasticsearch *(optional, Phase 2+)* |
| Storage | Local disk, or MinIO / S3 *(optional)* |
| CI/CD | GitHub Actions |

No containers are needed for local development — only Node.js, pnpm and a Supabase project.

## Prerequisites

- Node.js 20+
- pnpm 11+
- A free [Supabase](https://supabase.com) project (used only as a hosted PostgreSQL database)
- Git

## Local Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

In `apps/api/.env`, set:

- `DATABASE_URL` and `DIRECT_URL` — Supabase dashboard → **Connect** → **Direct** → **Session pooler**.
  Replace `[YOUR-PASSWORD]` (URL-encode special characters, e.g. `@` → `%40`) and keep `?schema=hrms` at the end.
- `JWT_SECRET`, `JWT_REFRESH_SECRET` — random strings of 32+ characters.
- `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` — the platform admin account created by the seed.

Everything else works with the defaults.

### 3. Set up the database (first time only)

```bash
pnpm db:setup
```

This applies all Prisma migrations to Supabase (schema `hrms`) and seeds permissions, default roles and the Super Admin.

### 4. Start the apps

```bash
pnpm dev
```

| App | URL |
|---|---|
| Frontend (Next.js) | `http://localhost:3000` |
| Backend (NestJS) | `http://localhost:4000/api/v1` |
| API Docs (Swagger) | `http://localhost:4000/api/docs` |
| Health check | `http://localhost:4000/health/ready` |

Log in at `http://localhost:3000/login` with the `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` from `apps/api/.env`.

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
│   └── config/       ← Shared ESLint, TypeScript, Tailwind configs
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

## Implementation Progress

See [task.md](/.gemini/antigravity/brain/96fa451d-46af-4ec9-b53e-0168fc51b6b2/task.md) for current Phase 1 progress.
