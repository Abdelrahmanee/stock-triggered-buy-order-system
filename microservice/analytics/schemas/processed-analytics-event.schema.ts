import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AnalyticsEventType } from '../events/analytics-events';

export type ProcessedAnalyticsEventDocument =
  HydratedDocument<ProcessedAnalyticsEvent>;

@Schema({ timestamps: true })
export class ProcessedAnalyticsEvent {
  @Prop({ required: true, unique: true })
  eventId: string;

  @Prop({ type: String, enum: AnalyticsEventType, required: true })
  eventType: AnalyticsEventType;

  @Prop({ required: true })
  occurredAt: Date;

  @Prop({ required: true })
  processedAt: Date;
}

export const ProcessedAnalyticsEventSchema = SchemaFactory.createForClass(
  ProcessedAnalyticsEvent,
);
