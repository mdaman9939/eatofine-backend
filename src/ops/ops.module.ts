import { Module } from '@nestjs/common';
import { OpsController } from './ops.controller';
import { OpsService } from './ops.service';
import { MigrationModule } from '../mongo/migration.module';
import { RefundModule } from '../refund/refund.module';

@Module({
  imports: [MigrationModule, RefundModule],
  controllers: [OpsController],
  providers: [OpsService],
})
export class OpsModule {}
