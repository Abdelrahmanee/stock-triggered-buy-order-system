import { DeleteMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { AnalyticsEventsConsumer } from '../microservice/analytics/analytics-events.consumer';
import { AnalyticsEventType } from '../microservice/analytics/events/analytics-events';
import { AppLogger } from './common/logging/app-logger.service';
import { AppConfigService } from './config/app-config.service';

jest.mock('@aws-sdk/client-sqs', () => ({
  DeleteMessageCommand: jest.fn().mockImplementation((input) => ({ input })),
  ReceiveMessageCommand: jest.fn().mockImplementation((input) => ({ input })),
  SQSClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({}),
  })),
}));

describe('AnalyticsEventsConsumer', () => {
  const config = {
    analyticsConsumerEnabled: true,
    analyticsEventsQueueUrl: 'queue-url',
    analyticsAwsRegion: 'us-east-1',
    analyticsAwsCredentials: {
      accessKeyId: 'key',
      secretAccessKey: 'secret',
    },
  } as AppConfigService;

  const logger = {
    warnWithMeta: jest.fn(),
  } as unknown as jest.Mocked<AppLogger>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('processes a new SNS-wrapped analytics event and deletes the SQS message', async () => {
    const event = {
      eventId: 'event-id',
      eventType: AnalyticsEventType.WALLET_DEPOSITED,
      occurredAt: new Date().toISOString(),
      userId: 'user-id',
      payload: { amount: 100 },
    };
    const analyticsService = {
      applyEvent: jest.fn().mockResolvedValue(undefined),
    };
    const processedModel = {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
      create: jest.fn().mockResolvedValue({}),
    };
    const consumer = new AnalyticsEventsConsumer(
      config,
      analyticsService as any,
      logger,
      processedModel as any,
    );

    await (consumer as any).handleMessage({
      ReceiptHandle: 'receipt',
      Body: JSON.stringify({ Message: JSON.stringify(event) }),
    });

    expect(analyticsService.applyEvent).toHaveBeenCalledWith(event);
    expect(processedModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'event-id' }),
    );
    expect(DeleteMessageCommand).toHaveBeenCalledWith({
      QueueUrl: 'queue-url',
      ReceiptHandle: 'receipt',
    });
  });

  it('deletes duplicate events without applying them again', async () => {
    const analyticsService = {
      applyEvent: jest.fn(),
    };
    const processedModel = {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ eventId: 'event-id' }),
      }),
      create: jest.fn(),
    };
    const consumer = new AnalyticsEventsConsumer(
      config,
      analyticsService as any,
      logger,
      processedModel as any,
    );

    await (consumer as any).handleMessage({
      ReceiptHandle: 'receipt',
      Body: JSON.stringify({
        eventId: 'event-id',
        eventType: AnalyticsEventType.WALLET_DEPOSITED,
        occurredAt: new Date().toISOString(),
        payload: { amount: 100 },
      }),
    });

    expect(analyticsService.applyEvent).not.toHaveBeenCalled();
    expect(processedModel.create).not.toHaveBeenCalled();
    expect(DeleteMessageCommand).toHaveBeenCalled();
  });

  it('fails startup clearly when queue URL is missing', () => {
    const consumer = new AnalyticsEventsConsumer(
      {
        ...config,
        analyticsConsumerEnabled: true,
        analyticsEventsQueueUrl: '',
      } as AppConfigService,
      { applyEvent: jest.fn() } as any,
      logger,
      {} as any,
    );

    expect(() => consumer.onModuleInit()).toThrow(
      'Analytics events queue URL is not configured',
    );
  });

  it('does not require a queue URL when the consumer is disabled', () => {
    const consumer = new AnalyticsEventsConsumer(
      {
        ...config,
        analyticsConsumerEnabled: false,
        analyticsEventsQueueUrl: '',
      } as AppConfigService,
      { applyEvent: jest.fn() } as any,
      { ...logger, info: jest.fn() } as any,
      {} as any,
    );

    expect(() => consumer.onModuleInit()).not.toThrow();
  });
});
