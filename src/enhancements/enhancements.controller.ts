import {
  Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query,
} from '@nestjs/common';
import { RequireAuth } from '../auth/auth.guard';
import { EnhancementsService } from './enhancements.service';
import { DmChargesService } from './dm-charges.service';
import { UserDeliveryChargesService } from './user-delivery-charges.service';

@Controller('admin')
@RequireAuth('admin')
export class EnhancementsController {
  constructor(
    private readonly svc: EnhancementsService,
    private readonly dm: DmChargesService,
    private readonly user: UserDeliveryChargesService,
  ) {}

  // ── Slab business plans ──────────────────────────────────────────
  @Get('business-plans/slabs')
  slabs(@Query('vendor_id') vid?: string) {
    return this.svc.listSlabs(vid ? parseInt(vid, 10) : undefined);
  }
  @Post('business-plans/slabs')
  @HttpCode(200)
  createSlab(@Body() body: Parameters<EnhancementsService['createSlab']>[0]) {
    return this.svc.createSlab(body);
  }
  @Patch('business-plans/slabs/:id/status')
  @HttpCode(200)
  toggleSlab(@Param('id', ParseIntPipe) id: number, @Body() body: { status: boolean }) {
    return this.svc.toggleSlabStatus(id, body.status);
  }
  @Delete('business-plans/slabs/:id')
  @HttpCode(200)
  deleteSlab(@Param('id', ParseIntPipe) id: number) {
    return this.svc.deleteSlab(id);
  }

  // ── Tax / GST master ─────────────────────────────────────────────
  @Get('tax-engine/master')
  taxes() {
    return this.svc.listTaxes();
  }
  @Post('tax-engine/master')
  @HttpCode(200)
  createTax(@Body() body: Parameters<EnhancementsService['createTax']>[0]) {
    return this.svc.createTax(body);
  }
  @Patch('tax-engine/master/:id')
  @HttpCode(200)
  updateTax(@Param('id', ParseIntPipe) id: number, @Body() body: Parameters<EnhancementsService['updateTaxRate']>[1]) {
    return this.svc.updateTaxRate(id, body);
  }
  @Delete('tax-engine/master/:id')
  @HttpCode(200)
  deleteTax(@Param('id', ParseIntPipe) id: number) {
    return this.svc.deleteTax(id);
  }

  // ── Live calculator ──────────────────────────────────────────────
  @Post('tax-engine/calculate')
  @HttpCode(200)
  calculate(@Body() body: Parameters<EnhancementsService['calculateOrderCharges']>[0]) {
    return this.svc.calculateOrderCharges(body);
  }

  // ── §1.4 Additional user charges ─────────────────────────────────
  @Get('additional-charges')
  listAdditionalCharges() { return this.svc.listAdditionalCharges(); }
  @Post('additional-charges')
  @HttpCode(200)
  createAdditionalCharge(@Body() body: Parameters<EnhancementsService['createAdditionalCharge']>[0]) {
    return this.svc.createAdditionalCharge(body);
  }
  @Patch('additional-charges/:id')
  @HttpCode(200)
  updateAdditionalCharge(@Param('id', ParseIntPipe) id: number, @Body() body: Parameters<EnhancementsService['updateAdditionalCharge']>[1]) {
    return this.svc.updateAdditionalCharge(id, body);
  }
  @Delete('additional-charges/:id')
  @HttpCode(200)
  deleteAdditionalCharge(@Param('id', ParseIntPipe) id: number) {
    return this.svc.deleteAdditionalCharge(id);
  }

  // ── Tax invoices ─────────────────────────────────────────────────
  @Get('invoices')
  invoices(@Query('limit') l?: string, @Query('offset') o?: string) {
    return this.svc.listInvoices(parseInt(l ?? '50', 10), parseInt(o ?? '0', 10));
  }
  @Get('invoices/:id')
  invoice(@Param('id', ParseIntPipe) id: number) {
    return this.svc.getInvoice(id);
  }

  // ── TDS report + settings ────────────────────────────────────────
  @Get('tds/report')
  tds(
    @Query('vendor_id') vid?: string,
    @Query('rate') rate?: string,
    @Query('threshold') threshold?: string,
  ) {
    return this.svc.tdsReport({
      vendor_id: vid ? parseInt(vid, 10) : undefined,
      rate: rate ? parseFloat(rate) : undefined,
      threshold: threshold ? parseFloat(threshold) : undefined,
    });
  }
  @Get('tds/settings')
  tdsSettings() { return this.svc.getTdsSettings(); }
  @Patch('tds/settings')
  @HttpCode(200)
  updateTdsSettings(@Body() body: Parameters<EnhancementsService['updateTdsSettings']>[0]) {
    return this.svc.updateTdsSettings(body);
  }

