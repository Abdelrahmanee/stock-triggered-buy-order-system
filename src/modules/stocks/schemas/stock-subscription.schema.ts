import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Stock } from './stock.schema';

export type StockSubscriptionDocument = HydratedDocument<StockSubscription>;

@Schema({ timestamps: true })
export class StockSubscription {
  @Prop({ required: true, unique: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop()
  snsSubscriptionArn?: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: Stock.name }], default: [] })
  subscribedStocks: Types.ObjectId[];
}

export const StockSubscriptionSchema =
  SchemaFactory.createForClass(StockSubscription);
