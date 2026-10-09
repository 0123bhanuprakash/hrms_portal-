import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
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
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { EmploymentType, Gender, HalfDaySession, LeaveAccrual, LeaveAvailability, LeaveGrantRequestStatus, LeaveGrantStatus, LeaveMemberMode, LeaveStatus, LeaveTypeCategory } from '@prisma/client';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const blankToNull = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);

export class LeaveTypeMemberDto {
  @IsUUID() employeeId!: string;
  @IsEnum(LeaveMemberMode) mode!: LeaveMemberMode;
}

/** Multipart forms send lists as JSON text or repeated fields */
const list = ({ value }: { value: unknown }) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [value];
  } catch {
    return value.split(',').map((v) => v.trim()).filter(Boolean);
  }
};
const num = ({ value }: { value: unknown }) => (typeof value === 'string' && value.trim() !== '' ? Number(value) : value);

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
  /** Who can use it — EVERYONE, RULES (people matching the rules) or GRANT_ONLY (HR grants it) */
  @IsOptional() @IsEnum(LeaveAvailability) availability?: LeaveAvailability;
  @IsOptional() @IsArray() @ArrayMaxSize(4) @IsEnum(Gender, { each: true }) genders?: Gender[];
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsUUID('all', { each: true }) departmentIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsUUID('all', { each: true }) locationIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsUUID('all', { each: true }) designationIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(4) @IsEnum(EmploymentType, { each: true }) employmentTypes?: EmploymentType[];
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(1) @Max(600) minServiceMonths?: number | null;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsUUID('all', { each: true }) managerIds?: string[];
  @IsOptional() @IsBoolean() managerDeep?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsUUID('all', { each: true }) projectIds?: string[];
  /** Named people added to / kept out of the rules */
  @IsOptional() @IsArray() @ArrayMaxSize(1000) @ValidateNested({ each: true }) @Type(() => LeaveTypeMemberDto) members?: LeaveTypeMemberDto[];
  @IsOptional() @IsBoolean() grantNeedsDocument?: boolean;
  @IsOptional() @IsBoolean() blockDuringProbation?: boolean;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(0) @Max(365) documentAfterDays?: number | null;
  @IsOptional() @IsBoolean() sandwichRule?: boolean;
  @IsOptional() @IsNumber() @Min(0) @Max(30) negativeBalance?: number;
  /** Below 0 at year end: take it from next year (default) or forgive it */
  @IsOptional() @IsBoolean() recoverNegative?: boolean;
  /** "MM-DD" — carried days not used by then lapse; null = never */
  @IsOptional() @ValidateIf((_, v) => v !== null) @Matches(/^(0[1-9]|1[0-2])-(0[1-9]|[12]d|3[01])$/, { message: 'carryExpiry must be MM-DD' }) carryExpiry?: string | null;
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
  /** EXTRA (+, kept) · LEND (may go this many days below 0) · CORRECTION (±) · DEDUCTION (−). Default CORRECTION. */
  @IsOptional() @IsIn(['EXTRA', 'LEND', 'CORRECTION', 'DEDUCTION']) kind?: 'EXTRA' | 'LEND' | 'CORRECTION' | 'DEDUCTION';
  /** + adds days, − removes them (half-day steps); LEND: how far below 0 */
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
  /** Name or employee id */
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  /** soonest = starts first (default for "waiting for me"); newest = applied last; latest = starts last (default for "all") */
  @IsOptional() @IsIn(['soonest', 'newest', 'latest']) sort?: 'soonest' | 'newest' | 'latest';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class DecideLeaveDto {
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(500) note?: string | null;
}

export class CancelLeaveDto {
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(500) reason?: string | null;
}

export class AskQuestionDto {
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(500) question!: string;
}

/** Approved leave that has started: cancel all of it, or "came back early" (last day actually taken). */
export class CancelRequestDto {
  @IsIn(['all', 'early']) mode!: 'all' | 'early';
  @ValidateIf((d: CancelRequestDto) => d.mode === 'early') @Matches(DATE) lastDay?: string;
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}

/** The employee answers an approver's question */
export class LeaveReplyDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(1000) body!: string;
}

export class YearQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year?: number;
}

export class LeaveCalendarQueryDto {
  @Matches(MONTH, { message: 'month must be YYYY-MM' }) month!: string;
  @IsOptional() @IsUUID() departmentId?: string;
}

/** Draft rules → how many people they cover (the leave type form) */
export class EligibilityPreviewDto {
  @IsEnum(LeaveAvailability) availability!: LeaveAvailability;
  @IsOptional() @IsArray() @IsEnum(Gender, { each: true }) genders?: Gender[];
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) departmentIds?: string[];
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) locationIds?: string[];
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) designationIds?: string[];
  @IsOptional() @IsArray() @IsEnum(EmploymentType, { each: true }) employmentTypes?: EmploymentType[];
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(1) @Max(600) minServiceMonths?: number | null;
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) managerIds?: string[];
  @IsOptional() @IsBoolean() managerDeep?: boolean;
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) projectIds?: string[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => LeaveTypeMemberDto) members?: LeaveTypeMemberDto[];
}

