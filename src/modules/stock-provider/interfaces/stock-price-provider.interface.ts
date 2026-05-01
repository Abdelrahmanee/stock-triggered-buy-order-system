import { StockSource } from '../../../common/constants/stock-source.constant';

export interface NormalizedPriceUpdate {
  symbol: string;
  name?: string;
  price: number;
  currency?: string;
  source: StockSource;
}

export interface StockPriceProvider {
  getCurrentPrice(symbol: string): Promise<NormalizedPriceUpdate>;
  syncTrackedSymbols(symbols: string[]): Promise<NormalizedPriceUpdate[]>;
  normalizeWebhook?(payload: unknown): NormalizedPriceUpdate;
}
