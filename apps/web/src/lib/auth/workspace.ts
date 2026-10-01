import type { AuthUser } from '@/store/useAuthStore';

// Remembers the company workspace (slug) last signed in to, so /login
// can open straight on that company's branded page. No API imports here:
// the API client uses loginPathFor when a session expires.

const WORKSPACE_KEY = 'hrms-workspace';
const SLUG_RE = /^[a-z0-9-]{1,100}$/;

export function normalizeSlug(value: string | null | undefined): string | null {
  const slug = (value ?? '').trim().toLowerCase();
  return SLUG_RE.test(slug) ? slug : null;
}

/** Last company workspace signed in to on this browser. */
export function rememberedWorkspace(): string | null {
  try {
    return normalizeSlug(localStorage.getItem(WORKSPACE_KEY));
  } catch {
    return null;
  }
}

export function rememberWorkspace(slug: string | null): void {
  try {
    if (slug) localStorage.setItem(WORKSPACE_KEY, slug);
    else localStorage.removeItem(WORKSPACE_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Where a signed-out user of this kind should sign in again. */
export function loginPathFor(user: Pick<AuthUser, 'isSuperAdmin'> | null | undefined): string {
  if (user?.isSuperAdmin) return '/platform/login';
  const slug = rememberedWorkspace();
  return slug ? `/login?company=${slug}` : '/login';
}
