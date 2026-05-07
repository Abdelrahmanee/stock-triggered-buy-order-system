import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AnalyticsPeriod } from '../constants/analytics-period.constant';
import {
  AnalyticsMetrics,
  createDefaultAnalyticsMetrics,
} from '../types/analytics-metrics.type';

export type AdminAnalyticsSnapshotDocument =
  HydratedDocument<AdminAnalyticsSnapshot>;

@Schema({ timestamps: true })
export class AdminAnalyticsSnapshot {
  @Prop({ type: String, enum: AnalyticsPeriod, required: true, index: true })
  period: AnalyticsPeriod;

  @Prop({ required: true, index: true })
  periodStart: Date;

  @Prop({ required: true, index: true })
  periodEnd: Date;

  @Prop({ type: Object, default: createDefaultAnalyticsMetrics })
  metrics: AnalyticsMetrics;
}

export const AdminAnalyticsSnapshotSchema = SchemaFactory.createForClass(
  AdminAnalyticsSnapshot,
);

AdminAnalyticsSnapshotSchema.index(
  { period: 1, periodStart: 1, periodEnd: 1 },
  { unique: true },
);
