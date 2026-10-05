import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { TimesheetStatus } from '@prisma/client';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const blankToNull = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);

export const WORK_TYPES = ['Development', 'Meeting', 'Review', 'Testing', 'Design', 'Support', 'Learning', 'Admin'] as const;

/** One block of work: 10:00–12:00 on a project, with what was done. */
export class BlockDto {
  @Matches(DATE) date!: string;
  /** Minutes from midnight (multiples of 5) */
  @Type(() => Number) @IsInt() @Min(0) @Max(1435) startMin!: number;
  /** May pass midnight (up to 12:00 the next day) for night work */
  @Type(() => Number) @IsInt() @Min(5) @Max(2160) endMin!: number;
  /** null = General (not on a project) */
  @IsOptional() @IsUUID() projectId?: string | null;
  @Transform(trim) @IsString() @MinLength(2, { message: 'Say what you worked on' }) @MaxLength(500) description!: string;
  @IsOptional() @Transform(blankToNull) @IsIn([...WORK_TYPES, null]) workType?: string | null;
}

export class CalendarQueryDto {
  /** Someone else's week (their lead / manager / HR) */
  @IsOptional() @IsUUID() employeeId?: string;
}

export class CopyDayDto {
  @Matches(DATE) from!: string;
  @Matches(DATE) to!: string;
}

export class SubmitDto {
  /** today = just today; all = every logged day not sent yet, up to today */
  @IsIn(['today', 'all']) scope!: 'today' | 'all';
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(500) note?: string | null;
}

export class SubmitPreviewQueryDto {
  @IsIn(['today', 'all']) scope!: 'today' | 'all';
}

export class RecallDto {
  /** Days to take back (default: everything waiting) */
  @IsOptional() @IsArray() @ArrayMaxSize(70) @Matches(DATE, { each: true }) dates?: string[];
}

/** Which blocks: explicit ids, or a person's days (only the blocks you can decide). */
export class PickBlocksDto {
  @IsOptional() @IsArray() @ArrayMaxSize(500) @IsUUID('all', { each: true }) ids?: string[];
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(70) @Matches(DATE, { each: true }) dates?: string[];
  /** Several people at once (bulk approve a week) */
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsUUID('all', { each: true }) employeeIds?: string[];
}

export class ApproveBlocksDto extends PickBlocksDto {
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(500) note?: string | null;
}

export class SendBackDto extends PickBlocksDto {
  @Transform(trim) @IsString() @MinLength(3, { message: 'Say what needs changing' }) @MaxLength(500) note!: string;
}

export class TeamQueryDto {
  @Matches(DATE) weekStart!: string;
}

export class TimesheetQueryDto {
  /** mine | team (people I can see) */
  @IsIn(['mine', 'team']) view!: 'mine' | 'team';
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
