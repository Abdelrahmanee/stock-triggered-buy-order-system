import { Body, Controller, Post } from '@nestjs/common';
import { StockSource } from '../../common/constants/stock-source.constant';
import { AppLogger } from '../../common/logging/app-logger.service';
import { QueueService } from '../queue/queue.service';
import { PriceUpdateDto } from './dto/price-update.dto';

@Controller('stock-events')
export class PriceEventsController {
  constructor(
    private readonly queueService: QueueService,
    private readonly logger: AppLogger,
  ) {}

  @Post('price-update')
  async ingestPriceUpdate(@Body() dto: PriceUpdateDto) {
    this.logger.info(
      'Received stock price update webhook',
      {
        symbol: dto.symbol.toUpperCase(),
        price: dto.price,
        source: dto.source ?? StockSource.WEBHOOK,
      },
      PriceEventsController.name,
    );
    await this.queueService.enqueuePriceUpdate({
      ...dto,
      source: dto.source ?? StockSource.WEBHOOK,
    });

    return {
      accepted: true,
      symbol: dto.symbol.toUpperCase(),
      source: dto.source ?? StockSource.WEBHOOK,
    };
  }
}
