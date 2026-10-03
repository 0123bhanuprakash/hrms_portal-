import { IsString, IsOptional, IsBoolean, IsIn } from 'class-validator';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsString()
  @IsIn(['light', 'dark', 'system'], {
    message: "theme must be 'light', 'dark', or 'system'",
  })
  theme?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  dateFormat?: string;

  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  /** Spacing of the interface; "theme" follows the company/platform theme */
  @IsOptional()
  @IsIn(['theme', 'compact', 'normal', 'spacious'])
  density?: string;

  /** Base text size; "theme" follows the theme's text scale */
  @IsOptional()
  @IsIn(['theme', 'sm', 'md', 'lg', 'xl'])
  textSize?: string;

  @IsOptional()
  @IsBoolean()
  reduceMotion?: boolean;
}
