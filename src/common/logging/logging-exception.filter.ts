import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppLogger } from './app-logger.service';

@Catch()
export class LoggingExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;

    this.logger.errorWithMeta(
      'HTTP request failed',
      exception instanceof Error ? exception.stack : undefined,
      {
        method: request.method,
        path: request.originalUrl ?? request.url,
        statusCode: status,
        error:
          typeof exceptionResponse === 'string'
            ? exceptionResponse
            : exceptionResponse ?? 'Internal server error',
      },
      LoggingExceptionFilter.name,
    );

    if (exception instanceof HttpException) {
      response.status(status).json(exception.getResponse());
      return;
    }

    response.status(status).json({
      statusCode: status,
      message: 'Internal server error',
    });
  }
}
