import { Prop } from '@nestjs/mongoose';

export class TimestampedEntity {
  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}
