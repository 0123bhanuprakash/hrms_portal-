import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

// ============================================================
// AuthModule — Authentication feature module
//
// Provides:
//   - AuthService       (login / refresh / logout / me)
//   - AuthController    (POST /auth/login, POST /auth/refresh,
//                        POST /auth/logout, GET /auth/me)
//   - JwtStrategy       (passport strategy — validates Bearer tokens)
//   - JwtModule         (signs + verifies JWTs)
//   - PassportModule    (passport integration)
//
// PrismaModule is @Global() so PrismaService is available here
// without explicit import.
// ============================================================

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        // Note: expiresIn is set per-call in AuthService.issueTokens()
        // so we don't set it globally here.
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
