import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsUUID, ValidateIf } from 'class-validator';

export class CreateDesignationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  level?: number;

  /** Company org level this title sits at (null = none) */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  orgLevelId?: string | null;
}
