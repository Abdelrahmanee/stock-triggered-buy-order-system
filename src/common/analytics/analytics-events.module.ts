import { Global, Module } from '@nestjs/common';
import { AnalyticsEventPublisher } from './analytics-event-publisher.service';

@Global()
@Module({
  providers: [AnalyticsEventPublisher],
  exports: [AnalyticsEventPublisher],
})
export class AnalyticsEventsModule {}
