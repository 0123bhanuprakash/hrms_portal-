## What and why

<!-- One or two sentences: what changed and the reason. -->

## Checklist

- [ ] `pnpm verify` passes locally (type-check, lint, unit tests, all e2e suites)
- [ ] New behaviour or bug fix is covered by a test (e2e in `apps/api/test/e2e/`, unit in `src/**/*.spec.ts`)
- [ ] Wrong-role / wrong-scope cases are tested (403 / 404), not only the happy path
- [ ] Schema changes come with a migration (`apps/api/prisma/migrations/`)
- [ ] No secrets, `.env` files or real personal data in the diff
- [ ] Lists filter and paginate in the database
