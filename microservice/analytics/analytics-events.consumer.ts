import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  DeleteMessageCommand,
  Message,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { Model } from 'mongoose';
import { AppConfigService } from '../../src/config/app-config.service';
import { AppLogger } from '../../src/common/logging/app-logger.service';
import { AnalyticsEvent, AnalyticsEventType } from './events/analytics-events';
import {
  ProcessedAnalyticsEvent,
  ProcessedAnalyticsEventDocument,
} from './schemas/processed-analytics-event.schema';
import { AnalyticsService } from './analytics.service';

@Injectable()
export class AnalyticsEventsConsumer implements OnModuleInit, OnModuleDestroy {
  private isRunning = false;
  private sqsClient?: SQSClient;

  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly analyticsService: AnalyticsService,
    private readonly logger: AppLogger,
    @InjectModel(ProcessedAnalyticsEvent.name)
    private readonly processedEventModel: Model<ProcessedAnalyticsEventDocument>,
  ) {}

  onModuleInit() {
    console.log('Starting AnalyticsEventsConsumer...' , this.appConfigService.analyticsEventsQueueUrl); // Add this line to log when the consumer starts
    console.log('Starting AnalyticsEventsConsumer...' , this.appConfigService.analyticsConsumerEnabled); // Add this line to log when the consumer starts
    if (!this.appConfigService.analyticsConsumerEnabled) {
      this.logger.info(
        'Analytics SQS consumer is disabled',
        {},
        AnalyticsEventsConsumer.name,
      );
      return;
    }

    if (!this.appConfigService.analyticsEventsQueueUrl) {
      throw new Error(
        'Analytics events queue URL is not configured. Set ANALYTICS_EVENTS_QUEUE_URL.',
      );
    }

    this.isRunning = true;
    void this.poll();
  }

  onModuleDestroy() {
    this.isRunning = false;
  }

  private async poll() {
    while (this.isRunning) {
      try {
        console.log('Polling for analytics events...' , this.appConfigService.analyticsEventsQueueUrl); // Add this line to log when polling starts
        const response = await this.getSqsClient().send(
          new ReceiveMessageCommand({
            QueueUrl: this.appConfigService.analyticsEventsQueueUrl,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 20,
          }),
        );

        for (const message of response.Messages ?? []) {
          await this.handleMessage(message);
        }
      } catch (error) {
        this.logger.warnWithMeta(
          'Analytics SQS polling failed',
          { error: error instanceof Error ? error.message : String(error) },
          AnalyticsEventsConsumer.name,
        );
      }
    }
  }

  private async handleMessage(message: Message) {
    console.log(`Received analytics event message: messageId=${message.MessageId}`); 
    if (!message.ReceiptHandle) {
      return;
    }

    const event = this.parseMessage(message);
    const existing = await this.processedEventModel
      .findOne({ eventId: event.eventId })
      .lean();

    if (existing) {
      await this.deleteMessage(message.ReceiptHandle);
      return;
    }

    await this.analyticsService.applyEvent(event);
    await this.processedEventModel.create({
      eventId: event.eventId,
      eventType: event.eventType,
      occurredAt: new Date(event.occurredAt),
      processedAt: new Date(),
    });
    await this.deleteMessage(message.ReceiptHandle);
  }

  private parseMessage(message: Message): AnalyticsEvent {
    const parsedBody = JSON.parse(message.Body ?? '{}');
    const rawEvent = parsedBody.Message
      ? JSON.parse(parsedBody.Message)
      : parsedBody;

    if (
      typeof rawEvent.eventId !== 'string' ||
      !Object.values(AnalyticsEventType).includes(rawEvent.eventType) ||
      typeof rawEvent.occurredAt !== 'string' ||
      typeof rawEvent.payload !== 'object' ||
      rawEvent.payload === null
    ) {
      throw new Error('Invalid analytics event message');
    }

    return rawEvent as AnalyticsEvent;
  }

  private deleteMessage(receiptHandle: string) {
    return this.getSqsClient().send(
      new DeleteMessageCommand({
        QueueUrl: this.appConfigService.analyticsEventsQueueUrl,
        ReceiptHandle: receiptHandle,
      }),
    );
  }

  private getSqsClient() {
    this.sqsClient ??= new SQSClient({
      region: this.appConfigService.analyticsAwsRegion,
      credentials: this.appConfigService.analyticsAwsCredentials,
    });

    return this.sqsClient;
  }
}
