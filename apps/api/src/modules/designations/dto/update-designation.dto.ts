import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class UpdateDesignationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  level?: number;
}
