import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class AcceptAdminInviteDto {
  @IsEmail()
  email: string;

  @IsString()
  temporaryPassword: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).+$/, {
    message: 'Password must have uppercase, lowercase, number, and special character',
  })
  newPassword: string;
}
