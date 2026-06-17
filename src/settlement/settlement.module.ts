import { Global, Module } from '@nestjs/common';
import { SettlementController } from './settlement.controller';
import { SettlementService } from './settlement.service';

/** Global so the delivered-order hooks (admin & delivery-man status updates)
 *  can inject SettlementService without extra module wiring. */
@Global()
@Module({
  controllers: [SettlementController],
  providers: [SettlementService],
  exports: [SettlementService],
})
export class SettlementModule {}
