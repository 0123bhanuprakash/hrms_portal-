import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import { TicketPriority, TicketQueue, TicketStatus } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const blankToNull = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);
/** Multipart sends booleans as strings */
const bool = ({ value }: { value: unknown }) => value === true || value === 'true';

export const QUESTION_KINDS = ['text', 'choice', 'device'] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];

/** One extra question a topic asks when a ticket is raised. */
export class TopicQuestionDto {
  /** Stable key so answers survive edits of the label */
  @IsString() @Matches(/^[a-z0-9-]{1,24}$/) id!: string;
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(80) label!: string;
  @IsIn(QUESTION_KINDS) kind!: QuestionKind;
  /** Choice questions: 2–10 options */
  @ValidateIf((q: TopicQuestionDto) => q.kind === 'choice')
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(10) @ArrayUnique() @IsString({ each: true }) @MinLength(1, { each: true }) @MaxLength(40, { each: true })
  options?: string[];
  @IsBoolean() required!: boolean;
}

export class SaveCategoryDto {
  @IsEnum(TicketQueue) queue!: TicketQueue;
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(60) name!: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(1000) sortOrder?: number;
  /** One emoji (or a short symbol) */
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(16) icon?: string | null;
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(120) description?: string | null;
  @IsOptional() @IsEnum(TicketPriority) defaultPriority?: TicketPriority | null;
  /** New tickets go straight to this person (null = the team head / team) */
  @IsOptional() @IsUUID() routeToId?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @ValidateNested({ each: true }) @Type(() => TopicQuestionDto) questions?: TopicQuestionDto[];
  @IsOptional() @Transform(blankToNull) @IsString() @MaxLength(1000) quickAnswer?: string | null;
}

export class ReorderCategoriesDto {
  @IsEnum(TicketQueue) queue!: TicketQueue;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ArrayUnique() @IsUUID('all', { each: true }) ids!: string[];
}

export class AnswersQueryDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(100) q!: string;
}

/** Sent as multipart (optional `file`) */
export class CreateTicketDto {
  @IsEnum(TicketQueue) queue!: TicketQueue;
  @IsOptional() @Transform(blankToNull) @IsUUID() categoryId?: string | null;
  @Transform(trim) @IsString() @MinLength(5) @MaxLength(150) subject!: string;
  @Transform(trim) @IsString() @MinLength(10) @MaxLength(5000) description!: string;
  /** Employees choose up to High; agents can raise it to Urgent (a topic may start at Urgent) */
  @IsOptional() @IsIn(['LOW', 'MEDIUM', 'HIGH']) priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  /** The topic's questions, answered: JSON object { questionId: answer } (multipart sends it as a string) */
  @IsOptional() @IsString() @MaxLength(4000) answers?: string;
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

export class SaveTeamDto {
  /** null = no head (anyone in the queue takes tickets) */
  @IsOptional() @IsUUID() headId?: string | null;
  @IsOptional() @IsUUID() backupId?: string | null;
}

/** Queue → tick several tickets → one action. Each ticket goes through the same checks as on its own. */
export class BulkTicketsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ArrayUnique() @IsUUID('all', { each: true }) ids!: string[];
  @IsIn(['assign', 'priority', 'move']) action!: 'assign' | 'priority' | 'move';
  /** assign: a person in the queue, or null to unassign */
  @ValidateIf((d: BulkTicketsDto) => d.action === 'assign') @IsOptional() @IsUUID() assigneeId?: string | null;
  @ValidateIf((d: BulkTicketsDto) => d.action === 'priority') @IsEnum(TicketPriority) priority?: TicketPriority;
  @ValidateIf((d: BulkTicketsDto) => d.action === 'move') @IsEnum(TicketQueue) queue?: TicketQueue;
}
