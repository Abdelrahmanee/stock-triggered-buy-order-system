import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { RequestContextService } from './request-context.service';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(
    private readonly requestContextService: RequestContextService,
  ) {}

  use(
    request: Request & { traceId?: string },
    response: Response,
    next: NextFunction,
  ) {
    const traceId =
      (request.headers['x-request-id'] as string | undefined) ?? randomUUID();

    request.traceId = traceId;
    response.setHeader('x-request-id', traceId);

    this.requestContextService.run(
      {
        traceId,
        source: 'http',
        method: request.method,
        path: request.originalUrl ?? request.url,
      },
      () => next(),
    );
  }
}
