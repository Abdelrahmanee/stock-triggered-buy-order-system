import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TradeExecutionDocument = HydratedDocument<TradeExecution>;

@Schema({ timestamps: true })
export class TradeExecution {
  @Prop({ type: Types.ObjectId, ref: 'BuyOrder', required: true, unique: true })
  buyOrderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, uppercase: true })
  symbol: string;

  @Prop({ required: true, min: 0 })
  executedPrice: number;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true, min: 0 })
  totalCost: number;

  @Prop({ required: true })
  executedAt: Date;

  @Prop({ required: true })
  result: string;
}

export const TradeExecutionSchema =
  SchemaFactory.createForClass(TradeExecution);
