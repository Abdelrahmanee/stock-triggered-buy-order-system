import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { StockSource } from '../../../common/constants/stock-source.constant';

export type StockDocument = HydratedDocument<Stock>;

@Schema({ timestamps: true })
export class Stock {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  symbol: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, min: 0 })
  currentPrice: number;

  @Prop({ required: true, min: 0 })
  leastPrice: number;

  @Prop({ default: 'USD' })
  currency: string;

  @Prop({ type: String, enum: StockSource, default: StockSource.SEED })
  source: StockSource;

  @Prop()
  lastPriceAt: Date;

  @Prop({ default: true })
  active: boolean;
}

export const StockSchema = SchemaFactory.createForClass(Stock);
