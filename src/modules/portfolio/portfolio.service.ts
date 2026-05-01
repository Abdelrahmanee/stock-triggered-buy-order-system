import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  PortfolioPosition,
  PortfolioPositionDocument,
} from './schemas/portfolio-position.schema';

@Injectable()
export class PortfolioService {
  constructor(
    @InjectModel(PortfolioPosition.name)
    private readonly portfolioModel: Model<PortfolioPositionDocument>,
  ) {}

  async applyExecution(input: {
    userId: string;
    symbol: string;
    quantity: number;
    totalCost: number;
  }) {
    const existingPosition = await this.portfolioModel.findOne({
      userId: new Types.ObjectId(input.userId),
      symbol: input.symbol.toUpperCase(),
    });

    if (!existingPosition) {
      return this.portfolioModel.create({
        userId: new Types.ObjectId(input.userId),
        symbol: input.symbol.toUpperCase(),
        quantityOwned: input.quantity,
        totalInvested: input.totalCost,
        avgBuyPrice: input.totalCost / input.quantity,
      });
    }

    existingPosition.quantityOwned += input.quantity;
    existingPosition.totalInvested += input.totalCost;
    existingPosition.avgBuyPrice =
      existingPosition.totalInvested / existingPosition.quantityOwned;
    await existingPosition.save();
    return existingPosition;
  }
}
