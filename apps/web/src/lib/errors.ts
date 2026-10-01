import { isAxiosError } from 'axios';

// ============================================================
// API error → user-facing message
//
// The API returns RFC 7807 Problem Details:
//   { title, status, detail, errors?: { field: string[] } }
// Validation failures put a generic sentence in `detail` and the
// useful text in `errors`, so those are preferred when present.
// ============================================================

interface ProblemDetails {
  title?: string;
  detail?: string;
  message?: string | string[];
  errors?: Record<string, string[]>;
}

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!isAxiosError<ProblemDetails>(error)) {
    return fallback;
  }

  if (!error.response) {
    return 'Cannot reach the server. Check that the API is running and try again.';
  }

  const body = error.response.data;
  if (!body || typeof body !== 'object') {
    return fallback;
  }

  const fieldErrors = body.errors ? Object.values(body.errors).flat() : [];
  if (fieldErrors.length > 0) {
    return fieldErrors.join(' ');
  }

  if (body.detail) return body.detail;
  if (Array.isArray(body.message)) return body.message.join(' ');
  if (body.message) return body.message;

  return fallback;
}
