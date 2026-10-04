import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional } from 'class-validator';
import { BUILTIN_THEME_KEYS, MENU_STYLES } from '../../themes/personalization';

/** PUT /companies/:id/personalization — what employees may change for themselves. */
export class UpdatePersonalizationDto {
  @IsOptional() @IsBoolean() personalThemes?: boolean;
  /** Built-in theme keys employees may pick; empty = all */
  @IsOptional() @IsArray() @ArrayMaxSize(BUILTIN_THEME_KEYS.length) @IsIn([...BUILTIN_THEME_KEYS], { each: true }) allowedThemes?: string[];
  @IsOptional() @IsBoolean() personalMenuStyle?: boolean;
  @IsOptional() @IsIn([...MENU_STYLES]) defaultMenuStyle?: (typeof MENU_STYLES)[number];
}
