import { BadRequestException } from '@nestjs/common';
import { AnalyticsService } from '../microservice/analytics/analytics.service';
import { AnalyticsPeriod } from '../microservice/analytics/constants/analytics-period.constant';
import { AnalyticsEventType } from '../microservice/analytics/events/analytics-events';
import { createDefaultAnalyticsMetrics } from '../microservice/analytics/types/analytics-metrics.type';

describe('AnalyticsService', () => {
  const createModel = (snapshot: unknown = null) =>
    ({
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(snapshot),
      }),
    }) as any;

  it.each([
    AnalyticsPeriod.DAILY,
    AnalyticsPeriod.WEEKLY,
    AnalyticsPeriod.MONTHLY,
    AnalyticsPeriod.YEARLY,
    AnalyticsPeriod.LIFETIME,
  ])(
    'returns default user analytics for %s when no snapshot exists',
    async (period) => {
      const service = new AnalyticsService(createModel(), createModel());

      const result = await service.getUserAnalytics(
        '507f1f77bcf86cd799439011',
        period,
      );

      expect(result.period).toBe(period);
      expect(result.userId).toBe('507f1f77bcf86cd799439011');
      expect(result.metrics.executedTradeCount).toBe(0);
      expect(result.metrics.stockPrices).toEqual([]);
    },
  );

  it('returns default admin analytics when no snapshot exists', async () => {
    const service = new AnalyticsService(createModel(), createModel());

    const result = await service.getAdminAnalytics(AnalyticsPeriod.DAILY);

    expect(result.period).toBe(AnalyticsPeriod.DAILY);
    expect(result.metrics.totalInvested).toBe(0);
  });

  it('rejects invalid periods', async () => {
    const service = new AnalyticsService(createModel(), createModel());

    await expect(
      service.getUserAnalytics('507f1f77bcf86cd799439011', 'hourly'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('applies executed order events to all user and admin period snapshots', async () => {
    const createSnapshotModel = () => {
      const docs = Array.from({ length: 5 }, () => ({
        metrics: createDefaultAnalyticsMetrics(),
        markModified: jest.fn(),
        save: jest.fn().mockResolvedValue(undefined),
      }));
      return {
        docs,
        model: {
          findOneAndUpdate: jest.fn().mockImplementation(() => ({
            exec: jest.fn().mockResolvedValue(docs.shift()),
          })),
        } as any,
      };
    };
    const userSnapshots = createSnapshotModel();
    const adminSnapshots = createSnapshotModel();
    const service = new AnalyticsService(
      userSnapshots.model,
      adminSnapshots.model,
    );

    await service.applyEvent({
      eventId: 'event-id',
      eventType: AnalyticsEventType.ORDER_EXECUTED,
      occurredAt: new Date().toISOString(),
      userId: '507f1f77bcf86cd799439011',
      payload: {
        orderId: 'order-id',
        symbol: 'AAPL',
        quantity: 2,
        price: 100,
        totalCost: 200,
        status: 'completed',
      },
    });

    expect(userSnapshots.model.findOneAndUpdate).toHaveBeenCalledTimes(5);
    expect(adminSnapshots.model.findOneAndUpdate).toHaveBeenCalledTimes(5);
  });
});
