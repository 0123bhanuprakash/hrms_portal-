import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { AssetCondition, AssetRequestStatus, AssetStatus } from '@prisma/client';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const blankToNull = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);
const ICONS = ['laptop', 'monitor', 'phone', 'idcard', 'headset', 'keyboard', 'sim', 'box'];

export class SaveAssetTypeDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(40) name!: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9]{2,6}$/, { message: 'Prefix must be 2–6 letters or digits' })
  prefix!: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(1000) sortOrder?: number;
  @IsOptional() @IsIn(ICONS) icon?: string;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(200) description?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(120) warrantyMonths?: number | null;
  @IsOptional() @IsInt() @Min(1) @Max(20) replaceAfterYears?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(1000) minStock?: number;
  @IsOptional() @IsBoolean() requestable?: boolean;
  @IsOptional() @IsBoolean() loanable?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(365) maxLoanDays?: number | null;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(40, { each: true }) fields?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(80, { each: true }) checklist?: string[];
}

export class SaveAssetDto {
  @IsUUID() typeId!: string;
  /** Blank = generated from the type prefix (LAP-0001) */
  @IsOptional() @Transform(blankToNull) @Matches(/^[A-Za-z0-9-]{2,30}$/, { message: 'Tag: 2–30 letters, digits or dashes' }) tag?: string | null;
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(60) brand?: string | null;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(60) model?: string | null;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(80) serialNumber?: string | null;
  @IsOptional() @Transform(blankToNull) @Matches(DATE) purchaseDate?: string | null;
  /** Rupees */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100_000_000) purchaseCost?: number | null;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(100) vendor?: string | null;
  /** Blank = purchase date + the type's default warranty */
  @IsOptional() @Transform(blankToNull) @Matches(DATE) warrantyUntil?: string | null;
  @IsOptional() @IsEnum(AssetCondition) condition?: AssetCondition;
  @IsOptional() @Transform(blankToNull) @IsUUID() locationId?: string | null;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(500) notes?: string | null;
  /** Values for the type's extra fields */
  @IsOptional() @IsObject() specs?: Record<string, string> | null;
}

export class AssetQueryDto {
  @IsOptional() @IsEnum(AssetStatus) status?: AssetStatus;
  @IsOptional() @IsUUID() typeId?: string;
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional() @IsUUID() locationId?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) search?: string;
  /** Warranty ends within N days */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(3650) warrantyWithinDays?: number;
  /** Needs attention: warranty | repair | old | unconfirmed | loans */
  @IsOptional() @IsIn(['warranty', 'repair', 'old', 'unconfirmed', 'loans']) attention?: 'warranty' | 'repair' | 'old' | 'unconfirmed' | 'loans';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class PeopleQueryDto {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class AssignAssetDto {
  @IsUUID() employeeId!: string;
  @IsOptional() @IsEnum(AssetCondition) condition?: AssetCondition;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(500) notes?: string | null;
  /** Hand-over for an approved request */
  @IsOptional() @IsUUID() requestId?: string;
  /** Checklist items IT ticked */
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) checklist?: string[];
  /** A loan without a request */
  @IsOptional() @Transform(blankToNull) @Matches(DATE) dueBack?: string | null;
}

export class ReturnAssetDto {
  @IsEnum(AssetCondition) condition!: AssetCondition;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(500) notes?: string | null;
}

export class SetStatusDto {
  @IsIn(['AVAILABLE', 'IN_REPAIR', 'LOST', 'RETIRED']) status!: 'AVAILABLE' | 'IN_REPAIR' | 'LOST' | 'RETIRED';
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(500) notes?: string | null;
  /** Sending for repair: what's wrong, and who fixes it */
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(300) issue?: string | null;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(100) vendor?: string | null;
  /** Back from repair: what it cost (rupees) */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(10_000_000) repairCost?: number | null;
}

export class BulkMoveDto {
  @IsArray() @ArrayMaxSize(200) @IsUUID('all', { each: true }) ids!: string[];
  @IsOptional() @Transform(blankToNull) @IsUUID() locationId?: string | null;
}

export class ImportAssetsDto {
  /** CSV: type,name,tag,brand,model,serial,purchase date,cost,vendor,warranty until */
  @IsString() @MinLength(5) @MaxLength(500_000) csv!: string;
  /** Only check, don't save */
  @IsOptional() @IsBoolean() dryRun?: boolean;
}

export class ReportProblemDto {
  @Transform(trim) @IsString() @MinLength(10) @MaxLength(2000) description!: string;
}

export class ReturnRequestDto {
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(500) note?: string | null;
}

export class CreateRequestDto {
  @IsUUID() typeId!: string;
  @Transform(trim) @IsString() @MinLength(5) @MaxLength(500) reason!: string;
  /** A manager asking for someone in their team */
  @IsOptional() @Transform(blankToNull) @IsUUID() forEmployeeId?: string | null;
  @IsOptional() @IsIn(['KEEP', 'LOAN']) kind?: 'KEEP' | 'LOAN';
  @IsOptional() @Transform(blankToNull) @Matches(DATE) loanFrom?: string | null;
  @IsOptional() @Transform(blankToNull) @Matches(DATE) loanUntil?: string | null;
  @IsOptional() @Transform(blankToNull) @Matches(DATE) neededBy?: string | null;
}

export class RequestPreviewQueryDto {
  @IsOptional() @IsUUID() forEmployeeId?: string;
}

export class RequestQueryDto {
  /** mine | review (waiting for me) | all | fulfil (approved, waiting for IT) | joiners (starter kits) */
  @IsIn(['mine', 'review', 'all', 'fulfil', 'joiners']) view!: 'mine' | 'review' | 'all' | 'fulfil' | 'joiners';
  @IsOptional() @IsEnum(AssetRequestStatus) status?: AssetRequestStatus;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class DecideRequestDto {
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(500) note?: string | null;
}

export class RejectRequestDto {
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}

export class KitItemDto {
  @IsUUID() typeId!: string;
  @IsInt() @Min(1) @Max(5) qty!: number;
}

export class SaveKitRuleDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(60) name!: string;
  @IsOptional() @IsBoolean() isBase?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) roleKeys?: string[];
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(60) designationContains?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsUUID('all', { each: true }) departmentIds?: string[];
  @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => KitItemDto) items!: KitItemDto[];
  @IsOptional() @IsBoolean() onPromotion?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(1000) sortOrder?: number;
}

export class KitPreviewQueryDto {
  @IsOptional() @IsUUID() designationId?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  /** Comma-separated role keys */
  @IsOptional() @IsString() @MaxLength(400) roleKeys?: string;
}

export class StartCheckDto {
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(80) name!: string;
  @Matches(DATE) dueOn!: string;
}

export class CheckAnswerDto {
  @IsUUID() assignmentId!: string;
  @IsIn(['HAVE', 'PROBLEM', 'NOT_WITH_ME']) answer!: 'HAVE' | 'PROBLEM' | 'NOT_WITH_ME';
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(500) note?: string | null;
}

export class CheckAnswersDto {
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => CheckAnswerDto) answers!: CheckAnswerDto[];
}
