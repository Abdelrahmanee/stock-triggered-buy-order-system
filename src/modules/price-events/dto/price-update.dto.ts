import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { StockSource } from '../../../common/constants/stock-source.constant';

export class PriceUpdateDto {
  @IsString()
  symbol: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsEnum(StockSource)
  source?: StockSource;
}
