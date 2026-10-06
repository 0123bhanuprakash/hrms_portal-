import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
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
  ValidateIf,
} from 'class-validator';
import { AttendanceStatus, RegularisationStatus } from '@prisma/client';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const blankToNull = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);

export class CalendarQueryDto {
  @Matches(MONTH, { message: 'month must be YYYY-MM' }) month!: string;
  /** Someone else's calendar (needs attendance.view reaching them) */
  @IsOptional() @IsUUID() employeeId?: string;
}

export class TeamQueryDto {
  @IsOptional() @Matches(DATE, { message: 'date must be YYYY-MM-DD' }) date?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsString() @MaxLength(30) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}

export class ExportQueryDto {
  @Matches(MONTH, { message: 'month must be YYYY-MM' }) month!: string;
  @IsOptional() @IsUUID() departmentId?: string;
}

export class CreateRegularisationDto {
  @Matches(DATE, { message: 'date must be YYYY-MM-DD' }) date!: string;
  @Matches(TIME, { message: 'checkIn must be HH:mm' }) checkIn!: string;
  @IsOptional() @Transform(blankToNull) @Matches(TIME, { message: 'checkOut must be HH:mm' }) checkOut?: string | null;
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}

export class RegularisationQueryDto {
  /** mine = my own requests; review = requests I can approve */
  @IsIn(['mine', 'review']) view!: 'mine' | 'review';
  @IsOptional() @IsEnum(RegularisationStatus) status?: RegularisationStatus;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class ReviewRegularisationDto {
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(500) note?: string | null;
}

/** HR / admin correction of a day (attendance.edit). */
export class UpsertRecordDto {
  @IsUUID() employeeId!: string;
  @Matches(DATE, { message: 'date must be YYYY-MM-DD' }) date!: string;
  @IsOptional() @Transform(blankToNull) @Matches(TIME, { message: 'checkIn must be HH:mm' }) checkIn?: string | null;
  @IsOptional() @Transform(blankToNull) @Matches(TIME, { message: 'checkOut must be HH:mm' }) checkOut?: string | null;
  /** Only without times: e.g. ABSENT or ON_LEAVE for the day */
  @IsOptional() @IsEnum(AttendanceStatus) status?: AttendanceStatus;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(500) notes?: string | null;
}

export class UpdatePolicyDto {
  @IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(7) @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) workDays?: number[];
  @IsOptional() @Matches(TIME, { message: 'shiftStart must be HH:mm' }) shiftStart?: string;
  @IsOptional() @Matches(TIME, { message: 'shiftEnd must be HH:mm' }) shiftEnd?: string;
  @IsOptional() @IsInt() @Min(0) @Max(240) graceMinutes?: number;
  @IsOptional() @IsInt() @Min(30) @Max(1440) halfDayMinutes?: number;
  @IsOptional() @IsInt() @Min(60) @Max(1440) fullDayMinutes?: number;
  @IsOptional() @IsInt() @Min(0) @Max(365) regularisationWindowDays?: number;
  @IsOptional() @IsBoolean() webCheckInEnabled?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(31) correctionAlertAt?: number;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(1) @Max(31) lateAlertAt?: number | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(0) @Max(720) autoCloseAfterMinutes?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(30) optionalHolidayLimit?: number;
}

export class SaveShiftDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(40) name!: string;
  @Matches(TIME, { message: 'startTime must be HH:mm' }) startTime!: string;
  @Matches(TIME, { message: 'endTime must be HH:mm' }) endTime!: string;
  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Colour must be a hex value like #7C3AED' }) color?: string;
}

export class ShiftMembersDto {
  @IsArray() @ArrayUnique() @ArrayMaxSize(2000) @IsUUID('all', { each: true }) employeeIds!: string[];
}

export class NudgeDto {
  @IsArray() @ArrayUnique() @ArrayMinSize(1) @ArrayMaxSize(200) @IsUUID('all', { each: true }) employeeIds!: string[];
  /** check_in = "you haven't checked in"; fix = "fix your missed check-out" */
  @IsIn(['check_in', 'fix']) kind!: 'check_in' | 'fix';
}

export class TeamMonthQueryDto {
  @Matches(MONTH, { message: 'month must be YYYY-MM' }) month!: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class ImportHolidaysDto {
  @IsInt() @Min(2024) @Max(2030) year!: number;
}

export class HolidayQueryDto {
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year!: number;
}

export class SaveHolidayDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @Matches(DATE, { message: 'date must be YYYY-MM-DD' }) date!: string;
  @IsOptional() @IsBoolean() isOptional?: boolean;
  /** Office locations it applies to; empty / missing = everyone */
  @IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(50) @IsUUID('all', { each: true }) locationIds?: string[];
}

/** POST /attendance/check-out — an optional reason when leaving before a full day */
export class CheckOutDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
