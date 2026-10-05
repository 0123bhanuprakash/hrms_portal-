import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { EXIT_REASONS, type ExitReason } from '../lifecycle.service';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class NoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ExtendProbationDto extends NoteDto {
  @Matches(DATE, { message: 'until must be YYYY-MM-DD' })
  until!: string;
}

export class StartNoticeDto extends NoteDto {
  @Matches(DATE, { message: 'lastDay must be YYYY-MM-DD' })
  lastDay!: string;

  @IsIn(EXIT_REASONS)
  reason!: ExitReason;
}

export class MarkLeftDto extends NoteDto {
  @IsOptional()
  @Matches(DATE, { message: 'lastDay must be YYYY-MM-DD' })
  lastDay?: string;

  @IsOptional()
  @IsIn(EXIT_REASONS)
  reason?: ExitReason;
}

export class ChecklistQueryDto {
  @IsIn(['joining', 'exit'])
  kind!: 'joining' | 'exit';
}

export class TickChecklistDto {
  @IsBoolean()
  done!: boolean;
}

export class AddChecklistItemDto {
  @IsIn(['joining', 'exit'])
  kind!: 'joining' | 'exit';

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  label!: string;
}

export class BulkEmployeesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  ids!: string[];

  @IsIn(['manager', 'department', 'location', 'remind'])
  action!: 'manager' | 'department' | 'location' | 'remind';

  /** New manager / department / location id; null clears it */
  @IsOptional()
  @IsUUID()
  value?: string | null;
}
