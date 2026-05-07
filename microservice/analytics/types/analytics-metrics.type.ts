export type StockPriceAnalytics = {
  stockId?: string;
  symbol: string;
  lowestObservedPrice: number;
  latestObservedPrice: number;
};

export type AnalyticsMetrics = {
  orderCounts: Record<string, number>;
  executedTradeCount: number;
  totalQuantityBought: number;
  totalInvested: number;
  averageExecutionPrice: number;
  walletDeposits: number;
  walletSpend: number;
  priceUpdateCount: number;
  priceDecreaseCount: number;
  stockPrices: StockPriceAnalytics[];
  subscriptionCount: number;
  subscribedStockIds: string[];
};

export const createDefaultAnalyticsMetrics = (): AnalyticsMetrics => ({
  orderCounts: {},
  executedTradeCount: 0,
  totalQuantityBought: 0,
  totalInvested: 0,
  averageExecutionPrice: 0,
  walletDeposits: 0,
  walletSpend: 0,
  priceUpdateCount: 0,
  priceDecreaseCount: 0,
  stockPrices: [],
  subscriptionCount: 0,
  subscribedStockIds: [],
});
