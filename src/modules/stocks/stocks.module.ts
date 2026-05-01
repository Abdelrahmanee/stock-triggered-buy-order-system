import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfigModule } from '../../config/app-config.module';
import {
  StockSubscription,
  StockSubscriptionSchema,
} from './schemas/stock-subscription.schema';
import { Stock, StockSchema } from './schemas/stock.schema';
import { StocksController } from './stocks.controller';
import { StocksService } from './stocks.service';

@Module({
  imports: [
    AppConfigModule,
    MongooseModule.forFeature([
      { name: Stock.name, schema: StockSchema },
      { name: StockSubscription.name, schema: StockSubscriptionSchema },
    ]),
  ],
  controllers: [StocksController],
  providers: [StocksService],
  exports: [StocksService, MongooseModule],
})
export class StocksModule {}
