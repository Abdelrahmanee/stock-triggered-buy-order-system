import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BuyOrderStatus } from '../../common/constants/order-status.constant';
import { AppLogger } from '../../common/logging/app-logger.service';
import { sendEmailNotification } from '../../common/providers/ses.send-email-provider';
import { QueueService } from '../queue/queue.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import { StocksService } from '../stocks/stocks.service';
import { UsersService } from '../users/users.service';
import { WalletService } from '../wallet/wallet.service';
import { CreateBuyOrderDto } from './dto/create-buy-order.dto';
import { BuyOrder, BuyOrderDocument } from './schemas/buy-order.schema';
import {
  TradeExecution,
  TradeExecutionDocument,
} from './schemas/trade-execution.schema';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(BuyOrder.name)
    private readonly buyOrderModel: Model<BuyOrderDocument>,
    @InjectModel(TradeExecution.name)
    private readonly tradeExecutionModel: Model<TradeExecutionDocument>,
    private readonly stocksService: StocksService,
    private readonly usersService: UsersService,
    private readonly walletService: WalletService,
    private readonly portfolioService: PortfolioService,
    private readonly queueService: QueueService,
    private readonly logger: AppLogger,
  ) {}

  private toObjectId(value: string, fieldName: string) {
    const normalizedValue = value?.trim();

    if (!/^[a-fA-F0-9]{24}$/.test(normalizedValue)) {
      throw new BadRequestException(`${fieldName} must be a valid ObjectId`);
    }

    return new Types.ObjectId(normalizedValue);
  }

  async createBuyOrder(userId: string, dto: CreateBuyOrderDto) {
    this.logger.info(
      'Creating buy trigger order',
      {
        userId,
        symbol: dto.symbol.toUpperCase(),
        targetPrice: dto.targetPrice,
        quantity: dto.quantity,
      },
      OrdersService.name,
    );
    const stock = await this.stocksService.getStockBySymbol(dto.symbol);
    if (!stock.active) {
      throw new BadRequestException('Stock is inactive');
    }

    const user = await this.usersService.findById(userId);
    const estimatedCost = dto.quantity * dto.targetPrice;

    if (user.walletBalance < estimatedCost) {
      throw new BadRequestException(
        'Insufficient wallet balance for requested target order',
      );
    }

    const order = await this.buyOrderModel.create({
      userId: new Types.ObjectId(userId),
      symbol: dto.symbol.toUpperCase(),
      targetPrice: dto.targetPrice,
      quantity: dto.quantity,
      status: BuyOrderStatus.PENDING,
    });

    if (stock.currentPrice <= dto.targetPrice) {
      await this.queueService.enqueueOrderEvaluation(dto.symbol);
    }

    this.logger.info(
      'Buy trigger order created',
      {
        userId,
        orderId: order._id.toString(),
        symbol: order.symbol,
        status: order.status,
      },
      OrdersService.name,
    );
    return order.toJSON();
  }

  listOrders(userId: string) {
    return this.buyOrderModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean();
  }

  async getOrder(userId: string, orderId: string) {
    const orderObjectId = this.toObjectId(orderId, 'Order id');

    const order = await this.buyOrderModel
      .findOne({ _id: orderObjectId, userId: new Types.ObjectId(userId) })
      .lean();

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async cancelOrder(userId: string, orderId: string) {
    const orderObjectId = this.toObjectId(orderId, 'Order id');

    const order = await this.buyOrderModel
      .findOneAndUpdate(
        {
          _id: orderObjectId,
          userId: new Types.ObjectId(userId),
          status: { $in: [BuyOrderStatus.PENDING, BuyOrderStatus.TRIGGERED] },
        },
        {
          $set: {
            status: BuyOrderStatus.CANCELLED,
            statusReason: 'Cancelled by user',
          },
        },
        { returnDocument: 'after', lean: true },
      )
      .exec();

    if (!order) {
      throw new NotFoundException('Pending order not found');
    }

    this.logger.info(
      'Buy order cancelled',
      { userId, orderId, status: order.status },
      OrdersService.name,
    );
    return order;
  }

  findEligibleOrders(symbol: string, currentPrice: number) {
    return this.buyOrderModel
      .find({
        symbol: symbol.toUpperCase(),
        status: BuyOrderStatus.PENDING,
        targetPrice: { $gte: currentPrice },
      })
      .lean();
  }

  async markTriggered(orderId: string) {
    const orderObjectId = this.toObjectId(orderId, 'Order id');

    const order = await this.buyOrderModel
      .findOneAndUpdate(
        { _id: orderObjectId, status: BuyOrderStatus.PENDING },
        { $set: { status: BuyOrderStatus.TRIGGERED } },
        { returnDocument: 'after', lean: true },
      )
      .exec();

    if (order) {
      this.logger.info(
        'Buy order moved to triggered state',
        {
          orderId,
          userId: order.userId.toString(),
          symbol: order.symbol,
          targetPrice: order.targetPrice,
        },
        OrdersService.name,
      );
    }

    return order;
  }

  async executeTriggeredOrder(orderId: string) {
    const orderObjectId = this.toObjectId(orderId, 'Order id');

    this.logger.info(
      'Starting triggered order execution',
      { orderId },
      OrdersService.name,
    );
    const order = await this.buyOrderModel
      .findOneAndUpdate(
        { _id: orderObjectId, status: BuyOrderStatus.TRIGGERED },
        { $set: { status: BuyOrderStatus.EXECUTING } },
        { returnDocument: 'after', lean: true },
      )
      .exec();

    if (!order) {
      this.logger.debugWithMeta(
        'Order execution skipped because order is not in triggered state',
        { orderId },
        OrdersService.name,
      );
      return null;
    }

    const existingExecution = await this.tradeExecutionModel
      .findOne({ buyOrderId: orderObjectId })
      .lean();
    if (existingExecution) {
      await this.buyOrderModel.updateOne(
        { _id: orderObjectId },
        { $set: { status: BuyOrderStatus.COMPLETED } },
      );
      this.logger.warnWithMeta(
        'Existing trade execution found; avoiding duplicate execution',
        { orderId, executionId: existingExecution._id?.toString() },
        OrdersService.name,
      );
      return existingExecution;
    }

    const stock = await this.stocksService.getStockBySymbol(order.symbol);
    if (stock.currentPrice > order.targetPrice) {
      await this.buyOrderModel.updateOne(
        { _id: orderObjectId },
        {
          $set: {
            status: BuyOrderStatus.PENDING,
            statusReason: 'Price moved above target before execution',
          },
        },
      );
      this.logger.warnWithMeta(
        'Order returned to pending because current price moved above target',
        {
          orderId,
          symbol: order.symbol,
          currentPrice: stock.currentPrice,
          targetPrice: order.targetPrice,
        },
        OrdersService.name,
      );
      return null;
    }

    const totalCost = order.quantity * stock.currentPrice;

    try {
      await this.walletService.debitForOrder({
        userId: order.userId.toString(),
        amount: totalCost,
        referenceId: orderId,
      });
    } catch {
      await this.buyOrderModel.updateOne(
        { _id: orderObjectId, status: BuyOrderStatus.EXECUTING },
        {
          $set: {
            status: BuyOrderStatus.FAILED,
            statusReason: 'rejected_insufficient_funds',
          },
        },
      );
      this.logger.warnWithMeta(
        'Order execution failed because wallet balance was insufficient',
        {
          orderId,
          userId: order.userId.toString(),
          totalCost,
        },
        OrdersService.name,
      );
      return null;
    }

    const execution = await this.tradeExecutionModel.create({
      buyOrderId: orderObjectId,
      userId: new Types.ObjectId(order.userId),
      symbol: order.symbol,
      executedPrice: stock.currentPrice,
      quantity: order.quantity,
      totalCost,
      executedAt: new Date(),
      result: 'completed',
    });

    await this.portfolioService.applyExecution({
      userId: order.userId.toString(),
      symbol: order.symbol,
      quantity: order.quantity,
      totalCost,
    });

    await this.buyOrderModel.updateOne(
      { _id: orderObjectId, status: BuyOrderStatus.EXECUTING },
      {
        $set: {
          status: BuyOrderStatus.COMPLETED,
          executedPrice: stock.currentPrice,
          executedAt: new Date(),
          statusReason: 'Order executed successfully',
        },
      },
    );

    try {
      const user = await this.usersService.findById(order.userId);
      this.logger.info(
        'Sending order execution email notification',
        {
          orderId,
          userId: order.userId.toString(),
          email: user.email,
          symbol: order.symbol,
          executedPrice: stock.currentPrice,
        },
        OrdersService.name,
      );
      await sendEmailNotification(user.email, order.symbol, stock.currentPrice);
    } catch (error) {
      this.logger.warnWithMeta(
        'Order execution email notification failed',
        {
          orderId,
          userId: order.userId.toString(),
          error: error instanceof Error ? error.message : String(error),
        },
        OrdersService.name,
      );
    }

    this.logger.info(
      'Order execution completed successfully',
      {
        orderId,
        executionId: execution._id.toString(),
        userId: order.userId.toString(),
        symbol: order.symbol,
        quantity: order.quantity,
        executedPrice: stock.currentPrice,
        totalCost,
      },
      OrdersService.name,
    );
    return execution.toJSON();
  }

  async getExecutionForOrder(orderId: string) {
    const orderObjectId = this.toObjectId(orderId, 'Order id');

    return this.tradeExecutionModel
      .findOne({ buyOrderId: orderObjectId })
      .lean();
  }

  countOrders(filter: Record<string, unknown>) {
    return this.buyOrderModel.countDocuments(filter);
  }
}
