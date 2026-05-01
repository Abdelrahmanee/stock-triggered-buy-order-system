import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BuyOrderStatus } from '../../../common/constants/order-status.constant';

export type BuyOrderDocument = HydratedDocument<BuyOrder>;

@Schema({ timestamps: true })
export class BuyOrder {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, uppercase: true, index: true })
  symbol: string;

  @Prop({ required: true, min: 0 })
  targetPrice: number;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({
    type: String,
    enum: BuyOrderStatus,
    default: BuyOrderStatus.PENDING,
    index: true,
  })
  status: BuyOrderStatus;

  @Prop()
  statusReason?: string;

  @Prop()
  executedPrice?: number;

  @Prop()
  executedAt?: Date;
}

export const BuyOrderSchema = SchemaFactory.createForClass(BuyOrder);
