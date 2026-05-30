import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, RequireAuth } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';
import { OpsService } from './ops.service';

@Controller()
export class OpsController {
  constructor(private readonly ops: OpsService) {}

  @Get('vendor/orders/:status')
  @UseGuards(AuthGuard)
  @RequireAuth('vendor')
  vendorOrders(@Req() req: AuthedRequest, @Param('status') status: string) {
    return this.ops.vendorOrders(req.actor!.id, status);
  }

  @Get('vendor/all-orders')
  @UseGuards(AuthGuard)
  @RequireAuth('vendor')
  vendorAllOrders(@Req() req: AuthedRequest, @Query('status') status?: string) {
    return this.ops.vendorOrders(req.actor!.id, status);
  }

  @Get('vendor/order-details/:orderId')
  @UseGuards(AuthGuard)
  @RequireAuth('vendor')
  vendorOrderDetail(@Req() req: AuthedRequest, @Param('orderId', ParseIntPipe) orderId: number) {
    return this.ops.vendorOrderDetail(req.actor!.id, orderId);
  }

  @Post('vendor/update-order-status')
  @UseGuards(AuthGuard)
  @RequireAuth('vendor')
  vendorUpdateStatus(@Req() req: AuthedRequest, @Body() body: { order_id?: number; order_status?: string }) {
    return this.ops.vendorUpdateStatus(req.actor!.id, body.order_id ?? 0, body.order_status ?? '');
  }

  @Post('vendor/order/assign-delivery-man')
  @UseGuards(AuthGuard)
  @RequireAuth('vendor')
  vendorAssignDM(@Req() req: AuthedRequest, @Body() body: { order_id?: number; delivery_man_id?: number }) {
    return this.ops.vendorAssignDeliveryMan(req.actor!.id, body.order_id ?? 0, body.delivery_man_id ?? 0);
  }

  @Get('vendor/all-deliveryman')
  @UseGuards(AuthGuard)
  @RequireAuth('vendor')
  vendorAllDMs(@Req() req: AuthedRequest) {
    return this.ops.vendorAllDeliveryMen(req.actor!.id);
  }

  @Get('delivery-man/current-orders')
  @UseGuards(AuthGuard)
  @RequireAuth('deliveryman')
  dmCurrent(@Req() req: AuthedRequest) {
    return this.ops.dmCurrentOrders(req.actor!.id);
  }

  @Get('delivery-man/latest-orders')
  @UseGuards(AuthGuard)
  @RequireAuth('deliveryman')
  dmLatest(@Req() req: AuthedRequest) {
    return this.ops.dmLatestOrders(req.actor!.id);
  }

  @Get('delivery-man/order-details/:orderId')
  @UseGuards(AuthGuard)
  @RequireAuth('deliveryman')
  dmDetail(@Req() req: AuthedRequest, @Param('orderId', ParseIntPipe) orderId: number) {
    return this.ops.dmOrderDetail(req.actor!.id, orderId);
  }

  @Post('delivery-man/update-order-status')
  @UseGuards(AuthGuard)
  @RequireAuth('deliveryman')
  dmUpdate(@Req() req: AuthedRequest, @Body() body: { order_id?: number; order_status?: string }) {
    return this.ops.dmUpdateStatus(req.actor!.id, body.order_id ?? 0, body.order_status ?? '');
  }
}
