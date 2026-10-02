import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  NotEquals,
} from 'class-validator';
import { Gender, HalfDaySession, LeaveAccrual, LeaveStatus, LeaveTypeCategory } from '@prisma/client';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const blankToNull = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);

export class SaveLeaveTypeDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(60) name!: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9]{1,8}$/, { message: 'Code must be 1–8 letters or digits' })
  code!: string;
  @IsEnum(LeaveTypeCategory) category!: LeaveTypeCategory;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(300) description?: string | null;
  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Colour must be a hex value like #6366F1' }) color?: string;
  @IsEnum(LeaveAccrual) accrual!: LeaveAccrual;
  @IsNumber() @Min(0) @Max(366) annualQuota!: number;
  @IsOptional() @IsBoolean() carryForward?: boolean;
  @IsOptional() @IsNumber() @Min(0) @Max(366) maxCarryForward?: number;
  @IsOptional() @IsBoolean() isPaid?: boolean;
  @IsOptional() @IsBoolean() allowHalfDay?: boolean;
  @IsInt() @Min(0) @Max(3) approvalLevels!: number;
  @IsOptional() @IsInt() @Min(0) @Max(365) minNoticeDays?: number;
  @IsOptional() @IsInt() @Min(1) @Max(366) maxConsecutiveDays?: number | null;
  @IsOptional() @IsBoolean() includeNonWorkingDays?: boolean;
  @IsOptional() @IsBoolean() countsAsPresent?: boolean;
  @IsOptional() @IsEnum(Gender) gender?: Gender | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(1000) sortOrder?: number;
}

export class BalanceQueryDto {
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year?: number;
}

export class AdjustBalanceDto {
  @IsUUID() employeeId!: string;
  @IsUUID() leaveTypeId!: string;
  @IsInt() @Min(2000) @Max(2100) year!: number;
  /** + adds days, − removes them (half-day steps) */
  @IsNumber() @NotEquals(0) @Min(-366) @Max(366) days!: number;
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(300) reason!: string;
}

export class LeaveRequestInputDto {
  @IsUUID() leaveTypeId!: string;
  @Matches(DATE, { message: 'startDate must be YYYY-MM-DD' }) startDate!: string;
  @Matches(DATE, { message: 'endDate must be YYYY-MM-DD' }) endDate!: string;
  @IsOptional() @IsEnum(HalfDaySession) halfDay?: HalfDaySession | null;
}

export class CreateLeaveRequestDto extends LeaveRequestInputDto {
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}

export class LeaveListQueryDto {
  /** mine = my requests; review = waiting for my decision; all = everyone I can see */
  @IsIn(['mine', 'review', 'all']) view!: 'mine' | 'review' | 'all';
  @IsOptional() @IsEnum(LeaveStatus) status?: LeaveStatus;
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional() @IsUUID() leaveTypeId?: string;
  @IsOptional() @Matches(DATE) from?: string;
  @IsOptional() @Matches(DATE) to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class DecideLeaveDto {
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(500) note?: string | null;
}

export class CancelLeaveDto {
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(500) reason?: string | null;
}

export class LeaveCalendarQueryDto {
  @Matches(MONTH, { message: 'month must be YYYY-MM' }) month!: string;
  @IsOptional() @IsUUID() departmentId?: string;
}
