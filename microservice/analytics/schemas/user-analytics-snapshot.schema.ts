import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AnalyticsPeriod } from '../constants/analytics-period.constant';
import {
  AnalyticsMetrics,
  createDefaultAnalyticsMetrics,
} from '../types/analytics-metrics.type';

export type UserAnalyticsSnapshotDocument =
  HydratedDocument<UserAnalyticsSnapshot>;

@Schema({ timestamps: true })
export class UserAnalyticsSnapshot {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: AnalyticsPeriod, required: true, index: true })
  period: AnalyticsPeriod;

  @Prop({ required: true, index: true })
  periodStart: Date;

  @Prop({ required: true, index: true })
  periodEnd: Date;

  @Prop({ type: Object, default: createDefaultAnalyticsMetrics })
  metrics: AnalyticsMetrics;
}

export const UserAnalyticsSnapshotSchema = SchemaFactory.createForClass(
  UserAnalyticsSnapshot,
);

UserAnalyticsSnapshotSchema.index(
  { userId: 1, period: 1, periodStart: 1, periodEnd: 1 },
  { unique: true },
);
