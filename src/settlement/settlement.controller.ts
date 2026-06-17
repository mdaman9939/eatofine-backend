import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { RequireAuth } from '../auth/auth.guard';
import { SettlementService } from './settlement.service';

/**
 * Admin-only inspection / operational endpoints for the settlement engine.
 * These do not back any existing UI — they expose the ledger for auditing and a
 * manual idempotent re-run (safe to hit repeatedly).
 */
@Controller('admin/settlements')
@RequireAuth('admin')
export class SettlementController {
  constructor(private readonly settlement: SettlementService) {}

  @Get()
  list(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.settlement.listSettlements(parseInt(limit ?? '50', 10) || 50, parseInt(offset ?? '0', 10) || 0);
  }

  @Get(':orderId')
  get(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.settlement.getSettlement(orderId);
  }

  /** Idempotently (re)run settlement for a delivered order. */
  @Post(':orderId/run')
  run(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.settlement.settleOrder(orderId);
  }

  @Post('withdrawals')
  withdraw(@Body() body: Parameters<SettlementService['requestWithdrawal']>[0]) {
    return this.settlement.requestWithdrawal(body);
  }
}
