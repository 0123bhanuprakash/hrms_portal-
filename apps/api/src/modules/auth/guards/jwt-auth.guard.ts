import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

// ============================================================
// JwtAuthGuard — Global guard for all routes
//
// Behavior:
//   - All routes are protected by default
//   - Routes decorated with @Public() are skipped
//   - Routes that fail JWT validation get 401
// ============================================================

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check if the route or its controller is decorated with @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true; // Skip JWT check entirely
    }

    // Delegate to passport-jwt for token extraction + validation
    return super.canActivate(context);
  }
}
