import { Injectable, NotImplementedException } from '@nestjs/common';
import {
  NormalizedPriceUpdate,
  StockPriceProvider,
} from './interfaces/stock-price-provider.interface';

@Injectable()
export class ExternalStockProviderService implements StockPriceProvider {
  async getCurrentPrice(_symbol: string): Promise<NormalizedPriceUpdate> {
    throw new NotImplementedException('External stock provider is not wired yet');
  }

  async syncTrackedSymbols(_symbols: string[]): Promise<NormalizedPriceUpdate[]> {
    throw new NotImplementedException('External stock provider is not wired yet');
  }
}
