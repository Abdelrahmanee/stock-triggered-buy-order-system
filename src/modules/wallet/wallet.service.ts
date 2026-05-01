import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WalletLedgerType } from '../../common/constants/wallet-ledger.constant';
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
  ) {}

  async deposit(userId: string, amount: number) {
    const previousUser = await this.usersService.findById(userId);
    const updatedUser = await this.usersService.incrementWallet(userId, amount);

    await this.walletLedgerModel.create({
      userId: new Types.ObjectId(userId),
      type: WalletLedgerType.DEPOSIT,
      amount,
      balanceBefore: previousUser.walletBalance,
      balanceAfter: updatedUser.walletBalance,
      referenceType: 'wallet-deposit',
      referenceId: userId,
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
      throw new NotFoundException('Insufficient wallet balance or inactive user');
    }

    const balanceBefore = updatedUser.walletBalance + input.amount;

    await this.walletLedgerModel.create({
      userId: new Types.ObjectId(input.userId),
      type: WalletLedgerType.DEBIT,
      amount: input.amount,
      balanceBefore,
      balanceAfter: updatedUser.walletBalance,
      referenceType: 'buy-order',
      referenceId: input.referenceId,
    });

    return updatedUser;
  }
}
