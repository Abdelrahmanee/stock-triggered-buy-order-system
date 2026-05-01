import { Module, forwardRef } from '@nestjs/common';
import { AppConfigModule } from '../../config/app-config.module';
import { OrdersModule } from '../orders/orders.module';
import { PriceEventsModule } from '../price-events/price-events.module';
import { StockProviderModule } from '../stock-provider/stock-provider.module';
import { StocksModule } from '../stocks/stocks.module';
import { QueueService } from './queue.service';

@Module({
  imports: [
    AppConfigModule,
    forwardRef(() => OrdersModule),
    forwardRef(() => PriceEventsModule),
    StocksModule,
    StockProviderModule,
  ],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
