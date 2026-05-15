import { IsEmail, IsString, MinLength } from 'class-validator';

export class InviteAdminDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  name: string;
}
