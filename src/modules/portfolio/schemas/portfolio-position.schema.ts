import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PortfolioPositionDocument = HydratedDocument<PortfolioPosition>;

@Schema({ timestamps: true })
export class PortfolioPosition {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, uppercase: true, index: true })
  symbol: string;

  @Prop({ required: true, min: 0 })
  quantityOwned: number;

  @Prop({ required: true, min: 0 })
  avgBuyPrice: number;

  @Prop({ required: true, min: 0 })
  totalInvested: number;
}

export const PortfolioPositionSchema =
  SchemaFactory.createForClass(PortfolioPosition);
PortfolioPositionSchema.index({ userId: 1, symbol: 1 }, { unique: true });
