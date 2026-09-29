# HRMS Portal

A full-featured, multi-tenant Human Resource Management System built as a production-grade SaaS platform.

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | Turborepo + pnpm workspaces |
| Frontend | Next.js 14+ (App Router) + TypeScript |
| UI | Shadcn/ui + Tailwind CSS |
| Backend | NestJS + TypeScript |
| ORM | Prisma |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Queue | BullMQ |
| Search | Elasticsearch 8 |
| Storage | MinIO (local) |
| Containers | **Podman + podman-compose** |
| CI/CD | GitHub Actions |

## Prerequisites

- Node.js 20+
- pnpm 11+
- [Podman Desktop](https://podman-desktop.io/) (for Windows)
- `podman-compose`: `pip install podman-compose`
- Git

## Local Setup

### 1. Clone & Install Dependencies

```bash
git clone <repo-url> hrms-portal
cd hrms-portal
pnpm install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
# Edit .env with your local values (defaults work for local dev)
```

### 3. Start Infrastructure Services

```bash
# Start PostgreSQL, Redis, Elasticsearch, MinIO, Mailpit
podman-compose up -d

# Verify all services are healthy
podman ps
```

Service URLs (local dev):
| Service | URL |
|---|---|
| PostgreSQL | `postgresql://localhost:5432/hrms_dev` |
| Redis | `redis://localhost:6379` |
| Elasticsearch | `http://localhost:9200` |
| MinIO Console | `http://localhost:9001` |
| Mailpit (Email UI) | `http://localhost:8025` |

### 4. Setup Database

```bash
cd apps/api

# Run migrations
pnpm prisma migrate dev

# Seed initial data (Super Admin + default roles)
pnpm prisma db seed
```

### 5. Start Development Servers

```bash
# From project root — starts both API and Web
pnpm dev
```

| App | URL |
|---|---|
| Frontend (Next.js) | `http://localhost:3000` |
| Backend (NestJS) | `http://localhost:4000` |
| API Docs (Swagger) | `http://localhost:4000/api/docs` |
| Queue Dashboard | `http://localhost:4000/admin/queues` |

### 6. Default Credentials

Super Admin login (local dev):
- Email: `superadmin@hrms.local`
- Password: `SuperAdmin@123`

## Project Structure

```
hrms-portal/
├── apps/
│   ├── web/          ← Next.js Frontend
│   └── api/          ← NestJS Backend
├── packages/
│   ├── types/        ← Shared TypeScript types & Zod schemas
│   └── config/       ← Shared ESLint, TypeScript, Tailwind configs
├── turbo.json
├── pnpm-workspace.yaml
└── podman-compose.yml
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
