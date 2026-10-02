import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

/** One CSV row, as text. Validation happens per row in the service so every problem is reported, not just the first. */
export class ImportRowDto {
  @IsOptional() @IsString() @MaxLength(100) firstName?: string;
  @IsOptional() @IsString() @MaxLength(100) lastName?: string;
  @IsOptional() @IsString() @MaxLength(200) email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @ApiPropertyOptional({ example: '2026-04-01', description: 'YYYY-MM-DD or DD/MM/YYYY' })
  @IsOptional() @IsString() @MaxLength(20) joiningDate?: string;
  @ApiPropertyOptional({ example: 'FULL_TIME' })
  @IsOptional() @IsString() @MaxLength(20) employmentType?: string;
  @ApiPropertyOptional({ description: 'Department name or code' })
  @IsOptional() @IsString() @MaxLength(100) department?: string;
  @ApiPropertyOptional({ description: 'Job title (designation) name' })
  @IsOptional() @IsString() @MaxLength(100) designation?: string;
  @ApiPropertyOptional({ description: 'Location name' })
  @IsOptional() @IsString() @MaxLength(100) location?: string;
  @ApiPropertyOptional({ description: "Manager's work email (existing employee or another row)" })
  @IsOptional() @IsString() @MaxLength(200) managerEmail?: string;
}

export class ImportEmployeesDto {
  @ApiProperty({ type: [ImportRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500, { message: 'Import at most 500 rows at a time' })
  @ValidateNested({ each: true })
  @Type(() => ImportRowDto)
  rows!: ImportRowDto[];

  @ApiPropertyOptional({ description: 'Send each person a welcome email with a temporary password (default true)' })
  @IsOptional()
  @IsBoolean()
  sendInvites?: boolean;
}
