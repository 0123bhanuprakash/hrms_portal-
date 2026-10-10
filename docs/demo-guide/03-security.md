# Part 3: Security

## 3.1 Verified facts (checked in code, 2026-10-10)
| Topic | Finding |
|---|---|
| Row-level security (RLS) | **Not active.** A helper `set_tenant_context()` exists (migration `20261002000000`) and `PrismaService.setTenantContext()` is defined, but no code calls it and no `CREATE POLICY` exists in any migration. Company isolation is done **in application code** (`companyId` in every query) and tested. Do not claim RLS. |
| Token storage | **Refresh token in an httpOnly cookie** (`hrms_rt`, `SameSite=Lax`, path `/api/v1/auth`, `refresh-cookie.ts`) — page scripts can't read it. The access token is kept **in memory only**. localStorage (`hrms-auth-storage`) holds only a display hint (id, name, photo) and a "signed in before" flag (changed 2026-10-10). |
| Who the browser thinks you are | Never read from storage: on every page load the web app turns the cookie into an access token and asks `/auth/me`; roles, Super Admin, company and the temporary-password flag come only from that answer. Editing localStorage in DevTools changes nothing (tested). |
| Access token | 15 minutes. Refresh token 7 days, rotated on every refresh, stored hashed in the DB with a family id. |
| Password hashing | bcrypt, 12 rounds. |
| PII encryption | PAN and bank account numbers: AES-256-GCM, key `PII_ENCRYPTION_KEY`. Viewing the full value goes through an audited "reveal" call. |
| Input validation | Global ValidationPipe: `whitelist: true` and `forbidNonWhitelisted: true` (unknown fields are rejected). |
| Rate limits | 600/min per user (in memory); 10/min per IP on sign-in and similar credential routes. |
| Headers | Helmet; CORS limited to `CORS_ORIGINS`; uploads served with `nosniff` and a sandbox CSP. |

## 3.2 Layers of defence (explain in this order)
1. **Sign-in:** email + password + company. Failed attempts are recorded (`SignInAttempt`). Temporary passwords force a change before anything else works (`PasswordChangeGuard`).
2. **Session:** short access token (memory only); refresh token in an httpOnly cookie, refresh/sign-out need the `X-HRMS-CSRF` header; refresh rotation with **reuse detection** (an old refresh token used again revokes the whole family and closes that person's tabs live). "Active sessions" lists devices; sign out one or all.
3. **Authorisation:** every route is protected by default (global `JwtAuthGuard`). `@RequirePermission('x')` checks the permission and its reach (own, team, company). `@RequireFeature` checks the company's plan. `@SuperAdminOnly` guards the platform console.
4. **Risky actions:** `@Risky` + `ReauthGuard` ask the user to confirm their password again.
5. **Data minimising in responses:** for example, employees on notice show as Active to ordinary viewers; wish counts are visible only to the celebrant; employees never see leave rules.
6. **Audit:** `AuditLog` stores who, action, resource, before/after state, IP, request id. Sensitive values are redacted in the log.
7. **Maintenance mode:** a switch that pauses company users while Super Admins keep working.
8. **Live access changes:** when a role changes or a user is switched off, their sockets are recalculated or closed immediately.

## 3.3 Known gaps (be honest, then show the plan)
| Gap | Plan |
|---|---|
| RLS not enabled | Add policies using the existing helper as a second wall behind the code checks |
| No two-step sign-in | Designed, deferred (memory note: mandatory vs optional to be decided) |
| In-memory rate limit | Redis-backed throttler when scaled to several servers |
| API/access audit not done | Planned: per-role network calls, routes without `@RequirePermission`, unbounded list queries |
| Local-disk file storage | Use S3/MinIO driver in production |
| One shared session across tabs | Open decision: per-tab session vs shared |

## 3.4 Edge cases and potential issues
- A missing `companyId` filter in a new query would leak data. Mitigation: e2e tests that create two companies, code review, and (future) RLS.
- Tokens are no longer in localStorage. An injected script could still call the API *while the page is open* (that is XSS itself — React escaping and CSP are the defence), but it can't copy the refresh token to use elsewhere. Reuse detection catches a stolen refresh token used alongside the owner.
- Two tabs refreshing at once would send an already-rotated cookie and trip reuse detection; the web app serialises refreshes across tabs (Web Locks).
- Changing a role does not wait for token expiry because permissions are loaded server-side per request (cached with version numbers), not stored in the token.
- Brute force: per-IP limit of 10/minute on credential routes. Behind a proxy, `TRUST_PROXY` must be set or every user shares one IP.
- File uploads: size and type checks plus safe serving headers; an uploaded SVG cannot run script.
- Dev rule: never put secrets in chat or the repo; `.env` is not committed.

## 3.5 Likely questions and model answers
1. **How do you protect against SQL injection?** Prisma uses parameterised queries; no string-built SQL in normal paths.
2. **XSS?** React escapes output; Helmet/CSP headers; the refresh token is in an httpOnly cookie and the access token only in memory, so a script can't steal a long-lived token. Next step: a stricter Content-Security-Policy.
3. **CSRF?** API calls use a Bearer header (not sent automatically). Only refresh and sign-out use the cookie; those need `SameSite=Lax` **and** a custom `X-HRMS-CSRF` header, which other sites can't send (CORS allows only our web origins).
10. **Can someone edit localStorage / the token in DevTools to become admin?** No: localStorage holds no access data, the portals ask the server on load, and an edited token fails its signature check (401). Tested in `test/e2e/auth-cookie.e2e.js`.
4. **How do you know the data is isolated per company?** `companyId` from the token on every query plus e2e tests with separate companies. I'd add RLS as defence in depth.
5. **What if an admin is fired?** Switch the user off: their sessions are revoked and their open tabs are signed out live.
6. **Who can see salary/PAN/bank details?** Only roles with the specific permission; full values need an audited reveal call.
7. **How are roles enforced on the frontend vs backend?** The menu hides what you can't use, but the backend always re-checks; hiding is only for convenience.
8. **Password reset safety?** Single-use tokens (`PasswordResetToken`), rate-limited, all sessions closed after a reset.
9. **What would you do first to harden it?** (Cookie-based refresh token: done.) RLS, two-step sign-in, a stricter CSP, then the API/access audit.
