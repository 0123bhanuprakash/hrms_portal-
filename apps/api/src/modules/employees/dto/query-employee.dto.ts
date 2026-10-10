import { IsOptional, IsString, IsEnum, IsUUID, IsInt, Min, Max, IsIn, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { EmploymentStatus, EmploymentType } from '@prisma/client';

export class QueryEmployeesDto {
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

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  designationId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsEnum(EmploymentStatus)
  status?: EmploymentStatus;

  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  /** Lifecycle stage; default = everyone who hasn't left */
  @IsOptional()
  @IsIn(['current', 'all', 'joining', 'probation', 'active', 'notice', 'left'])
  stage?: 'current' | 'all' | 'joining' | 'probation' | 'active' | 'notice' | 'left';

  /** Direct reports of this manager, or "none" for people without a manager */
  @IsOptional()
  @Matches(/^(none|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i, { message: 'managerId must be an id or "none"' })
  managerId?: string;

  @IsOptional()
  @IsIn(['recent', 'name', 'joined', 'joined_desc', 'probation', 'internship', 'last_day'])
  sort?: 'recent' | 'name' | 'joined' | 'joined_desc' | 'probation' | 'internship' | 'last_day';
}
