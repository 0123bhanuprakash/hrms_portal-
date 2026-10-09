import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

export class SaveOrgLevelDto {
  @ApiProperty({ example: 'Team Lead' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name!: string;

  @ApiPropertyOptional({ example: '#6366F1' })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Colour must be a hex value like #6366F1' })
  color?: string;
}

export class ReorderOrgLevelsDto {
  @ApiProperty({ type: [String], description: 'Level ids from MOST senior to least senior' })
  @IsArray()
  @ArrayMaxSize(30)
  @IsUUID('all', { each: true })
  ids!: string[];
}

export class ReportingLineDto {
  @ApiProperty()
  @IsUUID()
  employeeId!: string;

  @ApiPropertyOptional({ nullable: true, description: 'New reporting manager; null = top of the chart' })
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  managerId!: string | null;
}

const ids = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.split(',').map((x) => x.trim()).filter(Boolean) : value);
const flag = ({ value }: { value: unknown }) => value === true || value === 'true' || value === '1';

/**
 * People pickers search on the server: 20 matches at a time (at most 50),
 * or exactly the people asked for by id (to show who is already chosen).
 */
export class PeopleQueryDto {
  @IsOptional() @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @MaxLength(80) search?: string;
  /** Employee ids (comma separated) */
  @IsOptional() @Transform(ids) @IsArray() @ArrayMaxSize(50) @IsUUID('all', { each: true }) ids?: string[];
  /** User ids (comma separated) — for pickers that store a sign-in, not an employee */
  @IsOptional() @Transform(ids) @IsArray() @ArrayMaxSize(50) @IsUUID('all', { each: true }) userIds?: string[];
  /** Only people with someone reporting to them, most reports first */
  @IsOptional() @Transform(flag) @IsBoolean() managers?: boolean;
  @IsOptional() @IsUUID() exclude?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}
