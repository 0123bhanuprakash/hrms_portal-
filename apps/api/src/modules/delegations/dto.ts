import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { DELEGABLE_PERMISSIONS } from '../access/catalog';

export class CreateDelegationDto {
  @ApiProperty({ description: 'User who covers the approvals' })
  @IsUUID()
  delegateId!: string;

  @ApiPropertyOptional({ description: 'Whose approvals (admins only; defaults to yourself)' })
  @IsOptional()
  @IsUUID()
  delegatorId?: string;

  @ApiPropertyOptional({ description: 'Defaults to now' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiProperty()
  @IsDateString()
  endsAt!: string;

  @ApiPropertyOptional({ description: 'Which approvals to hand over (default: all of them)', example: ['leave.approve'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsIn(DELEGABLE_PERMISSIONS, { each: true })
  permissions?: string[];

  @ApiPropertyOptional({ example: 'Annual leave' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

export class RangeQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to!: string;
}

export class PageQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
