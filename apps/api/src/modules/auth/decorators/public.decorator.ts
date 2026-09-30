import { SetMetadata } from '@nestjs/common';

// ============================================================
// @Public() decorator — marks a route as publicly accessible
//
// Usage:
//   @Public()
//   @Get('health')
//   liveness() { ... }
//
// The JwtAuthGuard reads IS_PUBLIC_KEY via Reflector and skips
// token validation when this metadata is present.
// ============================================================

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
