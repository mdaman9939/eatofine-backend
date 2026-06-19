import { Global, Module } from '@nestjs/common';
import { MigrationModule } from '../mongo/migration.module';
import { DmWalletService } from './dm-wallet.service';

/** Global so settlement, customer-extras and admin can all credit the DM wallet
 *  through one auditable path. */
@Global()
@Module({
  imports: [MigrationModule],
  providers: [DmWalletService],
  exports: [DmWalletService],
})
export class DmWalletModule {}
