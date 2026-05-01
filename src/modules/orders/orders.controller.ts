import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { CreateBuyOrderDto } from './dto/create-buy-order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('buy-trigger')
  createBuyOrder(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateBuyOrderDto,
  ) {
    return this.ordersService.createBuyOrder(user.sub, dto);
  }

  @Get()
  listOrders(@CurrentUser() user: JwtPayload) {
    return this.ordersService.listOrders(user.sub);
  }

  @Get(':id')
  getOrder(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.ordersService.getOrder(user.sub, id);
  }

  @Patch(':id/cancel')
  cancelOrder(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.ordersService.cancelOrder(user.sub, id);
  }
}
