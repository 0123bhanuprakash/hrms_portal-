import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CreateCompanyAdminDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;
}
