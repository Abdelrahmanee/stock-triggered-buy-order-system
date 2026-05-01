import { IsNumber, IsString, Min } from 'class-validator';

export class CreateBuyOrderDto {
  @IsString()
  symbol: string;

  @IsNumber()
  @Min(0.01)
  targetPrice: number;

  @IsNumber()
  @Min(1)
  quantity: number;
}
