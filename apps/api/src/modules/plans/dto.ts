import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SavePlanDto {
  @ApiProperty({ example: 'Growth' })
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  name!: string;

  @ApiPropertyOptional({ example: 'growth', description: 'Stable identifier; generated from the name when omitted (create only)' })
  @IsOptional()
  @Matches(/^[a-z0-9-]{2,40}$/, { message: 'Key: lowercase letters, numbers and hyphens' })
  key?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiProperty({ type: [String], example: ['people.directory', 'time.leave'] })
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  features!: string[];

  @ApiPropertyOptional({ example: { maxEmployees: 50 }, description: 'null = unlimited' })
  @IsOptional()
  @IsObject()
  limits?: Record<string, number | null>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SetCompanyPlanDto {
  @ApiProperty()
  @IsUUID()
  planId!: string;
}

export class FeatureOverrideDto {
  @ApiProperty({ enum: ['ON', 'OFF'] })
  @IsIn(['ON', 'OFF'])
  mode!: 'ON' | 'OFF';

  @ApiPropertyOptional({ example: 'Payroll trial' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;

  @ApiPropertyOptional({ description: 'Override lapses at this moment (ISO date) — e.g. a trial' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class CompanyLimitsDto {
  @ApiProperty({ example: { maxEmployees: 800 }, description: 'Full set of company overrides; {} = use the plan. null value = unlimited' })
  @IsObject()
  limits!: Record<string, number | null>;
}

export class PlanImpactDto {
  @ApiProperty({ type: [String], description: 'The features the plan would have' })
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  features!: string[];

  @ApiPropertyOptional({ example: { maxEmployees: 50 }, description: 'The limits the plan would have (null = unlimited)' })
  @IsOptional()
  @IsObject()
  limits?: Record<string, number | null>;
}
