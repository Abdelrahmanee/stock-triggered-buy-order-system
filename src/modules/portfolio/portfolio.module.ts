import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PortfolioPosition,
  PortfolioPositionSchema,
} from './schemas/portfolio-position.schema';
import { PortfolioService } from './portfolio.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PortfolioPosition.name, schema: PortfolioPositionSchema },
    ]),
  ],
  providers: [PortfolioService],
  exports: [PortfolioService, MongooseModule],
})
export class PortfolioModule {}
