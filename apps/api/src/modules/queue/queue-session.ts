// ============================================================
// Bull Board session
//
// Bull Board is a server-rendered UI opened in a new browser tab, so it
// cannot send the SPA's Authorization header. Instead:
//
//   1. The SPA calls POST /api/v1/admin/queues/session (Bearer auth,
//      Super Admin only).
//   2. The API sets a short-lived, httpOnly cookie containing a JWT with
//      audience QUEUE_TOKEN_AUDIENCE, scoped to the Bull Board path.
//   3. BullBoardController accepts only that cookie token.
//
// JwtStrategy rejects tokens with this audience, so a queue token can
// never be used as an API access token (and vice versa).
// ============================================================

export const QUEUE_TOKEN_AUDIENCE = 'hrms-queues';
export const QUEUE_SESSION_COOKIE = 'hrms_queue_session';
export const QUEUE_BASE_PATH = '/api/v1/admin/queues';
export const QUEUE_SESSION_TTL_SECONDS = 15 * 60;

export interface QueueSessionPayload {
  sub: string;
  aud: typeof QUEUE_TOKEN_AUDIENCE;
}

/** Reads a cookie value from the raw Cookie header (no cookie-parser needed). */
export function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}