// ─── Grants ───────────────────────────────────────────────────

/** HR grants a GRANT_ONLY type to one or more people (multipart: optional `file`) */
export class CreateGrantDto {
  @Transform(list) @IsArray() @ArrayMaxSize(200) @IsUUID('all', { each: true }) employeeIds!: string[];
  @IsUUID() leaveTypeId!: string;
  @Transform(num) @IsNumber() @Min(0.5) @Max(366) days!: number;
  @Matches(DATE, { message: 'validFrom must be YYYY-MM-DD' }) validFrom!: string;
  @Matches(DATE, { message: 'validTo must be YYYY-MM-DD' }) validTo!: string;
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}

/** Change days or the end date (extend / shorten) — always with a reason */
export class UpdateGrantDto {
  @IsOptional() @IsNumber() @Min(0.5) @Max(366) days?: number;
  @IsOptional() @Matches(DATE, { message: 'validTo must be YYYY-MM-DD' }) validTo?: string;
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(500) note!: string;
}

export class RevokeGrantDto {
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(500) note!: string;
}

export class GrantListQueryDto {
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional() @IsUUID() leaveTypeId?: string;
  @IsOptional() @IsEnum(LeaveGrantStatus) status?: LeaveGrantStatus;
}

/** An employee asks HR for a GRANT_ONLY type (multipart: `file`) */
export class CreateGrantRequestDto {
  @IsUUID() leaveTypeId!: string;
  @Matches(DATE, { message: 'fromDate must be YYYY-MM-DD' }) fromDate!: string;
  @Matches(DATE, { message: 'toDate must be YYYY-MM-DD' }) toDate!: string;
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(1000) note!: string;
}

export class GrantRequestListQueryDto {
  /** mine = my requests; review = waiting for HR */
  @IsIn(['mine', 'review']) view!: 'mine' | 'review';
  @IsOptional() @IsEnum(LeaveGrantRequestStatus) status?: LeaveGrantRequestStatus;
}

/** HR approves — may change the days and window before the grant is made */
export class ApproveGrantRequestDto {
  @IsNumber() @Min(0.5) @Max(366) days!: number;
  @Matches(DATE, { message: 'validFrom must be YYYY-MM-DD' }) validFrom!: string;
  @Matches(DATE, { message: 'validTo must be YYYY-MM-DD' }) validTo!: string;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(500) note?: string | null;
}

export class RejectGrantRequestDto {
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(500) note!: string;
}

// ─── Lend / give extra days, ledger ───────────────────────────

export class WaiveDto {
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(500) note!: string;
}

export class OwedQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year?: number;
}

export class LedgerQueryDto {
  @IsOptional() @IsUUID() employeeId?: string;
  @IsUUID() leaveTypeId!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year?: number;
}

/** The balance ran out: ask for more days */
export class AskExtraDto {
  @IsUUID() leaveTypeId!: string;
  @IsInt() @Min(2000) @Max(2100) year!: number;
  @IsNumber() @Min(0.5) @Max(366) days!: number;
  @IsOptional() @Matches(DATE, { message: 'startDate must be YYYY-MM-DD' }) startDate?: string;
  @IsOptional() @Matches(DATE, { message: 'endDate must be YYYY-MM-DD' }) endDate?: string;
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}

export class ExtraListQueryDto {
  /** mine = what I asked for; decide = waiting for me */
  @IsIn(['mine', 'decide']) view!: 'mine' | 'decide';
  @IsOptional() @IsIn(['PENDING', 'LENT', 'GIVEN', 'DECLINED', 'CANCELLED']) status?: 'PENDING' | 'LENT' | 'GIVEN' | 'DECLINED' | 'CANCELLED';
}

export class DecideExtraDto {
  @IsIn(['lend', 'give', 'decline']) action!: 'lend' | 'give' | 'decline';
  /** lend / give: how many days (may differ from what was asked) */
  @ValidateIf((d: DecideExtraDto) => d.action !== 'decline') @IsNumber() @Min(0.5) @Max(366) days?: number;
  @ValidateIf((d: DecideExtraDto) => d.action === 'decline') @Transform(trim) @IsString() @MinLength(3) @MaxLength(500) note?: string;
}

/** Lend / give without a request (the Extra leave tab shortcut) */
export class LendGiveDto {
  @IsUUID() employeeId!: string;
  @IsUUID() leaveTypeId!: string;
  @IsInt() @Min(2000) @Max(2100) year!: number;
  @IsIn(['lend', 'give']) action!: 'lend' | 'give';
  @IsNumber() @Min(0.5) @Max(366) days!: number;
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(300) reason!: string;
}
