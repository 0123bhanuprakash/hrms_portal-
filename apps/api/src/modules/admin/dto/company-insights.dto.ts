import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsEnum, IsIn, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { CompanyStatus } from '@prisma/client';
import { QueryCompaniesDto } from './query-companies.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** GET /admin/companies — adds plan, tag and health filters to the list. */
export class CompanyInsightsQueryDto extends QueryCompaniesDto {
  /** Plan key, e.g. "enterprise" */
  @IsOptional() @IsString() @MaxLength(50) plan?: string;
  @IsOptional() @IsString() @MaxLength(30) tag?: string;
  @IsOptional() @IsIn(['healthy', 'watch', 'at_risk']) health?: 'healthy' | 'watch' | 'at_risk';
}

/** PUT /admin/companies/:id/tags — replaces the company's tags. */
export class SetCompanyTagsDto {
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(1, 30, { each: true })
  tags!: string[];
}

/** POST /admin/companies/:id/notes */
export class AddCompanyNoteDto {
  @Transform(trim) @IsString() @Length(1, 2000) body!: string;
}

/** POST /admin/companies/bulk */
export class BulkCompaniesDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @IsUUID('all', { each: true }) ids!: string[];
  @IsIn(['status', 'plan', 'addTag', 'removeTag']) action!: 'status' | 'plan' | 'addTag' | 'removeTag';
  @IsOptional() @IsEnum(CompanyStatus) status?: CompanyStatus;
  @IsOptional() @IsString() @Length(0, 500) reason?: string;
  @IsOptional() @IsUUID() planId?: string;
  @IsOptional() @Transform(trim) @IsString() @Length(1, 30) tag?: string;
}
