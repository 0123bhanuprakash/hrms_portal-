import {
  IsEmail,
  IsEnum,
  IsHexColor,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { CompanyStatus, UserStatus } from '@prisma/client';

/** PATCH /admin/companies/:id — company details + branding colors */
export class AdminUpdateCompanyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  /** Applies to newly created employee IDs only */
  @IsOptional()
  @Matches(/^[A-Z0-9]{2,10}$/, {
    message: 'employeeIdPrefix must be 2-10 uppercase letters or digits',
  })
  employeeIdPrefix?: string;

  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @IsOptional()
  @IsHexColor()
  secondaryColor?: string;
}

/** PATCH /admin/companies/:id/status */
export class UpdateCompanyStatusDto {
  @IsEnum(CompanyStatus)
  status!: CompanyStatus;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  reason?: string;
}

/** PATCH /admin/companies/:id/admins/:userId/status */
export class UpdateCompanyAdminStatusDto {
  @IsIn([UserStatus.ACTIVE, UserStatus.INACTIVE])
  status!: 'ACTIVE' | 'INACTIVE';
}
