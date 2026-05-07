import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppLogger } from '../../src/common/logging/app-logger.service';
import { AppConfigService } from '../../src/config/app-config.service';
import { AnalyticsAppModule } from './analytics-app.module';

async function bootstrap() {
  const app = await NestFactory.create(AnalyticsAppModule, {
    bufferLogs: true,
  });
  const logger = app.get(AppLogger);
  const appConfigService = app.get(AppConfigService);

  app.useLogger(logger);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  logger.info(
    'Analytics service bootstrap completed',
    {
      port: appConfigService.analyticsPort,
      environment: process.env.NODE_ENV ?? 'development',
    },
    'AnalyticsBootstrap',
  );
  await app.listen(appConfigService.analyticsPort);
}

bootstrap();
