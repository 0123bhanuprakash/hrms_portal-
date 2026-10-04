import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CompanyStatus } from '@prisma/client';

export const COMPANY_SORT_FIELDS = ['createdAt', 'name', 'status', 'health', 'employees', 'lastActivity'] as const;
export type CompanySortField = (typeof COMPANY_SORT_FIELDS)[number];

export class QueryCompaniesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  /** Matches name, slug or email (case-insensitive) */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;

  @IsOptional()
  @IsIn(COMPANY_SORT_FIELDS)
  sortBy?: CompanySortField;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
