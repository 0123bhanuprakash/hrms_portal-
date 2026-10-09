import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
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
  ValidateNested,
} from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const blankToNull = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);
/** Rupees from JSON or multipart (string) — at most 2 decimals. */
const rupees = ({ value }: { value: unknown }) => (typeof value === 'string' && value.trim() !== '' ? Number(value) : value);

export class SaveCategoryDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(60) name!: string;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(200) description?: string | null;
  /** Rupees; null = no limit */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(10_000_000) maxPerItem?: number | null;
  /** Rupees; 0 = always, null = never */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(10_000_000) receiptRequiredAbove?: number | null;
  /** Rupees per person per calendar month; null = no cap */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(10_000_000) maxPerMonth?: number | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(1000) sortOrder?: number;
}

export class SaveClaimDto {
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(120) title!: string;
  @IsOptional() @Transform(blankToNull) @IsUUID() projectId?: string | null;
}

/** Sent as multipart (with an optional "receipt" file) or JSON. */
export class SaveItemDto {
  @IsUUID() categoryId!: string;
  @Matches(DATE, { message: 'date must be YYYY-MM-DD' }) date!: string;
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(300) description!: string;
  @Transform(rupees) @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Amount must be a number with up to 2 decimals' }) @Min(1) @Max(10_000_000) amount!: number;
  /** Needed when the item goes over the category limit or monthly cap */
  @IsOptional() @Transform(blankToNull) @IsString() @MinLength(3, { message: 'Say why it goes over the limit' }) @MaxLength(300) overLimitReason?: string | null;
  /** Edit: drop the current receipt */
  @IsOptional() @Transform(({ obj }) => obj.removeReceipt === true || obj.removeReceipt === 'true') @IsBoolean() removeReceipt?: boolean;
}

export class AdjustmentDto {
  @IsUUID() itemId!: string;
  /** Rupees to reimburse for this item (≤ claimed) */
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) approvedAmount!: number;
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(300) reason!: string;
}

export class RejectItemDto {
  @IsUUID() itemId!: string;
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(300) reason!: string;
}

export class DecideClaimDto {
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(500) note?: string | null;
  /** Any step: don't pay these items at all (the rest is approved) */
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => RejectItemDto) rejectItems?: RejectItemDto[];
  /** Finance / HR only: pay less for some items */
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => AdjustmentDto) adjustments?: AdjustmentDto[];
}

export class BulkApproveDto {
  @IsArray() @ArrayMaxSize(50) @IsUUID('all', { each: true }) ids!: string[];
}

export class CommentDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(1000) body!: string;
}

export class RejectClaimDto {
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}

export class PayClaimDto {
  @Matches(DATE, { message: 'paymentDate must be YYYY-MM-DD' }) paymentDate!: string;
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(100) reference!: string;
}

export class ClaimQueryDto {
  /** mine | review (waiting for me) | all (everyone I can see) | payable (approved, not paid) */
  @IsIn(['mine', 'review', 'all', 'payable']) view!: 'mine' | 'review' | 'all' | 'payable';
  @IsOptional() @IsIn(['DRAFT', 'PENDING', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED']) status?: string;
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional() @IsUUID() projectId?: string;
  /** mine: needs_me (sent back or a question to answer) · review: asked (my open questions) */
  @IsOptional() @IsIn(['needs_me', 'asked']) filter?: 'needs_me' | 'asked';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class ReportQueryDto {
  @Matches(DATE) from!: string;
  @Matches(DATE) to!: string;
}

export const REPORT_BREAKDOWNS = ['category', 'employee', 'project', 'department'] as const;

/** "See all" for one breakdown of the report, a page at a time. */
export class BreakdownQueryDto extends ReportQueryDto {
  @IsIn(REPORT_BREAKDOWNS) by!: (typeof REPORT_BREAKDOWNS)[number];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
