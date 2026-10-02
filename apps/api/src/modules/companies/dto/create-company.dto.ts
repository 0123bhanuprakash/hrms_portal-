import {
  IsUUID,
  IsString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  Matches,
  Length,
  IsHexColor,
  IsObject,
} from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens',
  })
  slug!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsOptional()
  @IsString()
  @Length(2, 10)
  employeeIdPrefix?: string;

  // Initial Company Admin details
  @IsEmail()
  @IsNotEmpty()
  adminEmail!: string;

  @IsString()
  @IsNotEmpty()
  adminFirstName!: string;

  @IsString()
  @IsNotEmpty()
  adminLastName!: string;

  // Optional initial branding colors
  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @IsOptional()
  @IsHexColor()
  secondaryColor?: string;

  /** Full theme snapshot (ThemeTokens) — validated strictly by the service */
  @IsOptional()
  @IsObject()
  themeTokens?: Record<string, unknown>;

  /** Library theme the snapshot came from (ThemeRef) */
  @IsOptional()
  @IsObject()
  themeSource?: Record<string, unknown>;

  /** Subscription plan (defaults to the platform default plan) */
  @IsOptional()
  @IsUUID()
  planId?: string;
}

