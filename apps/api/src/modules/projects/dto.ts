import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, IsBoolean } from 'class-validator';
import { ProjectRole, ProjectStatus } from '@prisma/client';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const blankToNull = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);

export class SaveProjectDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9-]{2,12}$/, { message: 'Code must be 2–12 letters, digits or dashes' })
  code!: string;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(500) description?: string | null;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(100) clientName?: string | null;
  @IsOptional() @IsEnum(ProjectStatus) status?: ProjectStatus;
  @Matches(DATE, { message: 'startDate must be YYYY-MM-DD' }) startDate!: string;
  @IsOptional() @Transform(blankToNull) @Matches(DATE, { message: 'endDate must be YYYY-MM-DD' }) endDate?: string | null;
}

export class ProjectQueryDto {
  @IsOptional() @IsEnum(ProjectStatus) status?: ProjectStatus;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class SaveMemberDto {
  @IsUUID() employeeId!: string;
  @IsEnum(ProjectRole) role!: ProjectRole;
  /** Members only: a team lead of the same project */
  @IsOptional() @IsUUID() leadEmployeeId?: string | null;
  @IsInt() @Min(1) @Max(100) allocation!: number;
  /** The project needs this person to work nights (they may stay checked in past midnight) */
  @IsOptional() @IsBoolean() nightShift?: boolean;
  @Matches(DATE, { message: 'startDate must be YYYY-MM-DD' }) startDate!: string;
  @IsOptional() @Transform(blankToNull) @Matches(DATE, { message: 'endDate must be YYYY-MM-DD' }) endDate?: string | null;
}

export class CapacityQueryDto {
  @IsOptional() @Matches(DATE) from?: string;
  @IsOptional() @Transform(blankToNull) @Matches(DATE) to?: string | null;
  /** Ignore this assignment (when editing it) */
  @IsOptional() @IsUUID() excludeMemberId?: string;
}
