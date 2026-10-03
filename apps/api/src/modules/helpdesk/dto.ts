import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { TicketPriority, TicketQueue, TicketStatus } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const blankToNull = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);
/** Multipart sends booleans as strings */
const bool = ({ value }: { value: unknown }) => value === true || value === 'true';

export class SaveCategoryDto {
  @IsEnum(TicketQueue) queue!: TicketQueue;
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(60) name!: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(1000) sortOrder?: number;
}

/** Sent as multipart (optional `file`) */
export class CreateTicketDto {
  @IsEnum(TicketQueue) queue!: TicketQueue;
  @IsOptional() @Transform(blankToNull) @IsUUID() categoryId?: string | null;
  @Transform(trim) @IsString() @MinLength(5) @MaxLength(150) subject!: string;
  @Transform(trim) @IsString() @MinLength(10) @MaxLength(5000) description!: string;
  /** Employees choose up to High; agents can raise it to Urgent */
  @IsOptional() @IsIn(['LOW', 'MEDIUM', 'HIGH']) priority?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export class TicketQueryDto {
  /** mine = tickets I raised; queue = tickets in queues I work */
  @IsIn(['mine', 'queue']) view!: 'mine' | 'queue';
  @IsOptional() @IsEnum(TicketQueue) queue?: TicketQueue;
  /** A status, or "active" (open / in progress / waiting) */
  @IsOptional() @IsIn([...Object.values(TicketStatus), 'active']) status?: TicketStatus | 'active';
  /** "me", "unassigned" or a user id */
  @IsOptional() @IsString() @MaxLength(40) assignee?: string;
  @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;
  @IsOptional() @IsIn(['true', 'false']) overdue?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

/** Sent as multipart (optional `file`) */
export class MessageDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(5000) body!: string;
  /** Internal note (agents only) */
  @IsOptional() @Transform(bool) @IsBoolean() internal?: boolean;
  /** Agent replies: also ask the employee for information (status → Waiting) */
  @IsOptional() @Transform(bool) @IsBoolean() waitForEmployee?: boolean;
}

export class AssignDto {
  /** null = unassign */
  @IsOptional() @IsUUID() assigneeId?: string | null;
}

export class UpdateTicketDto {
  @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;
  @IsOptional() @Transform(blankToNull) @IsUUID() categoryId?: string | null;
  /** Move to another team's queue (clears the assignee) */
  @IsOptional() @IsEnum(TicketQueue) queue?: TicketQueue;
}

export class ResolveDto {
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(5000) resolution!: string;
}

export class ReopenDto {
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(2000) reason!: string;
}

export class CloseDto {
  @IsOptional() @IsInt() @Min(1) @Max(5) rating?: number;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(1000) comment?: string | null;
}

export class SummaryQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(7) @Max(365) days?: number;
}
