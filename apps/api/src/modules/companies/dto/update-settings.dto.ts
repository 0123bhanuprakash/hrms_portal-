import { IsString, IsOptional, IsInt, Min, Max, Length } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @Length(2, 10)
  employeeIdPrefix?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  fiscalYearStart?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  workingDaysPerWeek?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  workingHoursPerDay?: number;
}
