import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { WalletLedgerType } from '../../../common/constants/wallet-ledger.constant';

export type WalletLedgerDocument = HydratedDocument<WalletLedger>;

@Schema({ timestamps: true })
export class WalletLedger {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: WalletLedgerType, required: true })
  type: WalletLedgerType;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ required: true, min: 0 })
  balanceBefore: number;

  @Prop({ required: true, min: 0 })
  balanceAfter: number;

  @Prop({ required: true })
  referenceType: string;

  @Prop({ required: true })
  referenceId: string;
}

export const WalletLedgerSchema = SchemaFactory.createForClass(WalletLedger);
