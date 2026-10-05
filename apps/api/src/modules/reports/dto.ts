import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Narrow any report to a department and / or location (within the caller's scope). */
export class FilterQueryDto {
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsUUID() locationId?: string;
}

export class MonthQueryDto extends FilterQueryDto {
  /** YYYY-MM (default: this month); ignored when from / to are given */
  @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be YYYY-MM' }) month?: string;
  @IsOptional() @Matches(DATE) from?: string;
  @IsOptional() @Matches(DATE) to?: string;
}

export class RangeQueryDto extends FilterQueryDto {
  @IsOptional() @Matches(DATE) from?: string;
  @IsOptional() @Matches(DATE) to?: string;
}

export const DRILL_DIMENSIONS = ['all', 'department', 'location', 'level', 'tenure', 'type', 'gender', 'status', 'joined', 'left'] as const;
export type DrillDimension = (typeof DRILL_DIMENSIONS)[number];

/** "Who is behind this number" — people in one slice of the People report. */
export class DrillQueryDto extends FilterQueryDto {
  @IsIn(DRILL_DIMENSIONS) dimension!: DrillDimension;
  /** Department / location / level id ("none" = not set), enum value, tenure band, or YYYY-MM for joined / left */
  @IsString() @MinLength(1) @MaxLength(60) value!: string;
}

export class DayQueryDto extends FilterQueryDto {
  @Matches(DATE) date!: string;
}

export const SCHEDULE_REPORTS = ['overview', 'people', 'attendance', 'utilisation'] as const;
export const SCHEDULE_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;

export class SaveScheduleDto {
  @IsIn(SCHEDULE_REPORTS) report!: (typeof SCHEDULE_REPORTS)[number];
  @IsIn(SCHEDULE_FREQUENCIES) frequency!: (typeof SCHEDULE_FREQUENCIES)[number];
  /** 1 = Monday … 7 = Sunday (weekly) */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(7) dayOfWeek?: number;
  /** 1–28 (monthly) */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(28) dayOfMonth?: number;
  /** Local hour 0–23 in the company time zone */
  @Type(() => Number) @IsInt() @Min(0) @Max(23) hour!: number;
  /** Users who get it (must be able to see reports); each gets numbers for what they may see */
  @IsArray() @ArrayMaxSize(20) @IsUUID('4', { each: true }) recipientIds!: string[];
  /** Attach a CSV (People roster or Utilisation) */
  @IsOptional() @IsBoolean() attachCsv?: boolean;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsUUID() locationId?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
