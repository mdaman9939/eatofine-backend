import { Global, Module } from '@nestjs/common';
import { SettlementController } from './settlement.controller';
import { SettlementService } from './settlement.service';
import { DmChargesService } from '../enhancements/dm-charges.service';

/** Global so the delivered-order hooks (admin & delivery-man status updates)
 *  can inject SettlementService without extra module wiring.
 *  DmChargesService is provided here (its deps MongoDataService + PrismaService
 *  are @Global) so settlement can price the RIDER's partner-slab payout — a
 *  stateless second instance, safe to co-locate. */
@Global()
@Module({
  controllers: [SettlementController],
  providers: [SettlementService, DmChargesService],
  exports: [SettlementService],
})
export class SettlementModule {}
