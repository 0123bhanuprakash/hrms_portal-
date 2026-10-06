import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { UserStatus } from '@prisma/client';
import { CreateEmployeeProfileDto } from '../employees/dto/create-employee-profile.dto';

const SCOPES = ['own', 'direct_reports', 'all_reports', 'department', 'department_tree', 'location', 'company'] as const;

// ─── Roles ──────────────────────────────────────────────────

export class GrantDto {
  @ApiProperty({ example: 'leave.approve' })
  @IsString()
  @Matches(/^[a-z_]+\.[a-z_]+$/, { message: 'Invalid permission key' })
  key!: string;

  @ApiPropertyOptional({ enum: SCOPES, nullable: true, description: 'Required for scoped permissions; omit for unscoped ones' })
  @IsOptional()
  @IsIn(SCOPES)
  scope?: (typeof SCOPES)[number] | null;
}

export class SaveRoleDto {
  @ApiProperty({ example: 'Payroll Officer' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @ApiProperty({ type: [GrantDto] })
  @IsArray()
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => GrantDto)
  grants!: GrantDto[];
}

export class DuplicateRoleDto {
  @ApiPropertyOptional({ description: 'Defaults to "<name> (copy)"' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name?: string;
}

export class RoleStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'] })
  @IsIn(['ACTIVE', 'INACTIVE'])
  status!: 'ACTIVE' | 'INACTIVE';

  @ApiPropertyOptional({ description: 'When deactivating a role that has users: move them to this role' })
  @IsOptional()
  @IsUUID()
  reassignToRoleId?: string;
}

// ─── Users ──────────────────────────────────────────────────

export class QueryCompanyUsersDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsUUID()
  roleId?: string;

  @IsOptional()
  @IsIn([...Object.values(UserStatus), 'INVITED'])
  status?: UserStatus | 'INVITED';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class InviteUserDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  lastName!: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @ApiPropertyOptional({ type: [String], description: 'Defaults to the Employee role' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  roleIds?: string[];

  @ApiPropertyOptional({ type: CreateEmployeeProfileDto, description: 'Also create their employee profile (recommended for staff)' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateEmployeeProfileDto)
  employee?: CreateEmployeeProfileDto;
}

export class UpdateCompanyUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  lastName?: string;
}

export class SetUserRolesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1, { message: 'A user needs at least one role' })
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  roleIds!: string[];
}

export class UserStatusDto {
  @ApiProperty({ enum: [UserStatus.ACTIVE, UserStatus.INACTIVE] })
  @IsIn([UserStatus.ACTIVE, UserStatus.INACTIVE])
  status!: 'ACTIVE' | 'INACTIVE';
}

// ─── Users: bulk, invite many, role preview ─────────────────

export class BulkUsersDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  ids!: string[];

  @ApiProperty({ enum: ['add_role', 'remove_role', 'resend_invite', 'deactivate', 'activate'] })
  @IsIn(['add_role', 'remove_role', 'resend_invite', 'deactivate', 'activate'])
  action!: 'add_role' | 'remove_role' | 'resend_invite' | 'deactivate' | 'activate';

  @ApiPropertyOptional({ description: 'For add_role / remove_role' })
  @IsOptional()
  @IsUUID()
  roleId?: string;
}

export class InviteManyDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  emails!: string[];

  @ApiPropertyOptional({ type: [String], description: 'Defaults to the Employee role' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  roleIds?: string[];
}

export class PreviewRolesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  roleIds!: string[];
}
