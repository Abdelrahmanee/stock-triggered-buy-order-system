import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../../src/modules/users/users.module';
import {
  AdminAnalyticsSnapshot,
  AdminAnalyticsSnapshotSchema,
} from './schemas/admin-analytics-snapshot.schema';
import {
  ProcessedAnalyticsEvent,
  ProcessedAnalyticsEventSchema,
} from './schemas/processed-analytics-event.schema';
import {
  UserAnalyticsSnapshot,
  UserAnalyticsSnapshotSchema,
} from './schemas/user-analytics-snapshot.schema';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsEventsConsumer } from './analytics-events.consumer';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      {
        name: UserAnalyticsSnapshot.name,
        schema: UserAnalyticsSnapshotSchema,
      },
      {
        name: AdminAnalyticsSnapshot.name,
        schema: AdminAnalyticsSnapshotSchema,
      },
      {
        name: ProcessedAnalyticsEvent.name,
        schema: ProcessedAnalyticsEventSchema,
      },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsEventsConsumer],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
