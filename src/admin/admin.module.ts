import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { MigrationModule } from '../mongo/migration.module';
import { UserDeliveryChargesService } from '../enhancements/user-delivery-charges.service';
import { DmWalletModule } from '../wallet/dm-wallet.module';

@Module({
  imports: [MigrationModule, DmWalletModule], // MongoDataService + DmWalletService (reward claims)
  controllers: [AdminController],
  // UserDeliveryChargesService drives the distance-slab delivery fee so the POS
  // computes the SAME delivery charge as the customer order flow.
  providers: [AdminService, UserDeliveryChargesService],
})
export class AdminModule {}
