import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfigModule } from './config/app-config.module';
import { AnalyticsEventsModule } from './common/analytics/analytics-events.module';
import { LoggingModule } from './common/logging/logging.module';
import { RequestContextMiddleware } from './common/logging/request-context.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { PortfolioModule } from './modules/portfolio/portfolio.module';
import { QueueModule } from './modules/queue/queue.module';
import { StocksModule } from './modules/stocks/stocks.module';
import { StockProviderModule } from './modules/stock-provider/stock-provider.module';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PriceEventsModule } from './modules/price-events/price-events.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    AppConfigModule,
    LoggingModule,
    AnalyticsEventsModule,
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>(
          'MONGODB_URI',
          'mongodb://127.0.0.1:27017/stock-triggered-buy-order-system',
        ),
      }),
    }),
    QueueModule,
    AuthModule,
    UsersModule,
    WalletModule,
    StocksModule,
    StockProviderModule,
    PriceEventsModule,
    PortfolioModule,
    OrdersModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
