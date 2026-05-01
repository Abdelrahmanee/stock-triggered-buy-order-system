import { Injectable } from '@nestjs/common';
import { StockSource } from '../../common/constants/stock-source.constant';
import {
  NormalizedPriceUpdate,
  StockPriceProvider,
} from './interfaces/stock-price-provider.interface';

@Injectable()
export class MockStockProviderService implements StockPriceProvider {
  private readonly latestPrices = new Map<string, number>([
    ['AAPL', 180],
    ['MSFT', 420],
    ['TSLA', 165],
  ]);

  async getCurrentPrice(symbol: string): Promise<NormalizedPriceUpdate> {
    const normalizedSymbol = symbol.toUpperCase();
    const current = this.latestPrices.get(normalizedSymbol) ?? 100;
    const nextPrice = this.randomizePrice(current);
    this.latestPrices.set(normalizedSymbol, nextPrice);

    return {
      symbol: normalizedSymbol,
      name: normalizedSymbol,
      price: nextPrice,
      currency: 'USD',
      source: StockSource.MOCK,
    };
  }

  async syncTrackedSymbols(symbols: string[]): Promise<NormalizedPriceUpdate[]> {
    return Promise.all(symbols.map((symbol) => this.getCurrentPrice(symbol)));
  }

  normalizeWebhook(payload: any): NormalizedPriceUpdate {
    return {
      symbol: payload.symbol.toUpperCase(),
      name: payload.name,
      price: Number(payload.price),
      currency: payload.currency ?? 'USD',
      source: payload.source ?? StockSource.EXTERNAL,
    };
  }

  private randomizePrice(price: number) {
    const delta = (Math.random() - 0.5) * 10;
    return Number(Math.max(1, price + delta).toFixed(2));
  }
}
