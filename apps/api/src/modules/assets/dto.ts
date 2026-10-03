import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AssetCondition, AssetRequestStatus, AssetStatus } from '@prisma/client';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const blankToNull = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);

export class SaveAssetTypeDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(40) name!: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9]{2,6}$/, { message: 'Prefix must be 2–6 letters or digits' })
  prefix!: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(1000) sortOrder?: number;
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
  @IsOptional() @Transform(blankToNull) @Matches(DATE) warrantyUntil?: string | null;
  @IsOptional() @IsEnum(AssetCondition) condition?: AssetCondition;
  @IsOptional() @Transform(blankToNull) @IsUUID() locationId?: string | null;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(500) notes?: string | null;
}

export class AssetQueryDto {
  @IsOptional() @IsEnum(AssetStatus) status?: AssetStatus;
  @IsOptional() @IsUUID() typeId?: string;
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) search?: string;
  /** Warranty ends within N days */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(3650) warrantyWithinDays?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class AssignAssetDto {
  @IsUUID() employeeId!: string;
  @IsOptional() @IsEnum(AssetCondition) condition?: AssetCondition;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(500) notes?: string | null;
  /** Hand-over for an approved request */
  @IsOptional() @IsUUID() requestId?: string;
}

export class ReturnAssetDto {
  @IsEnum(AssetCondition) condition!: AssetCondition;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(500) notes?: string | null;
}

export class SetStatusDto {
  @IsIn(['AVAILABLE', 'IN_REPAIR', 'LOST', 'RETIRED']) status!: 'AVAILABLE' | 'IN_REPAIR' | 'LOST' | 'RETIRED';
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(500) notes?: string | null;
}

export class CreateRequestDto {
  @IsUUID() typeId!: string;
  @Transform(trim) @IsString() @MinLength(5) @MaxLength(500) reason!: string;
}

export class RequestQueryDto {
  /** mine | review (waiting for me) | all | fulfil (approved, waiting for IT) */
  @IsIn(['mine', 'review', 'all', 'fulfil']) view!: 'mine' | 'review' | 'all' | 'fulfil';
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
