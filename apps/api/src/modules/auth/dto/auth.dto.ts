import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

// ============================================================
// Auth DTOs — request/response shapes for auth endpoints
// ============================================================

export class LoginDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(1, { message: 'Password is required' })
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'The refresh token returned from /auth/login' })
  @IsString()
  refresh_token!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: '32-byte hex token from reset email' })
  @IsString()
  token!: string;

  @ApiProperty({ example: 'NewPassword123!' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password!: string;
}

// ─────────────────────────────────────────────────────────────
// Response shapes
// ─────────────────────────────────────────────────────────────

export class AuthUserResponse {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty() isSuperAdmin!: boolean;
  @ApiProperty({ nullable: true }) companyId!: string | null;
  @ApiProperty({ type: [String] }) roles!: string[];
  @ApiProperty({ type: [String] }) permissions!: string[];
}

export class LoginResponse {
  @ApiProperty() access_token!: string;
  @ApiProperty() refresh_token!: string;
  @ApiProperty() expires_in!: number;
  @ApiProperty({ type: AuthUserResponse }) user!: AuthUserResponse;
}

export class RefreshResponse {
  @ApiProperty() access_token!: string;
  @ApiProperty() refresh_token!: string;
  @ApiProperty() expires_in!: number;
}
