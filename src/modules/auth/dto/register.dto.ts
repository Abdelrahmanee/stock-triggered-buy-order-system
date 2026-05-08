import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).+$/, {
    message: 'Password must have uppercase, lowercase, number, and special character',
  })
  password: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  walletBalance?: number;
}
