import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { QueueModule } from '../queue/queue.module';
import { StocksModule } from '../stocks/stocks.module';
import { UsersModule } from '../users/users.module';
import { WalletModule } from '../wallet/wallet.module';
import { BuyOrder, BuyOrderSchema } from './schemas/buy-order.schema';
import {
  TradeExecution,
  TradeExecutionSchema,
} from './schemas/trade-execution.schema';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BuyOrder.name, schema: BuyOrderSchema },
      { name: TradeExecution.name, schema: TradeExecutionSchema },
    ]),
    UsersModule,
    WalletModule,
    StocksModule,
    PortfolioModule,
    forwardRef(() => QueueModule),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService, MongooseModule],
})
export class OrdersModule {}
