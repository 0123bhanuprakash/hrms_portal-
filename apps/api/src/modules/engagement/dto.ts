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

export const ANNOUNCEMENT_REACTIONS = ['👍', '❤️', '🎉', '🙏', '👏', '👋'] as const;
export const COVER_SCENES = ['confetti', 'diyas', 'sparkles', 'aurora', 'snow', 'balloons', 'fireworks', 'rain'] as const;
export const COVER_ART = ['megaphone', 'calendar', 'trophy', 'rocket', 'party', 'shield', 'cake', 'heart', 'gift', 'bulb', 'star', 'bell', 'laptop', 'diya', 'handshake', 'book'] as const;
export const ANNOUNCEMENT_CATEGORIES = ['policy', 'event', 'celebrate', 'update', 'urgent'] as const;
export const ANNOUNCEMENT_COVERS = ['indigo', 'teal', 'sunset', 'sky', 'rose', 'slate'] as const;

/** Who a post goes to (also used to preview the count before posting). */
export class AnnouncementAudienceDto {
  @IsEnum(AnnouncementAudience) audience!: AnnouncementAudience;
  @IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(50) @IsUUID('all', { each: true }) departmentIds?: string[];
  @IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(50) @IsUUID('all', { each: true }) locationIds?: string[];
}

export class SaveAnnouncementDto extends AnnouncementAudienceDto {
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(150) title!: string;
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(5000) body!: string;
  @IsOptional() @IsIn(ANNOUNCEMENT_CATEGORIES) category?: (typeof ANNOUNCEMENT_CATEGORIES)[number];
  @IsOptional() @Transform(blankToNull) @IsIn([...ANNOUNCEMENT_COVERS, null]) cover?: (typeof ANNOUNCEMENT_COVERS)[number] | null;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(8) coverEmoji?: string | null;
  @IsOptional() @Transform(blankToNull) @IsIn([...COVER_SCENES, null]) coverScene?: (typeof COVER_SCENES)[number] | null;
  @IsOptional() @Transform(blankToNull) @IsIn([...COVER_ART, null]) coverArt?: (typeof COVER_ART)[number] | null;
  @IsOptional() @IsIn(['off', 'gentle', 'lively']) coverMotion?: 'off' | 'gentle' | 'lively';
  @IsOptional() @IsInt() @Min(0) @Max(100) coverFocusX?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) coverFocusY?: number;
  @IsOptional() @IsInt() @Min(0) @Max(70) coverDim?: number;
  @IsOptional() @IsBoolean() pinned?: boolean;
  @IsOptional() @IsBoolean() requiresAck?: boolean;
  /** Confirm by (YYYY-MM-DD); a reminder goes 2 days before */
  @IsOptional() @Transform(blankToNull) @Matches(/^\d{4}-\d{2}-\d{2}$/) ackDueAt?: string | null;
  /** Poster's choice: also email everyone in the audience */
  @IsOptional() @IsBoolean() sendEmail?: boolean;
  @IsOptional() @IsBoolean() allowReactions?: boolean;
  @IsOptional() @Transform(blankToNull) @IsDateString() eventAt?: string | null;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(120) eventPlace?: string | null;
  @IsOptional() @Transform(blankToNull) @IsDateString() expiresAt?: string | null;
  /** publish now (default), keep as a draft, or schedule for publishAt */
  @IsOptional() @IsIn(['publish', 'draft', 'schedule']) action?: 'publish' | 'draft' | 'schedule';
  @IsOptional() @Transform(blankToNull) @IsDateString() publishAt?: string | null;
}

export class AnnouncementQueryDto {
  /** unread | ack (still needs my acknowledgement) */
  @IsOptional() @IsIn(['all', 'unread', 'ack']) filter?: 'all' | 'unread' | 'ack';
  /** feed (default) or drafts (my drafts and scheduled posts) */
  @IsOptional() @IsIn(['feed', 'drafts']) view?: 'feed' | 'drafts';
  @IsOptional() @IsIn(ANNOUNCEMENT_CATEGORIES) category?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) search?: string;
  /** Posters: include expired posts */
  @IsOptional() @Transform(({ obj }) => obj.includeExpired === true || obj.includeExpired === 'true') @IsBoolean() includeExpired?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}

export class AnnouncementReactDto {
  @IsIn(ANNOUNCEMENT_REACTIONS) emoji!: (typeof ANNOUNCEMENT_REACTIONS)[number];
}

export class SeenDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ArrayUnique() @IsUUID('all', { each: true }) ids!: string[];
}

export class RsvpDto {
  @IsOptional() @IsIn(['going', 'maybe', 'no', null]) response!: 'going' | 'maybe' | 'no' | null;
}

export const KUDOS_REACTIONS = ['👏', '🎉', '❤️', '🔥', '🙌'] as const;

export class GiveKudosDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @ArrayUnique() @IsUUID('all', { each: true }) recipientIds!: string[];
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(500) message!: string;
  @IsOptional() @IsUUID() valueId?: string | null;
}

// ─── Celebration wishes (birthdays, work anniversaries — not kudos) ───

export const WISH_KINDS = ['birthday', 'anniversary'] as const;
export type WishKind = (typeof WISH_KINDS)[number];
export const WISH_STICKERS: Record<WishKind, readonly string[]> = {
  birthday: ['🎂', '🎉', '🥳', '🎈', '🎁', '💐'],
  anniversary: ['🏆', '🎉', '👏', '🌟', '🙌', '💐'],
};

export class SendWishDto {
  /** Today's birthday people can be wished together */
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ArrayUnique() @IsUUID('all', { each: true }) employeeIds!: string[];
  @IsIn(WISH_KINDS) kind!: WishKind;
  @IsString() @MaxLength(8) sticker!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(280) message?: string;
}

export class KudosQueryDto {
  /** Kudos received by this employee */
  @IsOptional() @IsUUID() employeeId?: string;
  /** for-me | from-me | team (my manager's team and my reports) */
  @IsOptional() @IsIn(['all', 'for-me', 'from-me', 'team']) filter?: 'all' | 'for-me' | 'from-me' | 'team';
  @IsOptional() @IsUUID() valueId?: string;
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

export class KudosInsightsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([1, 3, 6, 12]) months?: number;
}

export class KudosHintDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ArrayUnique() @IsUUID('all', { each: true }) employeeIds!: string[];
}
