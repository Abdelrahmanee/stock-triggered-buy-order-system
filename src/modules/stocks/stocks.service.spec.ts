import { StockSource } from '../../common/constants/stock-source.constant';
import { StocksService } from './stocks.service';

describe('StocksService', () => {
  const createService = (stockModel: Record<string, jest.Mock>) =>
    new StocksService(
      stockModel as any,
      {} as any,
      {} as any,
      { publish: jest.fn() } as any,
    );

  it('preserves the existing stock name when a price update has no name', async () => {
    const exec = jest.fn().mockResolvedValue(undefined);
    const findOneAndUpdate = jest.fn().mockReturnValue({ exec });
    const service = createService({ findOneAndUpdate });

    await service.upsertPrice({
      symbol: 'aapl',
      price: 169,
      source: StockSource.POLYGON,
    });

    const pipeline = findOneAndUpdate.mock.calls[0][1];
    expect(pipeline[0].$set.name).toEqual({ $ifNull: ['$name', 'AAPL'] });
  });

  it('uses an explicit provider name when one is supplied', async () => {
    const exec = jest.fn().mockResolvedValue(undefined);
    const findOneAndUpdate = jest.fn().mockReturnValue({ exec });
    const service = createService({ findOneAndUpdate });

    await service.upsertPrice({
      symbol: 'nvda',
      name: 'NVIDIA Corp.',
      price: 900,
      source: StockSource.POLYGON,
    });

    const pipeline = findOneAndUpdate.mock.calls[0][1];
    expect(pipeline[0].$set.name).toBe('NVIDIA Corp.');
  });
});
