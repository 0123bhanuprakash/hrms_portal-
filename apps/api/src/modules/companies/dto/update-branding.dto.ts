import { IsString, IsOptional, Matches, IsUrl } from 'class-validator';

export class UpdateBrandingDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsUrl()
  faviconUrl?: string;

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
