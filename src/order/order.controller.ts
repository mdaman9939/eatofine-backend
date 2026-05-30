import { Body, Controller, Get, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, RequireAuth } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';
import { OrderService } from './order.service';

@Controller()
export class OrderController {
  constructor(private readonly orders: OrderService) {}

  @Get('customer/order/cancellation-reasons')
  reasons() {
    return this.orders.cancellationReasons();
  }

  @Post('customer/order/place')
  @UseGuards(AuthGuard)
  @RequireAuth('customer')
  place(@Req() req: AuthedRequest, @Body() body: Parameters<OrderService['placeOrder']>[1]) {
    return this.orders.placeOrder(req.actor!.id, body);
  }

  @Get('customer/order/list')
  @UseGuards(AuthGuard)
  @RequireAuth('customer')
  list(@Req() req: AuthedRequest) {
    return this.orders.customerOrderList(req.actor!.id);
  }

  @Get('customer/order/track')
  track(@Query('order_id', ParseIntPipe) orderId: number) {
    return this.orders.trackOrder(orderId);
  }
}
