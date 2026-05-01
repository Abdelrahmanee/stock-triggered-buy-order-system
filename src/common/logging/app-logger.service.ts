import {
  ConsoleLogger,
  Injectable,
  LogLevel,
  LoggerService,
} from '@nestjs/common';
import { RequestContextService } from './request-context.service';

@Injectable()
export class AppLogger extends ConsoleLogger implements LoggerService {
  constructor(private readonly requestContextService: RequestContextService) {
    super(undefined, {
      logLevels: ['log', 'error', 'warn', 'debug', 'verbose', 'fatal'] as LogLevel[],
    });
  }

  info(message: string, meta?: Record<string, unknown>, context?: string) {
    super.log(this.buildPayload(message, meta), context);
  }

  warnWithMeta(
    message: string,
    meta?: Record<string, unknown>,
    context?: string,
  ) {
    super.warn(this.buildPayload(message, meta), context);
  }

  errorWithMeta(
    message: string,
    trace?: string,
    meta?: Record<string, unknown>,
    context?: string,
  ) {
    super.error(this.buildPayload(message, meta), trace, context);
  }

  debugWithMeta(
    message: string,
    meta?: Record<string, unknown>,
    context?: string,
  ) {
    super.debug(this.buildPayload(message, meta), context);
  }

  override log(message: unknown, context?: string) {
    super.log(this.normalizeMessage(message), context);
  }

  override error(message: unknown, trace?: string, context?: string) {
    super.error(this.normalizeMessage(message), trace, context);
  }

  override warn(message: unknown, context?: string) {
    super.warn(this.normalizeMessage(message), context);
  }

  override debug(message: unknown, context?: string) {
    super.debug(this.normalizeMessage(message), context);
  }

  override verbose(message: unknown, context?: string) {
    super.verbose(this.normalizeMessage(message), context);
  }

  private buildPayload(
    message: string,
    meta?: Record<string, unknown>,
  ) {
    return {
      message,
      ...this.buildBaseMetadata(),
      ...(meta ?? {}),
    };
  }

  protected normalizeMessage(message: unknown) {
    if (typeof message === 'string') {
      return this.buildPayload(message);
    }

    return {
      ...this.buildBaseMetadata(),
      payload: message,
    };
  }

  private buildBaseMetadata() {
    const store = this.requestContextService.getStore();
    return {
      traceId: store?.traceId,
      source: store?.source,
      method: store?.method,
      path: store?.path,
      userId: store?.userId,
      queueName: store?.queueName,
      jobName: store?.jobName,
      timestamp: new Date().toISOString(),
    };
  }
}
