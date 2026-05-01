import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { StockSource } from '../../../common/constants/stock-source.constant';

export type PriceEventDocument = HydratedDocument<PriceEvent>;

@Schema({ timestamps: true })
export class PriceEvent {
  @Prop({ required: true, uppercase: true, index: true })
  symbol: string;

  @Prop({ min: 0 })
  oldPrice: number;

  @Prop({ required: true, min: 0 })
  newPrice: number;

  @Prop({ type: String, enum: StockSource, required: true })
  source: StockSource;

  @Prop({ required: true })
  receivedAt: Date;
}

export const PriceEventSchema = SchemaFactory.createForClass(PriceEvent);
