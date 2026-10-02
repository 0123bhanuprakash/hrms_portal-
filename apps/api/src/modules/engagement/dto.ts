import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
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
} from 'class-validator';
import { AnnouncementAudience } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const blankToNull = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);

export class SaveAnnouncementDto {
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(150) title!: string;
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(5000) body!: string;
  @IsEnum(AnnouncementAudience) audience!: AnnouncementAudience;
  @IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(50) @IsUUID('all', { each: true }) departmentIds?: string[];
  @IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(50) @IsUUID('all', { each: true }) locationIds?: string[];
  @IsOptional() @IsBoolean() pinned?: boolean;
  @IsOptional() @IsBoolean() requiresAck?: boolean;
  /** Poster's choice: also email everyone in the audience */
  @IsOptional() @IsBoolean() sendEmail?: boolean;
  @IsOptional() @Transform(blankToNull) @IsDateString() expiresAt?: string | null;
}

export class AnnouncementQueryDto {
  /** unread | ack (still needs my acknowledgement) */
  @IsOptional() @IsIn(['all', 'unread', 'ack']) filter?: 'all' | 'unread' | 'ack';
  /** Posters: include expired posts */
  @IsOptional() @Transform(({ obj }) => obj.includeExpired === true || obj.includeExpired === 'true') @IsBoolean() includeExpired?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}

export const KUDOS_REACTIONS = ['👏', '🎉', '❤️', '🔥', '🙌'] as const;

export class GiveKudosDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @ArrayUnique() @IsUUID('all', { each: true }) recipientIds!: string[];
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(500) message!: string;
  @IsOptional() @IsUUID() valueId?: string | null;
}

export class KudosQueryDto {
  /** Kudos received by this employee */
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}

export class ReactDto {
  @IsIn(KUDOS_REACTIONS) emoji!: (typeof KUDOS_REACTIONS)[number];
}

export class SaveKudosValueDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(40) name!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(8) emoji!: string;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(200) description?: string | null;
  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/) color?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(1000) sortOrder?: number;
}
