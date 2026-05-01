import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppLogger } from './common/logging/app-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(AppLogger));
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.get(AppLogger).info(
    'Application bootstrap completed',
    {
      port: Number(process.env.PORT ?? 3000),
      environment: process.env.NODE_ENV ?? 'development',
    },
    'Bootstrap',
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
