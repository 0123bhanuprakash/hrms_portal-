import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const blankToNull = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);

/** A Lead asks for a person (role / skills, %, dates, why — optionally who). */
export class RaiseRequestDto {
  @IsUUID() projectId!: string;
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(80) title!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(15) @IsString({ each: true }) @MaxLength(40, { each: true }) skills?: string[];
  @IsInt() @Min(5) @Max(100) allocation!: number;
  @Matches(DATE, { message: 'fromDate must be YYYY-MM-DD' }) fromDate!: string;
  @IsOptional() @Transform(blankToNull) @Matches(DATE, { message: 'untilDate must be YYYY-MM-DD' }) untilDate?: string | null;
  @Transform(trim) @IsString() @MinLength(5) @MaxLength(1000) reason!: string;
  @IsOptional() @IsUUID() preferredEmployeeId?: string | null;
  /** "Raise again" / "Request back" */
  @IsOptional() @IsUUID() previousRequestId?: string | null;
}

/** A Lead no longer needs someone on the project. */
export class RaiseReleaseDto {
  @IsUUID() memberId!: string;
  @Transform(trim) @IsString() @MinLength(5) @MaxLength(1000) reason!: string;
  @Matches(DATE, { message: 'lastDate must be YYYY-MM-DD' }) lastDate!: string;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(1000) handover?: string | null;
}

export class NoteDto {
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(1000) note?: string | null;
}

export class ReasonDto {
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(1000) reason!: string;
}

export class HoldDto {
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(1000) reason!: string;
  /** Optional "remind me on" date */
  @IsOptional() @Transform(blankToNull) @Matches(DATE, { message: 'remindAt must be YYYY-MM-DD' }) remindAt?: string | null;
}

export class TakeFromDto {
  /** Their assignment on another project that gives up time */
  @IsUUID() memberId!: string;
  /** What's left there from the start date (0 = their time there ends) */
  @IsInt() @Min(0) @Max(100) allocation!: number;
}

/** Fill a request with someone (the preferred person or another fit). */
export class FillDto {
  @IsUUID() employeeId!: string;
  @IsInt() @Min(1) @Max(100) allocation!: number;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(1000) note?: string | null;
  @IsOptional() @ValidateNested() @Type(() => TakeFromDto) takeFrom?: TakeFromDto | null;
}

export class ConsentDto {
  @IsBoolean() agree!: boolean;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(1000) note?: string | null;
}

/** PM / Delivery Director decide a release. */
export class ReleaseDecisionDto {
  @IsIn(['pool', 'reassign', 'keep']) outcome!: 'pool' | 'reassign' | 'keep';
  @IsOptional() @IsUUID() targetProjectId?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(100) allocation?: number | null;
  @IsOptional() @Transform(blankToNull) @Matches(DATE, { message: 'startDate must be YYYY-MM-DD' }) startDate?: string | null;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(1000) note?: string | null;
}

export class RequestListQueryDto {
  @IsOptional() @IsIn(['waiting', 'hold', 'mine', 'done', 'all']) view?: 'waiting' | 'hold' | 'mine' | 'done' | 'all';
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsIn(['REQUEST', 'RELEASE']) kind?: 'REQUEST' | 'RELEASE';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class CandidatesQueryDto {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(80) search?: string;
}
