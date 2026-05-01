import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppLogger } from './app-logger.service';
import { LoggingExceptionFilter } from './logging-exception.filter';
import { LoggingInterceptor } from './logging.interceptor';
import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContextService } from './request-context.service';

@Global()
@Module({
  providers: [
    RequestContextService,
    AppLogger,
    RequestContextMiddleware,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: LoggingExceptionFilter,
    },
  ],
  exports: [RequestContextService, AppLogger],
})
export class LoggingModule {}
