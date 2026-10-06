import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';

const HEX = /^#[0-9A-Fa-f]{6}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class SeasonColorsDto {
  @Matches(HEX) main!: string;
  @Matches(HEX) accent!: string;
  @Matches(HEX) deep!: string;
}

export class SaveSeasonDto {
  @ApiPropertyOptional({ description: 'Ready-made key, e.g. diwali, new_year' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  preset?: string;

  @ApiProperty({ example: 'Diwali glow' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name!: string;

  @ApiProperty({ example: '🪔' })
  @IsString()
  @MinLength(1)
  @MaxLength(16)
  emoji!: string;

  @ApiProperty({ example: '2026-11-05' })
  @Matches(DAY, { message: 'startsOn must be YYYY-MM-DD' })
  startsOn!: string;

  @ApiProperty({ example: '2026-11-11' })
  @Matches(DAY, { message: 'endsOn must be YYYY-MM-DD' })
  endsOn!: string;

  @IsOptional()
  @IsBoolean()
  everyYear?: boolean;

  @ValidateNested()
  @Type(() => SeasonColorsDto)
  colors!: SeasonColorsDto;

  @IsString()
  @MaxLength(20)
  decoration!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  greeting?: string;

  @IsOptional()
  @IsBoolean()
  onSignIn?: boolean;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateSeasonDto extends PartialType(SaveSeasonDto) {}
