import { Injectable } from '@nestjs/common';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import {
  AnalyticsEvent,
  AnalyticsEventType,
} from '../../../microservice/analytics/events/analytics-events';
import { AppConfigService } from '../../config/app-config.service';
import { AppLogger } from '../logging/app-logger.service';

@Injectable()
export class AnalyticsEventPublisher {
  private snsClient?: SNSClient;

  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly logger: AppLogger,
  ) {}

  async publish(event: AnalyticsEvent) {
    const topicArn = this.appConfigService.analyticsEventsTopicArn;
    if (!topicArn) {
      this.logger.warnWithMeta(
        'Skipping analytics event publish because topic ARN is not configured',
        { eventType: event.eventType, eventId: event.eventId },
        AnalyticsEventPublisher.name,
      );
      return { published: false };
    }

    try {
      const result = await this.getSnsClient().send(
        new PublishCommand({
          TopicArn: topicArn,
          Message: JSON.stringify(event),
          MessageAttributes: this.buildMessageAttributes(event),
        }),
      );

      console.log(`Published analytics event: eventType=${event.eventType}, eventId=${event.eventId}, messageId=${result.MessageId}`,
      );

      return { published: true, messageId: result.MessageId };
    } catch (error) {
      this.logger.warnWithMeta(
        'Failed to publish analytics event',
        {
          eventType: event.eventType,
          eventId: event.eventId,
          error: error instanceof Error ? error.message : String(error),
        },
        AnalyticsEventPublisher.name,
      );
      return { published: false };
    }
  }

  private getSnsClient() {
    this.snsClient ??= new SNSClient({
      region: this.appConfigService.analyticsAwsRegion,
      credentials: this.appConfigService.analyticsAwsCredentials,
    });

    return this.snsClient;
  }

  private buildMessageAttributes(event: AnalyticsEvent) {
    const attributes: Record<
      string,
      { DataType: 'String'; StringValue: string }
    > = {
      eventType: {
        DataType: 'String',
        StringValue: event.eventType,
      },
    };

    if (event.userId) {
      attributes.userId = {
        DataType: 'String',
        StringValue: event.userId,
      };
    }

    if (this.hasSymbol(event)) {
      attributes.symbol = {
        DataType: 'String',
        StringValue: event.payload.symbol,
      };
    }

    if (this.hasStockId(event)) {
      attributes.stockId = {
        DataType: 'String',
        StringValue: event.payload.stockId,
      };
    }

    return attributes;
  }

  private hasSymbol(
    event: AnalyticsEvent,
  ): event is AnalyticsEvent & { payload: { symbol: string } } {
    return 'symbol' in event.payload && Boolean(event.payload.symbol);
  }

  private hasStockId(
    event: AnalyticsEvent,
  ): event is AnalyticsEvent & { payload: { stockId: string } } {
    return 'stockId' in event.payload && Boolean(event.payload.stockId);
  }
}

export const createAnalyticsEventId = (
  eventType: AnalyticsEventType,
  id: string,
) => `${eventType}:${id}`;
