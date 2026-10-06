import { IsString, IsOptional, IsBoolean, IsIn, ValidateIf, IsObject, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class QuietHoursDto {
  @IsBoolean() on!: boolean;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) from!: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) to!: string;
  @IsBoolean() weekends!: boolean;
}
import { BACKDROP_LEVELS, BACKDROP_PACKS, BUILTIN_THEME_KEYS, MENU_STYLES } from '../../themes/personalization';

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

  /** { time: { app: true, email: false }, … } (merged into the saved choices) */
  @IsOptional()
  @IsObject()
  notificationTopics?: Record<string, { app?: boolean; email?: boolean }>;

  @IsOptional()
  @ValidateNested()
  @Type(() => QuietHoursDto)
  quietHours?: QuietHoursDto;

  @IsOptional()
  @IsBoolean()
  dailySummary?: boolean;

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

  /** classic | glide | peek | floating | collapsible; null = the company default */
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsIn([...MENU_STYLES], { message: 'menuStyle must be classic, glide, peek, floating or collapsible' })
  menuStyle?: string | null;

  /** Page background pack; null = the company default */
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsIn([...BACKDROP_PACKS], { message: 'backdropPack is not a known background pack' })
  backdropPack?: string | null;

  /** lively | calm | off; null = the company default */
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsIn([...BACKDROP_LEVELS], { message: 'backdropLevel must be lively, calm or off' })
  backdropLevel?: string | null;

  /** Super Admins: email me when a new device signs in */
  @IsOptional()
  @IsBoolean()
  notifyNewDevice?: boolean;

  /** Sign out after this many idle minutes; null = never */
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsIn([15, 30, 60, 120], { message: 'idleTimeoutMinutes must be 15, 30, 60 or 120' })
  idleTimeoutMinutes?: number | null;

  /** Super Admins: ask for the password again before risky changes */
  @IsOptional()
  @IsBoolean()
  reauthForRisky?: boolean;
}
