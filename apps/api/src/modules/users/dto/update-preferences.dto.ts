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
}
