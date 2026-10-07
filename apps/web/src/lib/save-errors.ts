import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import type { Mutation } from '@tanstack/react-query';
import { getApiErrorMessage, lastErrorMessageAt } from '@/lib/errors';

// ============================================================
// Failed saves never fail silently
//
// Most saves show their own error (a toast, or an inline message via
// getApiErrorMessage, from onError or try/catch around mutateAsync).
// For the ones that don't, the MutationCache calls
// reportUnhandledSaveError: it waits one tick so the caller's own
// handler runs first, and toasts only if nothing was shown.
// ============================================================

let lastErrorToast = 0;
let watching = false;

/** Notes every error toast, so the fallback knows a save was already reported. */
function watchErrorToasts() {
  if (watching) return;
  watching = true;
  const original = toast.error;
  toast.error = ((...args: Parameters<typeof original>) => {
    lastErrorToast = Date.now();
    return original(...args);
  }) as typeof original;
}

/** Errors the app already deals with elsewhere (sign-in redirect, password prompt, maintenance page). */
function handledGlobally(error: unknown): boolean {
  if (!isAxiosError(error)) return false;
  const status = error.response?.status;
  const code = (error.response?.data as { code?: string } | undefined)?.code;
  return status === 401 || code === 'reauth_required' || code === 'maintenance';
}

export function reportUnhandledSaveError(
  error: unknown,
  mutation: Mutation<unknown, unknown, unknown, unknown>,
) {
  watchErrorToasts();
  // Opted out with meta: { quietErrors: true }, or dealt with elsewhere
  if (mutation.meta?.quietErrors || handledGlobally(error)) return;
  const failedAt = Date.now();
  setTimeout(() => {
    if (lastErrorToast >= failedAt || lastErrorMessageAt() >= failedAt) return;
    toast.error(getApiErrorMessage(error, "Couldn't save your changes. Please try again."));
  }, 0);
}
