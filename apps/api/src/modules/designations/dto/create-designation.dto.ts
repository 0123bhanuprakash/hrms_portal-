import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';

export class CreateDesignationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  level?: number;
}
