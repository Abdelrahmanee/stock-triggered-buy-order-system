import { StockSource } from '../../common/constants/stock-source.constant';
import { AppConfigService } from '../../config/app-config.service';
import { ExternalStockProviderService } from './external-stock-provider.service';

const createResponse = (input: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  body?: unknown;
}) =>
  ({
    ok: input.ok ?? true,
    status: input.status ?? 200,
    statusText: input.statusText ?? 'OK',
    text: jest.fn().mockResolvedValue(JSON.stringify(input.body ?? {})),
  }) as unknown as Response;

describe('ExternalStockProviderService', () => {
  let fetchMock: jest.Mock;

  const createService = (
    overrides: Partial<AppConfigService> = {},
  ): ExternalStockProviderService =>
    new ExternalStockProviderService({
      stockPolygonProviderApiKey: 'polygon-key',
      stockPolygonBaseUrl: 'https://api.polygon.io',
      stockPolygonLookbackDays: 3,
      stockPolygonTimeoutMs: 10000,
      ...overrides,
    } as AppConfigService);

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-09T12:00:00.000Z'));
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('syncs tracked symbols from the latest available grouped daily summary', async () => {
    fetchMock
      .mockResolvedValueOnce(
        createResponse({ body: { status: 'OK', results: [] } }),
      )
      .mockResolvedValueOnce(
        createResponse({
          body: {
            status: 'OK',
            results: [
              { T: 'AAPL', c: 169.42 },
              { T: 'MSFT', c: 410.25 },
              { T: 'TSLA', c: 180 },
            ],
          },
        }),
      );

    const updates = await createService().syncTrackedSymbols(['aapl', 'MSFT']);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.polygon.io/v2/aggs/grouped/locale/us/market/stocks/2026-05-08?adjusted=true&include_otc=false',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer polygon-key',
          Accept: 'application/json',
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.polygon.io/v2/aggs/grouped/locale/us/market/stocks/2026-05-07?adjusted=true&include_otc=false',
      expect.any(Object),
    );
    expect(updates).toEqual([
      {
        symbol: 'AAPL',
        price: 169.42,
        currency: 'USD',
        source: StockSource.POLYGON,
      },
      {
        symbol: 'MSFT',
        price: 410.25,
        currency: 'USD',
        source: StockSource.POLYGON,
      },
    ]);
  });

  it('fetches the current price from the newest daily aggregate close', async () => {
    fetchMock.mockResolvedValueOnce(
      createResponse({
        body: {
          status: 'OK',
          results: [
            { c: 168, t: 1778112000000 },
            { c: 170, t: 1778198400000 },
          ],
        },
      }),
    );

    await expect(createService().getCurrentPrice('aapl')).resolves.toEqual({
      symbol: 'AAPL',
      price: 170,
      currency: 'USD',
      source: StockSource.POLYGON,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.polygon.io/v2/aggs/ticker/AAPL/range/1/day/2026-05-06/2026-05-08?adjusted=true&sort=desc&limit=3',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer polygon-key',
        }),
      }),
    );
  });

  it('throws a clear error when the API key is missing', async () => {
    await expect(
      createService({ stockPolygonProviderApiKey: '' }).syncTrackedSymbols([
        'AAPL',
      ]),
    ).rejects.toThrow(
      'Polygon stock provider API key is not configured. Set STOCK_POLYGON_PROVIDER_API_KEY.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws useful errors for failed Polygon responses', async () => {
    fetchMock.mockResolvedValueOnce(
      createResponse({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        body: { message: 'rate limit exceeded' },
      }),
    );

    await expect(createService().syncTrackedSymbols(['AAPL'])).rejects.toThrow(
      'Polygon request failed with 429 Too Many Requests: rate limit exceeded',
    );
  });

  it('returns no updates when no tracked symbols are found in the lookback window', async () => {
    fetchMock.mockResolvedValue(
      createResponse({
        body: { status: 'OK', results: [{ T: 'TSLA', c: 180 }] },
      }),
    );

    await expect(createService().syncTrackedSymbols(['AAPL'])).resolves.toEqual(
      [],
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
