import { AnalyticsEventPublisher } from '../../common/analytics/analytics-event-publisher.service';
import { AppLogger } from '../../common/logging/app-logger.service';
import { RequestContextService } from '../../common/logging/request-context.service';
import { AppConfigService } from '../../config/app-config.service';
import { PriceEventsService } from '../price-events/price-events.service';
import { QueueService } from '../queue/queue.service';
import { StocksService } from '../stocks/stocks.service';
import { ExternalStockProviderService } from './external-stock-provider.service';

const createResponse = (body: unknown) =>
  ({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  }) as unknown as Response;

describe('Polygon provider inline queue flow', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-09T12:00:00.000Z'));
    fetchMock = jest.fn().mockResolvedValue(
      createResponse({
        status: 'OK',
        results: [{ T: 'AAPL', c: 169 }],
      }),
    );
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('uses Polygon EOD data to update stock prices and trigger eligible orders', async () => {
    const appConfig = {
      stockPolygonProviderApiKey: 'polygon-key',
      stockPolygonBaseUrl: 'https://api.polygon.io',
      stockPolygonLookbackDays: 3,
      stockPolygonTimeoutMs: 10000,
      queueDriver: 'inline',
      snsTopicArn: '',
    } as AppConfigService;
    const provider = new ExternalStockProviderService(appConfig);
    const stockId = { toString: () => 'stock-id' };
    const orderId = { toString: () => 'order-id' };
    const stocksService = {
      getStockBySymbol: jest
        .fn()
        .mockResolvedValueOnce({
          _id: stockId,
          symbol: 'AAPL',
          currentPrice: 180,
        })
        .mockResolvedValueOnce({
          _id: stockId,
          symbol: 'AAPL',
          currentPrice: 169,
        }),
      upsertPrice: jest.fn().mockResolvedValue({
        _id: stockId,
        symbol: 'AAPL',
        currentPrice: 169,
      }),
    } as unknown as jest.Mocked<StocksService>;
    const priceEventsService = {
      recordPriceEvent: jest.fn().mockResolvedValue({
        _id: { toString: () => 'price-event-id' },
        receivedAt: new Date('2026-05-09T12:00:00.000Z'),
      }),
    } as unknown as jest.Mocked<PriceEventsService>;
    const ordersService = {
      findEligibleOrders: jest.fn().mockResolvedValue([{ _id: orderId }]),
      markTriggered: jest.fn().mockResolvedValue({ _id: orderId }),
      executeTriggeredOrder: jest.fn().mockResolvedValue(undefined),
    };
    const logger = {
      info: jest.fn(),
      warnWithMeta: jest.fn(),
      errorWithMeta: jest.fn(),
      debugWithMeta: jest.fn(),
    } as unknown as jest.Mocked<AppLogger>;
    const requestContextService = {
      getStore: jest.fn(),
    } as unknown as jest.Mocked<RequestContextService>;
    const analyticsEventPublisher = {
      publish: jest.fn().mockResolvedValue({ published: false }),
    } as unknown as jest.Mocked<AnalyticsEventPublisher>;
    const queueService = new QueueService(
      appConfig,
      ordersService as any,
      stocksService,
      priceEventsService,
      requestContextService,
      logger,
      provider,
      analyticsEventPublisher,
    );

    const updates = await provider.syncTrackedSymbols(['AAPL']);
    await queueService.enqueuePriceUpdate(updates[0]);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.polygon.io/v2/aggs/grouped/locale/us/market/stocks/2026-05-08?adjusted=true&include_otc=false',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer polygon-key',
        }),
      }),
    );
    expect(stocksService.upsertPrice).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: 'AAPL',
        price: 169,
      }),
    );
    expect(ordersService.findEligibleOrders).toHaveBeenCalledWith('AAPL', 169);
    expect(ordersService.markTriggered).toHaveBeenCalledWith('order-id');
    expect(ordersService.executeTriggeredOrder).toHaveBeenCalledWith(
      'order-id',
    );
  });
});
