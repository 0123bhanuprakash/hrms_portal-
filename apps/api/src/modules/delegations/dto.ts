import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

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

  @ApiPropertyOptional({ example: 'Annual leave' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
