import { Injectable } from '@nestjs/common';
import { StockSource } from '../../common/constants/stock-source.constant';
import { AppConfigService } from '../../config/app-config.service';
import {
  NormalizedPriceUpdate,
  StockPriceProvider,
} from './interfaces/stock-price-provider.interface';

type PolygonAggregateBar = {
  T?: string;
  c?: number;
  t?: number;
};

type PolygonGroupedResponse = {
  status?: string;
  request_id?: string;
  results?: PolygonAggregateBar[];
  error?: string;
  message?: string;
};

type PolygonTickerAggregateBar = {
  c?: number;
  t?: number;
};

type PolygonTickerAggregateResponse = {
  status?: string;
  request_id?: string;
  results?: PolygonTickerAggregateBar[];
  error?: string;
  message?: string;
};

@Injectable()
export class ExternalStockProviderService implements StockPriceProvider {
  constructor(private readonly appConfigService: AppConfigService) {}

  async getCurrentPrice(symbol: string): Promise<NormalizedPriceUpdate> {
    const normalizedSymbol = this.normalizeSymbol(symbol);
    const dates = this.getLookbackDates();
    const from = dates[dates.length - 1];
    const to = dates[0];
    const query = new URLSearchParams({
      adjusted: 'true',
      sort: 'desc',
      limit: String(this.lookbackDays),
    });
    const response = await this.fetchJson<PolygonTickerAggregateResponse>(
      `/v2/aggs/ticker/${encodeURIComponent(
        normalizedSymbol,
      )}/range/1/day/${from}/${to}?${query.toString()}`,
    );

    const latestBar = (response.results ?? [])
      .filter((bar) => this.isValidPrice(bar.c))
      .sort((left, right) => (right.t ?? 0) - (left.t ?? 0))[0];

    if (!latestBar) {
      throw new Error(
        `Polygon returned no end-of-day price for ${normalizedSymbol} in the last ${this.lookbackDays} days.`,
      );
    }

    return this.toNormalizedUpdate(normalizedSymbol, latestBar.c!);
  }

  async syncTrackedSymbols(
    symbols: string[],
  ): Promise<NormalizedPriceUpdate[]> {
    const trackedSymbols = new Set(
      symbols.map((symbol) => this.normalizeSymbol(symbol)).filter(Boolean),
    );

    if (!trackedSymbols.size) {
      return [];
    }

    for (const date of this.getLookbackDates()) {
      const query = new URLSearchParams({
        adjusted: 'true',
        include_otc: 'false',
      });
      const response = await this.fetchJson<PolygonGroupedResponse>(
        `/v2/aggs/grouped/locale/us/market/stocks/${date}?${query.toString()}`,
      );
      const updates = (response.results ?? [])
        .filter(
          (bar) =>
            bar.T &&
            trackedSymbols.has(bar.T.toUpperCase()) &&
            this.isValidPrice(bar.c),
        )
        .map((bar) => this.toNormalizedUpdate(bar.T!, bar.c!));

      if (updates.length) {
        return updates;
      }
    }

    return [];
  }

  private async fetchJson<T>(path: string): Promise<T> {
    const apiKey = this.appConfigService.stockPolygonProviderApiKey;
    if (!apiKey) {
      throw new Error(
        'Polygon stock provider API key is not configured. Set STOCK_POLYGON_PROVIDER_API_KEY.',
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.appConfigService.stockPolygonTimeoutMs,
    );

    try {
      const response = await fetch(this.buildUrl(path), {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      const bodyText = await response.text();
      const body = this.parseJsonBody(bodyText);

      if (!response.ok) {
        throw new Error(
          `Polygon request failed with ${response.status} ${
            response.statusText
          }: ${this.extractErrorMessage(body)}`,
        );
      }

      return body as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(
          `Polygon request timed out after ${this.appConfigService.stockPolygonTimeoutMs}ms.`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildUrl(path: string) {
    const baseUrl = this.appConfigService.stockPolygonBaseUrl.replace(
      /\/+$/,
      '',
    );
    return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private parseJsonBody(bodyText: string): unknown {
    if (!bodyText) {
      return {};
    }

    try {
      return JSON.parse(bodyText);
    } catch {
      return { message: bodyText };
    }
  }

  private extractErrorMessage(body: unknown) {
    if (!body || typeof body !== 'object') {
      return 'Unknown Polygon error';
    }

    const errorBody = body as { error?: string; message?: string };
    return errorBody.error ?? errorBody.message ?? 'Unknown Polygon error';
  }

  private getLookbackDates() {
    const dates: string[] = [];
    const today = new Date();
    const lookbackDays = this.lookbackDays;

    for (let offset = 1; offset <= lookbackDays; offset += 1) {
      const date = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate() - offset,
        ),
      );
      dates.push(this.formatDate(date));
    }

    return dates;
  }

  private formatDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private normalizeSymbol(symbol: string) {
    return symbol.trim().toUpperCase();
  }

  private toNormalizedUpdate(
    symbol: string,
    price: number,
  ): NormalizedPriceUpdate {
    return {
      symbol: this.normalizeSymbol(symbol),
      price,
      currency: 'USD',
      source: StockSource.POLYGON,
    };
  }

  private isValidPrice(price: unknown): price is number {
    return typeof price === 'number' && Number.isFinite(price) && price >= 0;
  }

  private get lookbackDays() {
    const lookbackDays = this.appConfigService.stockPolygonLookbackDays;
    return Number.isFinite(lookbackDays) && lookbackDays > 0
      ? Math.floor(lookbackDays)
      : 7;
  }
}
