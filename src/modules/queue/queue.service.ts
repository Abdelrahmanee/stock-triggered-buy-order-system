import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { AppConfigService } from '../../config/app-config.service';
import {
  JOB_NAMES,
  QUEUE_NAMES,
} from '../../common/constants/queue-jobs.constant';
import { StockSource } from '../../common/constants/stock-source.constant';
import { AppLogger } from '../../common/logging/app-logger.service';
import { RequestContextService } from '../../common/logging/request-context.service';
import { publishStockPriceDecrease } from '../../common/providers/sns.subscribe-topic-provider';
import { OrdersService } from '../orders/orders.service';
import { PriceEventsService } from '../price-events/price-events.service';
import { STOCK_PRICE_PROVIDER } from '../stock-provider/stock-provider.tokens';
import { StockPriceProvider } from '../stock-provider/interfaces/stock-price-provider.interface';
import { StocksService } from '../stocks/stocks.service';

type RedisConnection = Redis | null;
type TraceablePayload = { traceId?: string };

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private connection: RedisConnection = null;
  private readonly queues = new Map<string, Queue>();
  private readonly workers: Worker[] = [];

  constructor(
    private readonly appConfigService: AppConfigService,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    private readonly stocksService: StocksService,
    private readonly priceEventsService: PriceEventsService,
    private readonly requestContextService: RequestContextService,
    private readonly logger: AppLogger,
    @Inject(STOCK_PRICE_PROVIDER)
    private readonly stockPriceProvider: StockPriceProvider,
  ) {}

  async onModuleInit() {
    if (this.appConfigService.queueDriver === 'inline') {
      this.logger.info(
        'Queue service initialized in inline mode',
        {},
        QueueService.name,
      );
      return;
    }

    this.connection = new Redis({
      host: this.appConfigService.redisHost,
      port: this.appConfigService.redisPort,
      password: this.appConfigService.redisPassword,
      maxRetriesPerRequest: null,
    });

    for (const queueName of Object.values(QUEUE_NAMES)) {
      this.queues.set(
        queueName,
        new Queue(queueName, {
          connection: this.connection,
        }),
      );
    }

    await this.registerWorkers();
    await this.registerRepeatableJobs();
    this.logger.info(
      'BullMQ queues and workers initialized',
      { queueNames: Object.values(QUEUE_NAMES) },
      QueueService.name,
    );
  }

  async onModuleDestroy() {
    await Promise.all(this.workers.map((worker) => worker.close()));
    await Promise.all(
      Array.from(this.queues.values()).map((queue) => queue.close()),
    );
    if (this.connection) {
      await this.connection.quit();
    }
    this.logger.info('Queue service shut down', {}, QueueService.name);
  }

  async enqueuePriceUpdate(input: {
    symbol: string;
    name?: string;
    price: number;
    currency?: string;
    source: StockSource;
  }) {
    const payload = {
      traceId: this.requestContextService.getStore()?.traceId,
      symbol: input.symbol.toUpperCase(),
      name: input.name,
      price: input.price,
      currency: input.currency ?? 'USD',
      source: input.source,
    };

    this.logger.info(
      'Enqueuing price update job',
      {
        symbol: payload.symbol,
        price: payload.price,
        source: payload.source,
        queueDriver: this.appConfigService.queueDriver,
      },
      QueueService.name,
    );

    if (this.appConfigService.queueDriver === 'inline') {
      await this.processPriceUpdate(payload);
      return;
    }

    const job = await this.getQueue(QUEUE_NAMES.PRICE_UPDATES).add(
      JOB_NAMES.PRICE_UPDATED,
      payload,
      {
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    );

    this.logger.info(
      'Price update job enqueued',
      {
        symbol: payload.symbol,
        queueName: QUEUE_NAMES.PRICE_UPDATES,
        jobId: job.id,
      },
      QueueService.name,
    );
  }

  async enqueueOrderEvaluation(symbol: string) {
    const traceId = this.requestContextService.getStore()?.traceId;
    this.logger.info(
      'Enqueuing order evaluation job',
      {
        symbol: symbol.toUpperCase(),
        queueDriver: this.appConfigService.queueDriver,
      },
      QueueService.name,
    );

    if (this.appConfigService.queueDriver === 'inline') {
      await this.processOrderEvaluation({
        symbol: symbol.toUpperCase(),
        traceId,
      });
      return;
    }

    const job = await this.getQueue(QUEUE_NAMES.TRIGGER_EVALUATION).add(
      JOB_NAMES.EVALUATE_TRIGGER,
      { symbol: symbol.toUpperCase(), traceId },
      {
        jobId: `eval-${symbol.toUpperCase()}-${Date.now()}`,
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    );

    this.logger.info(
      'Trigger evaluation job enqueued',
      {
        symbol: symbol.toUpperCase(),
        queueName: QUEUE_NAMES.TRIGGER_EVALUATION,
        jobId: job.id,
      },
      QueueService.name,
    );
  }

  async enqueueOrderExecution(orderId: string) {
    const traceId = this.requestContextService.getStore()?.traceId;
    this.logger.info(
      'Enqueuing order execution job',
      {
        orderId,
        queueDriver: this.appConfigService.queueDriver,
      },
      QueueService.name,
    );

    if (this.appConfigService.queueDriver === 'inline') {
      await this.processOrderExecution({ orderId, traceId });
      return;
    }

    const queue = this.getQueue(QUEUE_NAMES.ORDER_EXECUTION);
    const executionJobId = `execute-${orderId}`;
    const existingJob = await queue.getJob(executionJobId);
    if (existingJob) {
      const state = await existingJob.getState();
      this.logger.warnWithMeta(
        'Existing order execution job found before enqueue',
        {
          orderId,
          queueName: QUEUE_NAMES.ORDER_EXECUTION,
          existingJobId: existingJob.id,
          state,
        },
        QueueService.name,
      );
    }

    const job = await queue.add(
      JOB_NAMES.EXECUTE_ORDER,
      { orderId, traceId },
      {
        jobId: executionJobId,
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    );

    this.logger.info(
      'Order execution job enqueued',
      {
        orderId,
        queueName: QUEUE_NAMES.ORDER_EXECUTION,
        jobId: job.id,
      },
      QueueService.name,
    );
  }

  private getQueue(name: string) {
    const queue = this.queues.get(name);
    if (!queue) {
      throw new Error(`Queue ${name} is not initialized`);
    }

    return queue;
  }

  private async registerWorkers() {
    const priceWorker = new Worker(
      QUEUE_NAMES.PRICE_UPDATES,
      async (job) =>
        this.runInQueueContext(
          QUEUE_NAMES.PRICE_UPDATES,
          job.name,
          job.data,
          () => this.processPriceUpdate(job.data),
        ),
      { connection: this.connection! },
    );

    const evaluationWorker = new Worker(
      QUEUE_NAMES.TRIGGER_EVALUATION,
      async (job) =>
        this.runInQueueContext(
          QUEUE_NAMES.TRIGGER_EVALUATION,
          job.name,
          job.data,
          () => this.processOrderEvaluation(job.data),
        ),
      { connection: this.connection! },
    );

    const executionWorker = new Worker(
      QUEUE_NAMES.ORDER_EXECUTION,
      async (job) =>
        this.runInQueueContext(
          QUEUE_NAMES.ORDER_EXECUTION,
          job.name,
          job.data,
          () => this.processOrderExecution(job.data),
        ),
      { connection: this.connection!, concurrency: 5 },
    );

    const syncWorker = new Worker(
      QUEUE_NAMES.PRICE_SYNC,
      async (job) =>
        this.runInQueueContext(QUEUE_NAMES.PRICE_SYNC, job.name, {}, () =>
          this.processPriceSync(),
        ),
      { connection: this.connection! },
    );

    for (const worker of [
      priceWorker,
      evaluationWorker,
      executionWorker,
      syncWorker,
    ]) {
      worker.on('completed', (job) => {
        this.logger.info(
          'Queue job completed event received',
          {
            queueName: worker.name,
            jobId: job?.id,
            jobName: job?.name,
          },
          QueueService.name,
        );
      });

      worker.on('failed', (job, error) => {
        this.logger.errorWithMeta(
          'Queue job failed event received',
          error?.stack,
          {
            queueName: worker.name,
            jobId: job?.id,
            jobName: job?.name,
            error: error?.message,
          },
          QueueService.name,
        );
      });

      worker.on('error', (error) => {
        this.logger.errorWithMeta(
          'Queue worker emitted an error',
          error?.stack,
          {
            queueName: worker.name,
            error: error?.message,
          },
          QueueService.name,
        );
      });
    }

    this.workers.push(
      priceWorker,
      evaluationWorker,
      executionWorker,
      syncWorker,
    );
  }

  private async registerRepeatableJobs() {
    await this.getQueue(QUEUE_NAMES.PRICE_SYNC).upsertJobScheduler(
      JOB_NAMES.SYNC_PRICES,
      { pattern: this.appConfigService.priceSyncPattern },
      {
        name: JOB_NAMES.SYNC_PRICES,
        data: {},
      },
    );
  }

  private async runInQueueContext<T>(
    queueName: string,
    jobName: string,
    payload: TraceablePayload,
    callback: () => Promise<T>,
  ) {
    const traceId = payload.traceId ?? `${queueName}-${Date.now()}`;
    return this.requestContextService.run(
      {
        traceId,
        source: 'queue',
        queueName,
        jobName,
      },
      async () => {
        this.logger.info(
          'Queue job started',
          { queueName, jobName },
          QueueService.name,
        );
        const result = await callback();
        this.logger.info(
          'Queue job completed',
          { queueName, jobName },
          QueueService.name,
        );
        return result;
      },
    );
  }

  private async processPriceUpdate(input: {
    traceId?: string;
    symbol: string;
    name?: string;
    price: number;
    currency?: string;
    source: StockSource;
  }) {
    this.logger.info(
      'Processing price update',
      {
        symbol: input.symbol,
        price: input.price,
        source: input.source,
      },
      QueueService.name,
    );
    const currentStock = await this.stocksService
      .getStockBySymbol(input.symbol)
      .catch(() => null);

    await this.priceEventsService.recordPriceEvent({
      symbol: input.symbol,
      oldPrice: currentStock?.currentPrice,
      newPrice: input.price,
      source: input.source,
    });

    await this.stocksService.upsertPrice({
      symbol: input.symbol,
      name: input.name,
      price: input.price,
      currency: input.currency,
      source: input.source,
    });

    if (currentStock && input.price < currentStock.currentPrice) {
      await this.publishPriceDecreaseNotification({
        symbol: input.symbol,
        oldPrice: currentStock.currentPrice,
        newPrice: input.price,
        currency: input.currency,
      });
    }

    await this.enqueueOrderEvaluation(input.symbol);
  }

  private async publishPriceDecreaseNotification(input: {
    symbol: string;
    oldPrice: number;
    newPrice: number;
    currency?: string;
  }) {
    const topicArn = this.appConfigService.getSnsTopicArnForStock(input.symbol);

    if (!topicArn) {
      this.logger.warnWithMeta(
        'Skipping stock price decrease notification because SNS topic ARN is not configured',
        { symbol: input.symbol },
        QueueService.name,
      );
      return;
    }

    try {
      const result = await publishStockPriceDecrease(topicArn, input);
      this.logger.info(
        'Published stock price decrease notification',
        {
          symbol: input.symbol,
          oldPrice: input.oldPrice,
          newPrice: input.newPrice,
          topicArn,
          messageId: result.messageId,
        },
        QueueService.name,
      );
    } catch (error) {
      this.logger.warnWithMeta(
        'Failed to publish stock price decrease notification',
        {
          symbol: input.symbol,
          oldPrice: input.oldPrice,
          newPrice: input.newPrice,
          error: error instanceof Error ? error.message : String(error),
        },
        QueueService.name,
      );
    }
  }

  private async processOrderEvaluation(input: {
    symbol: string;
    traceId?: string;
  }) {
    const stock = await this.stocksService.getStockBySymbol(input.symbol);
    const eligibleOrders = await this.ordersService.findEligibleOrders(
      input.symbol,
      stock.currentPrice,
    );

    this.logger.info(
      'Evaluated pending orders for symbol',
      {
        symbol: input.symbol,
        currentPrice: stock.currentPrice,
        eligibleOrders: eligibleOrders.length,
      },
      QueueService.name,
    );

    for (const order of eligibleOrders) {
      const triggered = await this.ordersService.markTriggered(
        order._id.toString(),
      );
      if (triggered) {
        await this.enqueueOrderExecution(triggered._id.toString());
      }
    }
  }

  private async processOrderExecution(input: {
    orderId: string;
    traceId?: string;
  }) {
    this.logger.info(
      'Processing order execution job',
      { orderId: input.orderId },
      QueueService.name,
    );
    await this.ordersService.executeTriggeredOrder(input.orderId);
  }

  private async processPriceSync() {
    const symbols = await this.stocksService.getTrackedSymbols();
    if (!symbols.length) {
      this.logger.debugWithMeta(
        'Skipping price sync because there are no tracked symbols',
        {},
        QueueService.name,
      );
      return;
    }

    const updates = await this.stockPriceProvider.syncTrackedSymbols(
      symbols.map((entry) => entry.symbol),
    );

    this.logger.info(
      'Fetched stock price updates from provider',
      { symbols: updates.map((update) => update.symbol) },
      QueueService.name,
    );

    for (const update of updates) {
      await this.enqueuePriceUpdate(update);
    }
  }
}
