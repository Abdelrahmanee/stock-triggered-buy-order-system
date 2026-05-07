import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { AnalyticsEventType } from '../../../microservice/analytics/events/analytics-events';
import { AppConfigService } from '../../config/app-config.service';
import { AppLogger } from '../logging/app-logger.service';
import { AnalyticsEventPublisher } from './analytics-event-publisher.service';

jest.mock('@aws-sdk/client-sns', () => ({
  PublishCommand: jest.fn().mockImplementation((input) => ({ input })),
  SNSClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({ MessageId: 'message-id' }),
  })),
}));

describe('AnalyticsEventPublisher', () => {
  const logger = {
    warnWithMeta: jest.fn(),
  } as unknown as jest.Mocked<AppLogger>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('publishes analytics events with message attributes', async () => {
    const publisher = new AnalyticsEventPublisher(
      {
        analyticsEventsTopicArn: 'topic-arn',
        analyticsAwsRegion: 'us-east-1',
        analyticsAwsCredentials: {
          accessKeyId: 'key',
          secretAccessKey: 'secret',
        },
      } as AppConfigService,
      logger,
    );

    await publisher.publish({
      eventId: 'event-id',
      eventType: AnalyticsEventType.ORDER_EXECUTED,
      occurredAt: new Date().toISOString(),
      userId: 'user-id',
      payload: {
        orderId: 'order-id',
        symbol: 'AAPL',
        stockId: 'stock-id',
        quantity: 2,
        price: 100,
        totalCost: 200,
      },
    });

    expect(SNSClient).toHaveBeenCalledWith({
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'key',
        secretAccessKey: 'secret',
      },
    });
    expect(PublishCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        TopicArn: 'topic-arn',
        MessageAttributes: expect.objectContaining({
          eventType: { DataType: 'String', StringValue: 'order.executed' },
          userId: { DataType: 'String', StringValue: 'user-id' },
          symbol: { DataType: 'String', StringValue: 'AAPL' },
          stockId: { DataType: 'String', StringValue: 'stock-id' },
        }),
      }),
    );
  });

  it('skips publish when analytics topic ARN is missing', async () => {
    const publisher = new AnalyticsEventPublisher(
      {
        analyticsEventsTopicArn: '',
      } as AppConfigService,
      logger,
    );

    const result = await publisher.publish({
      eventId: 'event-id',
      eventType: AnalyticsEventType.WALLET_DEPOSITED,
      occurredAt: new Date().toISOString(),
      userId: 'user-id',
      payload: { amount: 100 },
    });

    expect(result).toEqual({ published: false });
    expect(PublishCommand).not.toHaveBeenCalled();
  });

  it('does not throw when SNS publish fails', async () => {
    (SNSClient as unknown as jest.Mock).mockImplementationOnce(() => ({
      send: jest.fn().mockRejectedValue(new Error('sns down')),
    }));
    const publisher = new AnalyticsEventPublisher(
      {
        analyticsEventsTopicArn: 'topic-arn',
        analyticsAwsRegion: 'us-east-1',
        analyticsAwsCredentials: {
          accessKeyId: 'key',
          secretAccessKey: 'secret',
        },
      } as AppConfigService,
      logger,
    );

    await expect(
      publisher.publish({
        eventId: 'event-id',
        eventType: AnalyticsEventType.WALLET_DEPOSITED,
        occurredAt: new Date().toISOString(),
        userId: 'user-id',
        payload: { amount: 100 },
      }),
    ).resolves.toEqual({ published: false });
  });
});
