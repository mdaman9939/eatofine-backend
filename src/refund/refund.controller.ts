import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { RequireAuth } from '../auth/auth.guard';
import { RefundService } from './refund.service';
import type { ScenarioKey } from './refund-policy';

/**
 * Admin-side refund/cancellation engine.
 *
 * Routes (mounted at `/admin/refund-engine`):
 *   GET  /catalogue                            — all 14 scenarios + metadata
 *   GET  /:orderId/applicable                  — only the scenarios valid for this order
 *   GET  /:orderId/preview?scenario=KEY        — preview money/wallet effects (no DB writes)
 *   POST /:orderId/apply                       — execute the decision (writes refund, ledger, audit)
 *   GET  /:orderId/history                     — past decisions applied to this order
 *   GET  /ledger                               — cross-order wallet ledger (penalty + credit audit)
 */
@Controller('admin/refund-engine')
@RequireAuth('admin')
export class RefundController {
  constructor(private readonly svc: RefundService) {}

  @Get('catalogue')
  catalogue() {
    return this.svc.catalogue();
  }

  @Get('ledger')
  ledger(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('actor_type') actorType?: 'restaurant' | 'deliveryman',
  ) {
    return this.svc.ledger(toInt(limit, 100), toInt(offset, 0), actorType);
  }

  // ── Pending penalty reviews (auto-triggered partner penalties) ──────────
  @Get('pending')
  pending(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.svc.listPending(toInt(limit, 50), toInt(offset, 0));
  }

  @Post('pending/:decisionId/confirm')
  confirmPending(
    @Param('decisionId', ParseIntPipe) decisionId: number,
    @Body() body: { remarks: string },
  ) {
    return this.svc.confirmPending(decisionId, body?.remarks);
  }

  @Post('pending/:decisionId/reject')
  rejectPending(
    @Param('decisionId', ParseIntPipe) decisionId: number,
    @Body() body: { remarks: string },
  ) {
    return this.svc.rejectPending(decisionId, body?.remarks);
  }

  @Get(':orderId/applicable')
  applicable(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.svc.applicable(orderId);
  }

  @Get(':orderId/preview')
  preview(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Query('scenario') scenario: ScenarioKey,
  ) {
    return this.svc.preview(orderId, scenario);
  }

  @Post(':orderId/apply')
  apply(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() body: { scenario: ScenarioKey; remarks: string },
  ) {
    return this.svc.apply(orderId, body.scenario, body.remarks);
  }

  @Get(':orderId/history')
  history(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.svc.historyFor(orderId);
  }
}

function toInt(v: string | undefined, def: number): number {
  if (v === undefined) return def;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}
