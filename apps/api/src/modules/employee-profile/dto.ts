import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
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
  ValidateNested,
} from 'class-validator';
import { Gender, TaxRegime } from '@prisma/client';

/** '' → null (clear the field), trims strings. */
const blankToNull = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);
/** Same, upper-cased and without spaces (PAN, IFSC, Aadhaar "1234 5678 9012"). */
const compactUpper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\s+/g, '').toUpperCase() || null : value;

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export const MARITAL_STATUSES = ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'OTHER'] as const;
export const DOCUMENT_CATEGORIES = [
  'ID_PROOF',
  'ADDRESS_PROOF',
  'EDUCATION',
  'EMPLOYMENT',
  'OFFER_LETTER',
  'CONTRACT',
  'OTHER',
] as const;

export class AddressDto {
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(120) line1?: string | null;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(120) line2?: string | null;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(60) city?: string | null;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(60) state?: string | null;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(12) postalCode?: string | null;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(60) country?: string | null;
}

/** Personal details. Omitted = unchanged, null / '' = cleared. */
export class UpdatePersonalDto {
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(40) phone?: string | null;
  @IsOptional() @IsEnum(Gender) gender?: Gender | null;
  @IsOptional() @Transform(blankToNull) @IsDateString() dateOfBirth?: string | null;
  @IsOptional() @IsBoolean() showBirthday?: boolean;

  @IsOptional() @Transform(blankToNull) @IsEmail() @MaxLength(200) personalEmail?: string | null;
  @IsOptional() @Transform(blankToNull) @IsIn(BLOOD_GROUPS) bloodGroup?: string | null;
  @IsOptional() @Transform(blankToNull) @IsIn(MARITAL_STATUSES) maritalStatus?: string | null;
  @IsOptional() @ValidateNested() @Type(() => AddressDto) currentAddress?: AddressDto | null;
  @IsOptional() @ValidateNested() @Type(() => AddressDto) permanentAddress?: AddressDto | null;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(100) emergencyContactName?: string | null;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(40) emergencyContactRelation?: string | null;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(40) emergencyContactPhone?: string | null;
}

export class UpdateBankDto {
  @Transform(blankToNull) @IsString() @MinLength(2) @MaxLength(100) accountHolderName!: string;

  @Transform(compactUpper)
  @Matches(/^\d{9,18}$/, { message: 'Account number must be 9–18 digits' })
  accountNumber!: string;

  @Transform(compactUpper)
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, { message: 'IFSC must look like ABCD0123456' })
  ifscCode!: string;

  @Transform(blankToNull) @IsString() @MinLength(2) @MaxLength(100) bankName!: string;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(100) branchName?: string | null;
}

/** Government IDs. Omitted = unchanged, null / '' = cleared. */
export class UpdateStatutoryDto {
  @IsOptional()
  @Transform(compactUpper)
  @Matches(/^[A-Z]{5}\d{4}[A-Z]$/, { message: 'PAN must look like ABCDE1234F' })
  pan?: string | null;

  /** The full 12-digit number (or just the last 4) — only the last 4 digits are stored. */
  @IsOptional()
  @Transform(compactUpper)
  @Matches(/^(\d{12}|\d{4})$/, { message: 'Aadhaar must be 12 digits (only the last 4 are kept)' })
  aadhaar?: string | null;

  @IsOptional() @Transform(compactUpper) @Matches(/^\d{12}$/, { message: 'UAN must be 12 digits' }) uan?: string | null;
  @IsOptional() @Transform(compactUpper) @Matches(/^(\d{10}|\d{17})$/, { message: 'ESIC number must be 10 or 17 digits' }) esicNumber?: string | null;
  @IsOptional() @Transform(compactUpper) @Matches(/^[A-Z0-9/]{5,30}$/, { message: 'PF account number looks invalid' }) pfAccountNo?: string | null;
  @IsOptional() @IsEnum(TaxRegime) taxRegime?: TaxRegime;
}

export class UploadDocumentDto {
  @IsIn(DOCUMENT_CATEGORIES) category!: (typeof DOCUMENT_CATEGORIES)[number];
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(120) name?: string | null;
}

export class DirectoryQueryDto {
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
