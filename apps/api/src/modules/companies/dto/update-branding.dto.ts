import { IsString, IsOptional, Matches, IsUrl, IsIn, MaxLength, ValidateIf } from 'class-validator';

export class UpdateBrandingDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  /** null removes it */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUrl()
  logoUrl?: string | null;

  /** Square icon for browser tabs (null removes it) */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUrl()
  faviconUrl?: string | null;

  /** Short line under the name in the side menu ('' clears it) */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  tagline?: string;

  /** Logo for dark mode (null removes it) */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUrl()
  logoDarkUrl?: string | null;

  /** Sign-in page welcome line ('' clears it) */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  signInMessage?: string;

  @IsOptional()
  @IsIn(['pack', 'photo', 'plain'])
  signInBackground?: 'pack' | 'photo' | 'plain';

  /** Sign-in background photo (null removes it) */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUrl()
  signInPhotoUrl?: string | null;

  @IsOptional()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: 'primaryColor must be a valid hex color code e.g. #1E40AF',
  })
  primaryColor?: string;

  @IsOptional()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: 'secondaryColor must be a valid hex color code e.g. #EFF6FF',
  })
  secondaryColor?: string;
}
