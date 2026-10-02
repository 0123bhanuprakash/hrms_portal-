import { SetMetadata } from '@nestjs/common';

export const ALLOW_PENDING_PASSWORD_KEY = 'allowPendingPasswordChange';

/**
 * Lets a user who still has a temporary password call this route
 * (e.g. /auth/me, /auth/change-password, /auth/logout). Every other
 * authenticated route answers 403 PASSWORD_CHANGE_REQUIRED until they
 * choose their own password.
 */
export const AllowPendingPasswordChange = () => SetMetadata(ALLOW_PENDING_PASSWORD_KEY, true);
