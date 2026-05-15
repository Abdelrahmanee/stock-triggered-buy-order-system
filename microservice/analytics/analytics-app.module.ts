import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { StringValue } from 'ms';
import { AnalyticsEventsModule } from '../../src/common/analytics/analytics-events.module';
import { LoggingModule } from '../../src/common/logging/logging.module';
import { RequestContextMiddleware } from '../../src/common/logging/request-context.middleware';
import { AppConfigModule } from '../../src/config/app-config.module';
import { AnalyticsModule } from './analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    AppConfigModule,
    LoggingModule,
    AnalyticsEventsModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'super-secret'),
        signOptions: {
          expiresIn: configService.get<string>(
            'JWT_EXPIRES_IN',
            '1d',
          ) as StringValue,
        },
      }),
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>(
          'MONGODB_URI',
          'mongodb://127.0.0.1:27017/stock-triggered-buy-order-system',
        ),
      }),
    }),
    AnalyticsModule,
  ],
})
export class AnalyticsAppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
