# Contributing

## The rule

**Every change keeps all checks green, and every new feature or bug fix comes with a test.**

| When | What runs | How long |
|---|---|---|
| Before you say "done" | `pnpm verify` — type-check, lint, unit tests, API build, **all** end-to-end suites | ~10 min |
| On every `git push` (automatic) | `pnpm verify:fast` — type-check, lint, unit tests | ~1 min (seconds when nothing changed) |

There is no CI on GitHub (the GitHub Actions workflow was removed), so `pnpm verify` before merging to `main` is what keeps it green.

## Setup

```bash
pnpm install          # also turns on the pre-push hook (git config core.hooksPath .githooks)
pnpm db:setup         # first time: migrations + seed (apps/api/.env must point at your PostgreSQL — see README)
pnpm dev
```

`pnpm verify` needs the local database (the suites create throwaway companies and delete them afterwards). It builds the API into `apps/api/dist`, so stop `pnpm dev` first if you see file-lock errors on Windows.

## Which test to write

| You changed… | Add or extend… | Where |
|---|---|---|
| An API endpoint, a rule, a permission, a notification | an end-to-end check | `apps/api/test/e2e/<feature>.e2e.js` (see `lib.js`: `makeCompany`, `call`, `check`, `dropCompany`) |
| A pure function (dates, money, routing, parsing) | a unit test | next to it: `src/**/<name>.spec.ts` (Vitest) |
| A new feature area | a new suite `apps/api/test/e2e/<area>.e2e.js` — the runner picks it up automatically | |
| A bug | a check that fails before your fix and passes after | |

Run one suite while working: `pnpm --filter @hrms/api test:e2e timesheets`.

### End-to-end rules

- Never trigger notifications on the dev API (port 4000) — it may send real email. The runner starts its own API on port 4001 with console email.
- Each suite creates its own company (`makeCompany`) and removes it in `finally` (`dropCompany`).
- Test what users can **not** do too (403 / 404 for the wrong role or scope), not only the happy path.
- Lists must filter and paginate in the database, with indexes.

## Speed

Measure before optimising: `apps/api/test/perf/README.md` (benchmark company, per-endpoint timings, load test, `DB_TRACE=true` for queries per request).

## Escape hatch

`git push --no-verify` skips the local hook — for emergencies only; run `pnpm verify` afterwards, since nothing else checks the push.
