import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { StocksService } from './stocks.service';

@Controller('stocks')
export class StocksController {
  constructor(private readonly stocksService: StocksService) {}

  @Get()
  listStocks() {
    return this.stocksService.listStocks();
  }

  @Get(':symbol')
  getStock(@Param('symbol') symbol: string) {
    return this.stocksService.getStockBySymbol(symbol);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':symbol/subscribe')
  subscribeToStock(
    @CurrentUser() user: JwtPayload,
    @Param('symbol') symbol: string,
  ) {
    return this.stocksService.subscribeUserToStock(user.email, symbol);
  }
}
