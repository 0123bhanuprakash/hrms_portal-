import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

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
