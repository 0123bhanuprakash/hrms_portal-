import { ForbiddenException } from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';

// ============================================================
// Refresh token cookie
//
// The refresh token never reaches page scripts: it lives in an httpOnly
// cookie scoped to /api/v1/auth, so only sign-in, refresh and sign-out
// ever send it. The access token stays in the web app's memory.
//
//   AUTH_COOKIE_SECURE    true in production (default: NODE_ENV=production)
//   AUTH_COOKIE_SAMESITE  lax (default) | strict | none (none needs Secure;
//                         only when the web app and API are on different sites)
// ============================================================

export const REFRESH_COOKIE = 'hrms_rt';
const COOKIE_PATH = '/api/v1/auth';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Header every cookie-using auth call must carry (see assertCsrfHeader). */
export const CSRF_HEADER = 'x-hrms-csrf';

function options(): CookieOptions {
  const sameSite = (process.env['AUTH_COOKIE_SAMESITE'] ?? 'lax').toLowerCase() as 'lax' | 'strict' | 'none';
  const secure = process.env['AUTH_COOKIE_SECURE'] ? process.env['AUTH_COOKIE_SECURE'] === 'true' : process.env['NODE_ENV'] === 'production';
  return { httpOnly: true, secure: secure || sameSite === 'none', sameSite, path: COOKIE_PATH };
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, { ...options(), maxAge: REFRESH_TOKEN_TTL_MS });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, options());
}

/** The refresh token from the request's cookies (no cookie-parser needed for one value). */
export function readRefreshCookie(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0 || part.slice(0, i).trim() !== REFRESH_COOKIE) continue;
    try {
      const value = decodeURIComponent(part.slice(i + 1).trim());
      return /^[0-9a-f]{64}$/.test(value) ? value : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Cookies go along automatically, so another site could try to trigger
 * refresh / sign-out (CSRF). A custom header can't be sent cross-site without
 * passing CORS, which only allows our own web origins — and SameSite stops the
 * cookie as well. Two walls.
 */
export function assertCsrfHeader(req: Request): void {
  if (req.headers[CSRF_HEADER] !== '1') throw new ForbiddenException('Missing request header');
}
