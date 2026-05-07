import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ANALYTICS_PERIODS,
  AnalyticsPeriod,
} from './constants/analytics-period.constant';
import {
  AnalyticsEvent,
  AnalyticsEventBase,
  AnalyticsEventType,
  OrderAnalyticsPayload,
} from './events/analytics-events';
import {
  AdminAnalyticsSnapshot,
  AdminAnalyticsSnapshotDocument,
} from './schemas/admin-analytics-snapshot.schema';
import {
  UserAnalyticsSnapshot,
  UserAnalyticsSnapshotDocument,
} from './schemas/user-analytics-snapshot.schema';
import {
  AnalyticsMetrics,
  createDefaultAnalyticsMetrics,
} from './types/analytics-metrics.type';

type AnalyticsBucket = {
  period: AnalyticsPeriod;
  periodStart: Date;
  periodEnd: Date;
};

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(UserAnalyticsSnapshot.name)
    private readonly userAnalyticsModel: Model<UserAnalyticsSnapshotDocument>,
    @InjectModel(AdminAnalyticsSnapshot.name)
    private readonly adminAnalyticsModel: Model<AdminAnalyticsSnapshotDocument>,
  ) {}

  async getUserAnalytics(userId: string, periodInput: string) {
    const bucket = this.getCurrentBucket(periodInput);
    const snapshot = await this.userAnalyticsModel
      .findOne({
        userId: new Types.ObjectId(userId),
        period: bucket.period,
        periodStart: bucket.periodStart,
        periodEnd: bucket.periodEnd,
      })
      .lean();

    return this.buildResponse(bucket, snapshot?.metrics, userId);
  }

  async getAdminAnalytics(periodInput: string) {
    const bucket = this.getCurrentBucket(periodInput);
    const snapshot = await this.adminAnalyticsModel
      .findOne({
        period: bucket.period,
        periodStart: bucket.periodStart,
        periodEnd: bucket.periodEnd,
      })
      .lean();

    return this.buildResponse(bucket, snapshot?.metrics);
  }

  async applyEvent(event: AnalyticsEvent) {
    const occurredAt = new Date(event.occurredAt);
    const buckets = ANALYTICS_PERIODS.map((period) =>
      this.getBucketForDate(occurredAt, period),
    );

    if (event.userId) {
      for (const bucket of buckets) {
        await this.updateUserSnapshot(event.userId, bucket, event);
      }
    }

    for (const bucket of buckets) {
      await this.updateAdminSnapshot(bucket, event);
    }
  }

  private async updateUserSnapshot(
    userId: string,
    bucket: AnalyticsBucket,
    event: AnalyticsEvent,
  ) {
    const snapshot = await this.userAnalyticsModel
      .findOneAndUpdate(
        {
          userId: new Types.ObjectId(userId),
          period: bucket.period,
          periodStart: bucket.periodStart,
          periodEnd: bucket.periodEnd,
        },
        {
          $setOnInsert: {
            userId: new Types.ObjectId(userId),
            period: bucket.period,
            periodStart: bucket.periodStart,
            periodEnd: bucket.periodEnd,
            metrics: createDefaultAnalyticsMetrics(),
          },
        },
        { upsert: true, returnDocument: 'after' },
      )
      .exec();

    snapshot.metrics = this.applyEventToMetrics(
      snapshot.metrics,
      event,
      'user',
    );
    snapshot.markModified('metrics');
    await snapshot.save();
  }

  private async updateAdminSnapshot(
    bucket: AnalyticsBucket,
    event: AnalyticsEvent,
  ) {
    const snapshot = await this.adminAnalyticsModel
      .findOneAndUpdate(
        {
          period: bucket.period,
          periodStart: bucket.periodStart,
          periodEnd: bucket.periodEnd,
        },
        {
          $setOnInsert: {
            period: bucket.period,
            periodStart: bucket.periodStart,
            periodEnd: bucket.periodEnd,
            metrics: createDefaultAnalyticsMetrics(),
          },
        },
        { upsert: true, returnDocument: 'after' },
      )
      .exec();

    snapshot.metrics = this.applyEventToMetrics(
      snapshot.metrics,
      event,
      'admin',
    );
    snapshot.markModified('metrics');
    await snapshot.save();
  }

  private getCurrentBucket(periodInput: string): AnalyticsBucket {
    const period = this.parsePeriod(periodInput);
    const now = new Date();

    return this.getBucketForDate(now, period);
  }

  private getBucketForDate(date: Date, period: AnalyticsPeriod) {
    if (period === AnalyticsPeriod.LIFETIME) {
      return {
        period,
        periodStart: new Date(0),
        periodEnd: new Date('9999-12-31T23:59:59.999Z'),
      };
    }

    const periodStart = this.getPeriodStart(date, period);
    const periodEnd = this.getPeriodEnd(periodStart, period);

    return { period, periodStart, periodEnd };
  }

  private parsePeriod(periodInput: string): AnalyticsPeriod {
    const period = periodInput?.toLowerCase() as AnalyticsPeriod;
    if (!ANALYTICS_PERIODS.includes(period)) {
      throw new BadRequestException(
        `Analytics period must be one of: ${ANALYTICS_PERIODS.join(', ')}`,
      );
    }

    return period;
  }

  private getPeriodStart(date: Date, period: AnalyticsPeriod) {
    const start = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );

    if (period === AnalyticsPeriod.WEEKLY) {
      const day = start.getUTCDay();
      const daysSinceMonday = day === 0 ? 6 : day - 1;
      start.setUTCDate(start.getUTCDate() - daysSinceMonday);
    }

    if (period === AnalyticsPeriod.MONTHLY) {
      start.setUTCDate(1);
    }

    if (period === AnalyticsPeriod.YEARLY) {
      start.setUTCMonth(0, 1);
    }

    return start;
  }

  private getPeriodEnd(periodStart: Date, period: AnalyticsPeriod) {
    const end = new Date(periodStart);

    if (period === AnalyticsPeriod.DAILY) {
      end.setUTCDate(end.getUTCDate() + 1);
    }

    if (period === AnalyticsPeriod.WEEKLY) {
      end.setUTCDate(end.getUTCDate() + 7);
    }

    if (period === AnalyticsPeriod.MONTHLY) {
      end.setUTCMonth(end.getUTCMonth() + 1);
    }

    if (period === AnalyticsPeriod.YEARLY) {
      end.setUTCFullYear(end.getUTCFullYear() + 1);
    }

    end.setUTCMilliseconds(end.getUTCMilliseconds() - 1);
    return end;
  }

  private buildResponse(
    bucket: AnalyticsBucket,
    metrics?: AnalyticsMetrics,
    userId?: string,
  ) {
    return {
      ...(userId ? { userId } : {}),
      period: bucket.period,
      periodStart: bucket.periodStart.toISOString(),
      periodEnd: bucket.periodEnd.toISOString(),
      metrics: metrics ?? createDefaultAnalyticsMetrics(),
    };
  }

  private applyEventToMetrics(
    currentMetrics: AnalyticsMetrics,
    event: AnalyticsEvent,
    scope: 'user' | 'admin',
  ): AnalyticsMetrics {
    const metrics = {
      ...createDefaultAnalyticsMetrics(),
      ...(currentMetrics ?? {}),
      orderCounts: { ...(currentMetrics?.orderCounts ?? {}) },
      stockPrices: [...(currentMetrics?.stockPrices ?? [])],
      subscribedStockIds: [...(currentMetrics?.subscribedStockIds ?? [])],
    };

    if (this.isOrderEvent(event)) {
      const status = event.payload.status ?? event.eventType.split('.')[1];
      metrics.orderCounts[status] = (metrics.orderCounts[status] ?? 0) + 1;
    }

    if (event.eventType === AnalyticsEventType.ORDER_EXECUTED) {
      metrics.executedTradeCount += 1;
      metrics.totalQuantityBought += event.payload.quantity ?? 0;
      metrics.totalInvested += event.payload.totalCost ?? 0;
      metrics.averageExecutionPrice = metrics.totalQuantityBought
        ? metrics.totalInvested / metrics.totalQuantityBought
        : 0;
    }

    if (event.eventType === AnalyticsEventType.WALLET_DEPOSITED) {
      metrics.walletDeposits += event.payload.amount;
    }

    if (event.eventType === AnalyticsEventType.WALLET_DEBITED) {
      metrics.walletSpend += event.payload.amount;
    }

    if (event.eventType === AnalyticsEventType.STOCK_PRICE_UPDATED) {
      metrics.priceUpdateCount += 1;
      this.applyStockPriceMetric(metrics, event.payload);
    }

    if (event.eventType === AnalyticsEventType.STOCK_PRICE_DECREASED) {
      metrics.priceDecreaseCount += 1;
      this.applyStockPriceMetric(metrics, event.payload);
    }

    if (event.eventType === AnalyticsEventType.STOCK_SUBSCRIPTION_CHANGED) {
      if (scope === 'user') {
        metrics.subscribedStockIds = [...event.payload.subscribedStockIds];
      } else {
        metrics.subscribedStockIds = Array.from(
          new Set([
            ...metrics.subscribedStockIds,
            ...event.payload.subscribedStockIds,
          ]),
        );
      }
      metrics.subscriptionCount = metrics.subscribedStockIds.length;
    }

    return metrics;
  }

  private applyStockPriceMetric(
    metrics: AnalyticsMetrics,
    payload: { stockId?: string; symbol: string; newPrice: number },
  ) {
    const symbol = payload.symbol.toUpperCase();
    const existing = metrics.stockPrices.find(
      (entry) => entry.stockId === payload.stockId || entry.symbol === symbol,
    );

    if (!existing) {
      metrics.stockPrices.push({
        stockId: payload.stockId,
        symbol,
        lowestObservedPrice: payload.newPrice,
        latestObservedPrice: payload.newPrice,
      });
      return;
    }

    existing.lowestObservedPrice = Math.min(
      existing.lowestObservedPrice,
      payload.newPrice,
    );
    existing.latestObservedPrice = payload.newPrice;
  }

  private isOrderEvent(
    event: AnalyticsEvent,
  ): event is AnalyticsEventBase<
    | AnalyticsEventType.ORDER_CREATED
    | AnalyticsEventType.ORDER_TRIGGERED
    | AnalyticsEventType.ORDER_CANCELLED
    | AnalyticsEventType.ORDER_EXECUTED
    | AnalyticsEventType.ORDER_FAILED,
    OrderAnalyticsPayload
  > {
    return [
      AnalyticsEventType.ORDER_CREATED,
      AnalyticsEventType.ORDER_TRIGGERED,
      AnalyticsEventType.ORDER_CANCELLED,
      AnalyticsEventType.ORDER_EXECUTED,
      AnalyticsEventType.ORDER_FAILED,
    ].includes(event.eventType as AnalyticsEventType);
  }
}
