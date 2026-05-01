import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { QueueModule } from '../queue/queue.module';
import { PriceEvent, PriceEventSchema } from './schemas/price-event.schema';
import { PriceEventsController } from './price-events.controller';
import { PriceEventsService } from './price-events.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PriceEvent.name, schema: PriceEventSchema },
    ]),
    forwardRef(() => QueueModule),
  ],
  controllers: [PriceEventsController],
  providers: [PriceEventsService],
  exports: [PriceEventsService, MongooseModule],
})
export class PriceEventsModule {}
