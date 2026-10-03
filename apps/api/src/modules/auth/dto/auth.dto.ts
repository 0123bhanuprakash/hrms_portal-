import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Same rules as the web forms (@hrms/types strongPassword). */
function IsStrongPassword(): PropertyDecorator {
  return (target, key) => {
    MinLength(8, { message: 'Password must be at least 8 characters' })(target, key);
    MaxLength(128, { message: 'Password is too long' })(target, key);
    Matches(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })(target, key);
    Matches(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })(target, key);
    Matches(/[0-9]/, { message: 'Password must contain at least one number' })(target, key);
    Matches(/[^A-Za-z0-9]/, { message: 'Password must contain at least one special character' })(target, key);
  };
}

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

  @ApiProperty({
    required: false,
    enum: ['platform', 'company'],
    description: 'Sign-in page used. platform = Super Admins only; company = company users only.',
  })
  @IsOptional()
  @IsIn(['platform', 'company'])
  portal?: 'platform' | 'company';

  @ApiProperty({ required: false, example: 'acme', description: 'Company workspace (company portal only)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9-]+$/, { message: 'Invalid workspace' })
  companySlug?: string;
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
  @IsStrongPassword()
  password!: string;
}

export class VerifyEmailDto {
  @ApiProperty({ description: 'Token from the verification email' })
  @IsString()
  @MaxLength(200)
  token!: string;
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
  @ApiProperty({ description: 'Signed in with a temporary password: must set a new one first' })
  mustChangePassword!: boolean;
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

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  current_password!: string;

  @ApiProperty({ example: 'NewPassword123!' })
  @IsString()
  @IsStrongPassword()
  new_password!: string;
}
