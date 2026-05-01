import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AppLogger } from './app-logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startedAt = Date.now();

    this.logger.info(
      'HTTP request started',
      {
        method: request.method,
        path: request.originalUrl ?? request.url,
        query: request.query,
      },
      LoggingInterceptor.name,
    );

    return next.handle().pipe(
      tap(() => {
        this.logger.info(
          'HTTP request completed',
          {
            method: request.method,
            path: request.originalUrl ?? request.url,
            statusCode: response.statusCode,
            durationMs: Date.now() - startedAt,
          },
          LoggingInterceptor.name,
        );
      }),
    );
  }
}
