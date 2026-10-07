import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, IsBoolean } from 'class-validator';
import { ProjectRole, ProjectStatus, ProjectType } from '@prisma/client';

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
  /** Client (billable) or internal (investment) — PMO only */
  @IsOptional() @IsEnum(ProjectType) type?: ProjectType;
  @IsOptional() @Transform(blankToNull) @Matches(/^#[0-9a-fA-F]{6}$/) color?: string | null;
  @Matches(DATE, { message: 'startDate must be YYYY-MM-DD' }) startDate!: string;
  @IsOptional() @Transform(blankToNull) @Matches(DATE, { message: 'endDate must be YYYY-MM-DD' }) endDate?: string | null;
  /** People in charge (PMO): the one project manager — picking one also books their time here */
  @IsOptional() @IsUUID() managerEmployeeId?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(100) managerAllocation?: number;
  /** Oversees the PM; resource requests go Lead → PM → Delivery Director → PMO. No time is booked. */
  @IsOptional() @IsUUID() deliveryDirectorId?: string | null;
}

/** Technologies used on the project (kept by its leads) */
export class TechStackDto {
  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(40, { each: true }) techStack!: string[];
}

export class ProjectQueryDto {
  @IsOptional() @IsEnum(ProjectStatus) status?: ProjectStatus;
  @IsOptional() @IsEnum(ProjectType) type?: ProjectType;
  @IsOptional() @IsIn(['on_track', 'at_risk', 'off_track']) health?: 'on_track' | 'at_risk' | 'off_track';
  @IsOptional() @IsUUID() managerId?: string;
  @IsOptional() @IsIn(['attention', 'name', 'end', 'start']) sort?: 'attention' | 'name' | 'end' | 'start';
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
  /** Client projects: does the client pay for this person? (default yes) */
  @IsOptional() @IsBoolean() billed?: boolean;
  @Matches(DATE, { message: 'startDate must be YYYY-MM-DD' }) startDate!: string;
  @IsOptional() @Transform(blankToNull) @Matches(DATE, { message: 'endDate must be YYYY-MM-DD' }) endDate?: string | null;
}

export class CapacityQueryDto {
  @IsOptional() @Matches(DATE) from?: string;
  @IsOptional() @Transform(blankToNull) @Matches(DATE) to?: string | null;
  /** Ignore this assignment (when editing it) */
  @IsOptional() @IsUUID() excludeMemberId?: string;
}

export class MilestoneDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(120) title!: string;
  @Matches(DATE, { message: 'dueDate must be YYYY-MM-DD' }) dueDate!: string;
  @IsOptional() @IsUUID() ownerEmployeeId?: string | null;
}

export class MilestonePatchDto {
  @IsOptional() @Transform(trim) @IsString() @MinLength(2) @MaxLength(120) title?: string;
  @IsOptional() @Matches(DATE, { message: 'dueDate must be YYYY-MM-DD' }) dueDate?: string;
  @IsOptional() @IsUUID() ownerEmployeeId?: string | null;
  @IsOptional() @IsBoolean() done?: boolean;
}

export class ProjectUpdateDto {
  @IsIn(['on_track', 'at_risk', 'off_track']) health!: 'on_track' | 'at_risk' | 'off_track';
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(1000) note!: string;
}

export class BilledDto {
  @IsBoolean() billed!: boolean;
}

export class TimelineQueryDto {
  /** First month shown (YYYY-MM) */
  @IsOptional() @Matches(/^\d{4}-\d{2}$/) from?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) months?: number;
}

export class PlannerQueryDto {
  /** Any day in the first week shown */
  @IsOptional() @Matches(DATE) from?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(4) @Max(13) weeks?: number;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) search?: string;
}

export class AvailableQueryDto {
  @Matches(DATE) from!: string;
  @Matches(DATE) to!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) min!: number;
  @IsOptional() @IsUUID() designationId?: string;
  @IsOptional() @IsUUID() departmentId?: string;
}
