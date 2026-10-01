import { IsObject, IsOptional } from 'class-validator';

/** PUT /companies/:id/theme — tokens are validated strictly by the service (zod). */
export class UpdateCompanyThemeDto {
  /** Full theme (ThemeTokens) */
  @IsObject()
  themeTokens!: Record<string, unknown>;

  /** Library theme it started from (ThemeRef), if any */
  @IsOptional()
  @IsObject()
  themeSource?: Record<string, unknown>;
}
