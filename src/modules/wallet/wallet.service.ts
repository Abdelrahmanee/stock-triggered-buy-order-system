import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AnalyticsEventPublisher,
  createAnalyticsEventId,
} from '../../common/analytics/analytics-event-publisher.service';
import { WalletLedgerType } from '../../common/constants/wallet-ledger.constant';
import { AnalyticsEventType } from '../../../microservice/analytics/events/analytics-events';
import { UsersService } from '../users/users.service';
import {
  WalletLedger,
  WalletLedgerDocument,
} from './schemas/wallet-ledger.schema';

@Injectable()
export class WalletService {
  constructor(
    private readonly usersService: UsersService,
    @InjectModel(WalletLedger.name)
    private readonly walletLedgerModel: Model<WalletLedgerDocument>,
    private readonly analyticsEventPublisher: AnalyticsEventPublisher,
  ) {}

  async deposit(userId: string, amount: number) {
    const previousUser = await this.usersService.findById(userId);
    const updatedUser = await this.usersService.incrementWallet(userId, amount);

    const ledger = await this.walletLedgerModel.create({
      userId: new Types.ObjectId(userId),
      type: WalletLedgerType.DEPOSIT,
      amount,
      balanceBefore: previousUser.walletBalance,
      balanceAfter: updatedUser.walletBalance,
      referenceType: 'wallet-deposit',
      referenceId: userId,
    });

    await this.analyticsEventPublisher.publish({
      eventId: createAnalyticsEventId(
        AnalyticsEventType.WALLET_DEPOSITED,
        ledger._id.toString(),
      ),
      eventType: AnalyticsEventType.WALLET_DEPOSITED,
      occurredAt: new Date().toISOString(),
      userId,
      payload: {
        amount,
        balanceBefore: previousUser.walletBalance,
        balanceAfter: updatedUser.walletBalance,
        referenceId: userId,
      },
    });

    return updatedUser;
  }

  async debitForOrder(input: {
    userId: string;
    amount: number;
    referenceId: string;
  }) {
    const updatedUser = await this.usersService.reserveFunds(
      input.userId,
      input.amount,
    );

    if (!updatedUser) {
      throw new NotFoundException(
        'Insufficient wallet balance or inactive user',
      );
    }

    const balanceBefore = updatedUser.walletBalance + input.amount;

    const ledger = await this.walletLedgerModel.create({
      userId: new Types.ObjectId(input.userId),
      type: WalletLedgerType.DEBIT,
      amount: input.amount,
      balanceBefore,
      balanceAfter: updatedUser.walletBalance,
      referenceType: 'buy-order',
      referenceId: input.referenceId,
    });

    await this.analyticsEventPublisher.publish({
      eventId: createAnalyticsEventId(
        AnalyticsEventType.WALLET_DEBITED,
        ledger._id.toString(),
      ),
      eventType: AnalyticsEventType.WALLET_DEBITED,
      occurredAt: new Date().toISOString(),
      userId: input.userId,
      payload: {
        amount: input.amount,
        balanceBefore,
        balanceAfter: updatedUser.walletBalance,
        referenceId: input.referenceId,
      },
    });

    return updatedUser;
  }
}
