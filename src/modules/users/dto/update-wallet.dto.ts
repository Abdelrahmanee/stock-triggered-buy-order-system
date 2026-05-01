import { IsNumber, Min } from 'class-validator';

export class UpdateWalletDto {
  @IsNumber()
  @Min(0.01)
  amount: number;
}
