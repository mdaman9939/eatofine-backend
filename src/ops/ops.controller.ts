import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
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

  // The apps POST this as multipart/form-data (with an optional proof image),
  // so without a multipart interceptor @Body() is undefined → "Cannot read
  // properties of undefined (reading 'order_id')". AnyFilesInterceptor parses
  // the form fields (and is a no-op for plain JSON requests).
  @Post('vendor/update-order-status')
  @UseGuards(AuthGuard)
  @RequireAuth('vendor')
  @UseInterceptors(AnyFilesInterceptor())
  vendorUpdateStatus(@Req() req: AuthedRequest, @Body() body: { order_id?: number | string; status?: string; order_status?: string } = {}) {
    const b = body ?? {};
    // The app sends the new state under `status` (UpdateStatusBody.toJson),
    // NOT `order_status` — reading the wrong key made it "" → rejected.
    return this.ops.vendorUpdateStatus(req.actor!.id, Number(b.order_id ?? 0), String(b.status ?? b.order_status ?? ''));
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

  // NOTE: `delivery-man/current-orders` and `delivery-man/latest-orders` are
  // intentionally handled by DeliveryExtrasController instead. Those versions
  // enrich each order with the restaurant name/logo, item count and customer —
  // a duplicate route here would shadow them (NestJS matches the first
  // registered handler) and the DM order list would show "No restaurant data
  // found" + "0 Item" + "All 0" tab counts.

  @Get('delivery-man/order-details/:orderId')
  @UseGuards(AuthGuard)
  @RequireAuth('deliveryman')
  dmDetail(@Req() req: AuthedRequest, @Param('orderId', ParseIntPipe) orderId: number) {
    return this.ops.dmOrderDetail(req.actor!.id, orderId);
  }

  @Post('delivery-man/update-order-status')
  @UseGuards(AuthGuard)
  @RequireAuth('deliveryman')
  @UseInterceptors(AnyFilesInterceptor())
  dmUpdate(@Req() req: AuthedRequest, @Body() body: { order_id?: number | string; status?: string; order_status?: string } = {}) {
    const b = body ?? {};
    return this.ops.dmUpdateStatus(req.actor!.id, Number(b.order_id ?? 0), String(b.status ?? b.order_status ?? ''));
  }
}
