import { IsString, IsOptional, IsBoolean, IsIn, ValidateIf } from 'class-validator';
import { BUILTIN_THEME_KEYS, MENU_STYLES } from '../../themes/personalization';

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

  /** A built-in theme key; null = back to the company theme */
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsIn([...BUILTIN_THEME_KEYS], { message: 'colorTheme must be one of the built-in themes' })
  colorTheme?: string | null;

  /** classic | rail | floating | collapsible; null = the company default */
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsIn([...MENU_STYLES], { message: 'menuStyle must be classic, rail, floating or collapsible' })
  menuStyle?: string | null;
}
