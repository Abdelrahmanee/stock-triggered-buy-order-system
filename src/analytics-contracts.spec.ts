import {
  AnalyticsEvent,
  AnalyticsEventType,
} from '../microservice/analytics/events/analytics-events';

describe('Analytics event contracts', () => {
  it('compile with a stock price decrease event payload', () => {
    const event: AnalyticsEvent = {
      eventId: 'event-id',
      eventType: AnalyticsEventType.STOCK_PRICE_DECREASED,
      occurredAt: new Date().toISOString(),
      payload: {
        stockId: 'stock-id',
        symbol: 'AAPL',
        oldPrice: 180,
        newPrice: 170,
      },
    };

    expect(event.eventType).toBe(AnalyticsEventType.STOCK_PRICE_DECREASED);
  });
});
