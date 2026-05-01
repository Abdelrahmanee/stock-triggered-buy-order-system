import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { StockSource } from '../../common/constants/stock-source.constant';
import {
  subscribeUser,
  updateUserStockSubscriptionFilter,
} from '../../common/providers/sns.subscribe-topic-provider';
import { AppConfigService } from '../../config/app-config.service';
import {
  StockSubscription,
  StockSubscriptionDocument,
} from './schemas/stock-subscription.schema';
import { Stock, StockDocument } from './schemas/stock.schema';

@Injectable()
export class StocksService implements OnModuleInit {
  constructor(
    @InjectModel(Stock.name) private readonly stockModel: Model<StockDocument>,
    @InjectModel(StockSubscription.name)
    private readonly stockSubscriptionModel: Model<StockSubscriptionDocument>,
    private readonly appConfigService: AppConfigService,
  ) {}

  async onModuleInit() {
    const defaults = [
      { symbol: 'AAPL', name: 'Apple Inc.', currentPrice: 180 },
      { symbol: 'MSFT', name: 'Microsoft Corp.', currentPrice: 420 },
      { symbol: 'TSLA', name: 'Tesla Inc.', currentPrice: 165 },
    ];

    for (const stock of defaults) {
      await this.stockModel.updateOne(
        { symbol: stock.symbol },
        {
          $setOnInsert: {
            ...stock,
            leastPrice: stock.currentPrice,
            currency: 'USD',
            source: StockSource.SEED,
            active: true,
            lastPriceAt: new Date(),
          },
        },
        { upsert: true },
      );
    }

    await this.stockModel.updateMany(
      { leastPrice: { $exists: false } },
      [{ $set: { leastPrice: '$currentPrice' } }],
      { updatePipeline: true },
    );
  }

  listStocks() {
    return this.stockModel.find().sort({ symbol: 1 }).lean();
  }

  async getStockBySymbol(symbol: string) {
    const stock = await this.stockModel
      .findOne({ symbol: symbol.toUpperCase() })
      .lean();

    if (!stock) {
      throw new NotFoundException('Stock not found');
    }

    return stock;
  }

  async upsertPrice(input: {
    symbol: string;
    name?: string;
    price: number;
    currency?: string;
    source: StockSource;
    active?: boolean;
  }) {
    return this.stockModel
      .findOneAndUpdate(
        { symbol: input.symbol.toUpperCase() },
        [
          {
            $set: {
              symbol: input.symbol.toUpperCase(),
              name: input.name ?? input.symbol.toUpperCase(),
              currentPrice: input.price,
              leastPrice: {
                $cond: [
                  {
                    $or: [
                      { $eq: ['$leastPrice', null] },
                      { $lt: [input.price, '$leastPrice'] },
                    ],
                  },
                  input.price,
                  '$leastPrice',
                ],
              },
              currency: input.currency ?? 'USD',
              source: input.source,
              lastPriceAt: new Date(),
              active: input.active ?? true,
            },
          },
        ],
        {
          upsert: true,
          returnDocument: 'after',
          lean: true,
          updatePipeline: true,
        },
      )
      .exec();
  }

  async getCurrentPrice(symbol: string) {
    const stock = await this.getStockBySymbol(symbol);
    return stock.currentPrice;
  }

  async subscribeUserToStock(
    userId: string,
    userEmail: string,
    symbol: string,
  ) {
    const stock = await this.getStockBySymbol(symbol);
    const topicArn = this.appConfigService.snsTopicArn;


    const userObjectId = new Types.ObjectId(userId);
    const existingSubscription = await this.stockSubscriptionModel
      .findOne({ userId: userObjectId })
      .lean();

    const subscription = await this.stockSubscriptionModel
      .findOneAndUpdate(
        { userId: userObjectId },
        {
          $set: {
            email: userEmail.toLowerCase(),
          },
          $addToSet: {
            subscribedStocks: stock._id,
          },
        },
        {
          upsert: true,
          returnDocument: 'after',
          lean: true,
        },
      )
      .exec();

    const subscribedStockIds = (subscription?.subscribedStocks ?? []).map(
      (stockId) => stockId.toString(),
    );

    let subscriptionArn = existingSubscription?.snsSubscriptionArn;
    if (!subscriptionArn) {
      const snsSubscription = await subscribeUser(
        userEmail,
        topicArn,
        subscribedStockIds,
        {
          region: this.appConfigService.snsRegion,
          credentials: this.appConfigService.snsCredentials,
        },
      );
      subscriptionArn = snsSubscription.subscriptionArn;

      await this.stockSubscriptionModel.updateOne(
        { userId: userObjectId },
        { $set: { snsSubscriptionArn: subscriptionArn } },
      );
    } else {
      await updateUserStockSubscriptionFilter(
        subscriptionArn,
        subscribedStockIds,
        {
          region: this.appConfigService.snsRegion,
          credentials: this.appConfigService.snsCredentials,
        },
      );
    }

    return {
      message:
        'Subscription request created. Check your email to confirm the SNS subscription.',
      stock: stock.symbol,
      email: userEmail,
      topicArn,
      subscriptionArn,
      subscribedStocks: subscription?.subscribedStocks ?? [],
    };
  }

  async unsubscribeUserFromStock(userId: string, symbol: string) {
    const stock = await this.getStockBySymbol(symbol);
    const subscription = await this.stockSubscriptionModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        {
          $pull: {
            subscribedStocks: stock._id,
          },
        },
        {
          returnDocument: 'after',
          lean: true,
        },
      )
      .exec();

    if (!subscription) {
      throw new NotFoundException('User stock subscription not found');
    }

    if (subscription.snsSubscriptionArn) {
      await updateUserStockSubscriptionFilter(
        subscription.snsSubscriptionArn,
        subscription.subscribedStocks.map((stockId) => stockId.toString()),
        {
          region: this.appConfigService.snsRegion,
          credentials: this.appConfigService.snsCredentials,
        },
      );
    }

    return {
      message: 'Stock unsubscribed successfully.',
      stock: stock.symbol,
      subscribedStocks: subscription.subscribedStocks,
    };
  }

  getTrackedSymbols() {
    return this.stockModel.find({ active: true }).select('symbol').lean();
  }
}
