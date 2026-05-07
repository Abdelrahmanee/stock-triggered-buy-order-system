export enum AnalyticsEventType {
  ORDER_CREATED = 'order.created',
  ORDER_TRIGGERED = 'order.triggered',
  ORDER_CANCELLED = 'order.cancelled',
  ORDER_EXECUTED = 'order.executed',
  ORDER_FAILED = 'order.failed',
  WALLET_DEPOSITED = 'wallet.deposited',
  WALLET_DEBITED = 'wallet.debited',
  STOCK_PRICE_UPDATED = 'stock.price.updated',
  STOCK_PRICE_DECREASED = 'stock.price.decreased',
  STOCK_SUBSCRIPTION_CHANGED = 'stock.subscription.changed',
}

export type AnalyticsEventBase<TType extends AnalyticsEventType, TPayload> = {
  eventId: string;
  eventType: TType;
  occurredAt: string;
  userId?: string;
  payload: TPayload;
};

export type OrderAnalyticsPayload = {
  orderId: string;
  symbol: string;
  stockId?: string;
  quantity?: number;
  price?: number;
  totalCost?: number;
  status?: string;
};

export type WalletAnalyticsPayload = {
  amount: number;
  balanceBefore?: number;
  balanceAfter?: number;
  referenceId?: string;
};

export type StockPriceAnalyticsPayload = {
  stockId?: string;
  symbol: string;
  oldPrice?: number;
  newPrice: number;
};

export type StockSubscriptionAnalyticsPayload = {
  email: string;
  subscribedStockIds: string[];
};

export type AnalyticsEvent =
  | AnalyticsEventBase<
      | AnalyticsEventType.ORDER_CREATED
      | AnalyticsEventType.ORDER_TRIGGERED
      | AnalyticsEventType.ORDER_CANCELLED
      | AnalyticsEventType.ORDER_EXECUTED
      | AnalyticsEventType.ORDER_FAILED,
      OrderAnalyticsPayload
    >
  | AnalyticsEventBase<
      AnalyticsEventType.WALLET_DEPOSITED | AnalyticsEventType.WALLET_DEBITED,
      WalletAnalyticsPayload
    >
  | AnalyticsEventBase<
      | AnalyticsEventType.STOCK_PRICE_UPDATED
      | AnalyticsEventType.STOCK_PRICE_DECREASED,
      StockPriceAnalyticsPayload
    >
  | AnalyticsEventBase<
      AnalyticsEventType.STOCK_SUBSCRIPTION_CHANGED,
      StockSubscriptionAnalyticsPayload
    >;
