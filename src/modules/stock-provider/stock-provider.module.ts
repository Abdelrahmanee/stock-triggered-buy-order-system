import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/app-config.module';
import { AppConfigService } from '../../config/app-config.service';
import { ExternalStockProviderService } from './external-stock-provider.service';
import { MockStockProviderService } from './mock-stock-provider.service';
import { STOCK_PRICE_PROVIDER } from './stock-provider.tokens';

@Module({
  imports: [AppConfigModule],
  providers: [
    MockStockProviderService,
    ExternalStockProviderService,
    {
      provide: STOCK_PRICE_PROVIDER,
      inject: [
        AppConfigService,
        MockStockProviderService,
        ExternalStockProviderService,
      ],
      useFactory: (
        appConfigService: AppConfigService,
        mockProvider: MockStockProviderService,
        externalProvider: ExternalStockProviderService,
      ) =>
        appConfigService.stockProviderMode === 'external'
          ? externalProvider
          : mockProvider,
    },
  ],
  exports: [STOCK_PRICE_PROVIDER],
})
export class StockProviderModule {}
