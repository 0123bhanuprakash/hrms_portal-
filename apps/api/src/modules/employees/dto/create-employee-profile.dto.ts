import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { EmploymentType } from '@prisma/client';

/**
 * Employee profile for an EXISTING sign-in account (e.g. someone invited
 * from Users). Name and email come from the account.
 */
export class CreateEmployeeProfileDto {
  @ApiProperty({ example: '2026-04-01' })
  @IsDateString()
  joiningDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsUUID() designationId?: string;
  @IsOptional() @IsUUID() locationId?: string;
  @IsOptional() @IsUUID() reportingManagerId?: string;
}
