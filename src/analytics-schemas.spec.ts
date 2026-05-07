import { AdminAnalyticsSnapshotSchema } from '../microservice/analytics/schemas/admin-analytics-snapshot.schema';
import { UserAnalyticsSnapshotSchema } from '../microservice/analytics/schemas/user-analytics-snapshot.schema';

describe('Analytics snapshot schemas', () => {
  it('has a unique user period bucket index', () => {
    expect(UserAnalyticsSnapshotSchema.indexes()).toContainEqual([
      { userId: 1, period: 1, periodStart: 1, periodEnd: 1 },
      { unique: true },
    ]);
  });

  it('has a unique admin period bucket index', () => {
    expect(AdminAnalyticsSnapshotSchema.indexes()).toContainEqual([
      { period: 1, periodStart: 1, periodEnd: 1 },
      { unique: true },
    ]);
  });
});
