import {
  Body, Controller, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, Req,
} from '@nestjs/common';
import { RequireAuth, type AuthedRequest } from '../auth/auth.guard';
import { CompletionService } from './completion.service';

@Controller('admin')
@RequireAuth('admin')
export class CompletionController {
  constructor(private readonly svc: CompletionService) {}

  // ── Vendor invoices ──────────────────────────────────────────
  @Get('vendor-invoices')
  listInvoices(
    @Query('vendor_id') vendorId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listInvoices({
      vendorId: vendorId ? parseInt(vendorId, 10) : undefined,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('vendor-invoices/stats')
  invoiceStats() { return this.svc.getInvoiceStats(); }

  // STATIC sub-paths declared BEFORE `:id` so NestJS doesn't ParseIntPipe-fail
  // on /stats or /generate. Same pattern used across the admin module.
  @Get('vendor-invoices/:id')
  invoiceDetail(@Param('id', ParseIntPipe) id: number) { return this.svc.getInvoiceById(id); }

  @Post('vendor-invoices/generate')
  @HttpCode(200)
  generateInvoices(@Body() body: { period_start?: string; period_end?: string }) {
    return this.svc.generateMonthlyInvoices(body.period_start, body.period_end);
  }

  @Patch('vendor-invoices/:id/paid')
  @HttpCode(200)
  markPaid(@Param('id', ParseIntPipe) id: number) { return this.svc.markInvoicePaid(id); }

  @Patch('vendor-invoices/:id/cancel')
  @HttpCode(200)
  cancelInvoice(@Param('id', ParseIntPipe) id: number, @Body() body: { notes?: string }) {
    return this.svc.cancelInvoice(id, body.notes);
  }

  // ── Credit notes ─────────────────────────────────────────────
  @Get('credit-notes')
  listCreditNotes(@Query('status') status?: string, @Query('limit') limit?: string) {
    return this.svc.listCreditNotes({ status, limit: limit ? parseInt(limit, 10) : undefined });
  }

  @Get('credit-notes/stats')
  cnStats() { return this.svc.getCreditNoteStats(); }

  // Declared after /stats so the static path wins over this dynamic one.
  @Get('credit-notes/:id')
  creditNoteDetail(@Param('id', ParseIntPipe) id: number) { return this.svc.getCreditNote(id); }

  @Post('credit-notes')
  @HttpCode(200)
  createCreditNote(@Req() req: AuthedRequest, @Body() body: Parameters<CompletionService['createCreditNote']>[0]) {
    return this.svc.createCreditNote({ ...body, issued_by: Number(req.actor?.id ?? 0) });
  }

  // ── Platform settings ────────────────────────────────────────
  @Get('platform-settings')
  listSettings(@Query('category') category?: string) {
    return this.svc.listSettings(category);
  }

  @Patch('platform-settings/:key')
  @HttpCode(200)
  updateSetting(
    @Req() req: AuthedRequest,
    @Param('key') key: string,
    @Body() body: { value: string },
  ) {
    return this.svc.updateSetting(key, body.value, Number(req.actor?.id ?? 0));
  }

  // ── Fraud flags ──────────────────────────────────────────────
  @Get('fraud-flags')
  listFlags(
    @Query('status') status?: string,
    @Query('subject_type') subjectType?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listFraudFlags({ status, subjectType, limit: limit ? parseInt(limit, 10) : undefined });
  }

  @Get('fraud-flags/stats')
  flagStats() { return this.svc.getFraudStats(); }

  @Post('fraud-flags')
  @HttpCode(200)
  createFlag(@Req() req: AuthedRequest, @Body() body: Parameters<CompletionService['createFraudFlag']>[0]) {
    return this.svc.createFraudFlag({ ...body, flagged_by: Number(req.actor?.id ?? 0) });
  }

  @Patch('fraud-flags/:id/resolve')
  @HttpCode(200)
  resolveFlag(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: 'investigating' | 'resolved' | 'dismissed'; notes: string },
  ) {
    return this.svc.resolveFraudFlag(id, body.status, body.notes, Number(req.actor?.id ?? 0));
  }

  // ── Vendor promotions (moderation) ───────────────────────────
  @Get('vendor-promotions')
  listPromos(
    @Query('status') status?: string,
    @Query('vendor_id') vendorId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listVendorPromos({
      status,
      vendorId: vendorId ? parseInt(vendorId, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('vendor-promotions/stats')
  promoStats() { return this.svc.getPromoStats(); }

  @Patch('vendor-promotions/:id/approve')
  @HttpCode(200)
  approvePromo(@Req() req: AuthedRequest, @Param('id', ParseIntPipe) id: number, @Body() body: { remarks?: string }) {
    return this.svc.approvePromo(id, Number(req.actor?.id ?? 0), body.remarks);
  }

  @Patch('vendor-promotions/:id/reject')
  @HttpCode(200)
  rejectPromo(@Req() req: AuthedRequest, @Param('id', ParseIntPipe) id: number, @Body() body: { remarks: string }) {
    return this.svc.rejectPromo(id, Number(req.actor?.id ?? 0), body.remarks);
  }

  @Patch('vendor-promotions/:id/pause')
  @HttpCode(200)
  pausePromo(@Param('id', ParseIntPipe) id: number, @Body() body: { paused: boolean }) {
    return this.svc.pausePromo(id, body.paused);
  }
}
