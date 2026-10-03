import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { TimesheetStatus } from '@prisma/client';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const blankToNull = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);

export class LineDto {
  /** null = internal / non-project work */
  @IsOptional() @IsUUID() projectId?: string | null;
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(200) task!: string;
  @IsOptional() @IsBoolean() billable?: boolean;
  /** Minutes Monday → Sunday */
  @IsArray() @ArrayMinSize(7) @ArrayMaxSize(7) @IsInt({ each: true }) @Min(0, { each: true }) @Max(1440, { each: true }) minutes!: number[];
}

export class SaveWeekDto {
  @IsArray() @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => LineDto) lines!: LineDto[];
}

export class WeekQueryDto {
  /** Someone else's week (manager / approver / HR) */
  @IsOptional() @IsUUID() employeeId?: string;
}

export class TimesheetQueryDto {
  /** mine | review (waiting for me) | team (people I can see) */
  @IsIn(['mine', 'review', 'team']) view!: 'mine' | 'review' | 'team';
  @IsOptional() @IsEnum(TimesheetStatus) status?: TimesheetStatus;
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional() @Matches(DATE) from?: string;
  @IsOptional() @Matches(DATE) to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class ComplianceQueryDto {
  @Matches(DATE) weekStart!: string;
  @IsOptional() @IsIn(['missing', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']) status?: 'missing' | TimesheetStatus;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class DecideDto {
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(500) note?: string | null;
}

export class RejectDto {
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}

export class ReportQueryDto {
  @Matches(DATE) from!: string;
  @Matches(DATE) to!: string;
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsUUID() employeeId?: string;
  /** Only approved weeks (default: submitted + approved) */
  @IsOptional() @IsIn(['true', 'false']) approvedOnly?: string;
}