  // ── §5 Delivery Partner charges ──────────────────────────────────
  @Get('dm-charges/slabs')
  dmSlabs() { return this.dm.listSlabs(); }
  @Post('dm-charges/slabs')
  @HttpCode(200)
  dmCreateSlab(@Body() body: Parameters<DmChargesService['createSlab']>[0]) { return this.dm.createSlab(body); }
  @Patch('dm-charges/slabs/:id')
  @HttpCode(200)
  dmUpdateSlab(@Param('id', ParseIntPipe) id: number, @Body() body: Parameters<DmChargesService['updateSlab']>[1]) { return this.dm.updateSlab(id, body); }
  @Delete('dm-charges/slabs/:id')
  @HttpCode(200)
  dmDeleteSlab(@Param('id', ParseIntPipe) id: number) { return this.dm.deleteSlab(id); }

  @Get('dm-charges/surcharges')
  dmSurcharges() { return this.dm.listSurcharges(); }
  @Post('dm-charges/surcharges')
  @HttpCode(200)
  dmCreateSurcharge(@Body() body: Parameters<DmChargesService['createSurcharge']>[0]) { return this.dm.createSurcharge(body); }
  @Patch('dm-charges/surcharges/:id')
  @HttpCode(200)
  dmUpdateSurcharge(@Param('id', ParseIntPipe) id: number, @Body() body: Parameters<DmChargesService['updateSurcharge']>[1]) { return this.dm.updateSurcharge(id, body); }
  @Delete('dm-charges/surcharges/:id')
  @HttpCode(200)
  dmDeleteSurcharge(@Param('id', ParseIntPipe) id: number) { return this.dm.deleteSurcharge(id); }

  @Post('dm-charges/calculate')
  @HttpCode(200)
  dmCalculate(@Body() body: Parameters<DmChargesService['calculate']>[0]) { return this.dm.calculate(body); }

  // ── §6 User delivery charges ─────────────────────────────────────
  @Get('user-delivery-charges/slabs')
  userSlabs() { return this.user.listSlabs(); }
  @Post('user-delivery-charges/slabs')
  @HttpCode(200)
  userCreateSlab(@Body() body: Parameters<UserDeliveryChargesService['createSlab']>[0]) { return this.user.createSlab(body); }
  @Patch('user-delivery-charges/slabs/:id')
  @HttpCode(200)
  userUpdateSlab(@Param('id', ParseIntPipe) id: number, @Body() body: Parameters<UserDeliveryChargesService['updateSlab']>[1]) { return this.user.updateSlab(id, body); }
  @Delete('user-delivery-charges/slabs/:id')
  @HttpCode(200)
  userDeleteSlab(@Param('id', ParseIntPipe) id: number) { return this.user.deleteSlab(id); }

  @Get('user-delivery-charges/surcharges')
  userSurcharges() { return this.user.listSurcharges(); }
  @Post('user-delivery-charges/surcharges')
  @HttpCode(200)
  userCreateSurcharge(@Body() body: Parameters<UserDeliveryChargesService['createSurcharge']>[0]) { return this.user.createSurcharge(body); }
  @Patch('user-delivery-charges/surcharges/:id')
  @HttpCode(200)
  userUpdateSurcharge(@Param('id', ParseIntPipe) id: number, @Body() body: Parameters<UserDeliveryChargesService['updateSurcharge']>[1]) { return this.user.updateSurcharge(id, body); }
  @Delete('user-delivery-charges/surcharges/:id')
  @HttpCode(200)
  userDeleteSurcharge(@Param('id', ParseIntPipe) id: number) { return this.user.deleteSurcharge(id); }

  @Get('user-delivery-charges/free-delivery')
  userFreeDelivery() { return this.user.getFreeDelivery(); }
  @Patch('user-delivery-charges/free-delivery')
  @HttpCode(200)
  userUpdateFreeDelivery(@Body() body: Parameters<UserDeliveryChargesService['updateFreeDelivery']>[0]) { return this.user.updateFreeDelivery(body); }

  @Get('user-delivery-charges/surge-grid')
  userSurgeGrid() { return this.user.getSurgeGrid(); }
  @Patch('user-delivery-charges/surge-grid')
  @HttpCode(200)
  userUpdateSurgeCell(@Body() body: Parameters<UserDeliveryChargesService['updateSurgeCell']>[0]) { return this.user.updateSurgeCell(body); }

  @Post('user-delivery-charges/calculate')
  @HttpCode(200)
  userCalculate(@Body() body: Parameters<UserDeliveryChargesService['calculate']>[0]) { return this.user.calculate(body); }
}
