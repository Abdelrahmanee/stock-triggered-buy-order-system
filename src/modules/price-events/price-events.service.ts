import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PriceEvent, PriceEventDocument } from './schemas/price-event.schema';

@Injectable()
export class PriceEventsService {
  constructor(
    @InjectModel(PriceEvent.name)
    private readonly priceEventModel: Model<PriceEventDocument>,
  ) {}

  recordPriceEvent(input: {
    symbol: string;
    oldPrice?: number;
    newPrice: number;
    source: string;
  }) {
    return this.priceEventModel.create({
      symbol: input.symbol.toUpperCase(),
      oldPrice: input.oldPrice,
      newPrice: input.newPrice,
      source: input.source,
      receivedAt: new Date(),
    });
  }
}
