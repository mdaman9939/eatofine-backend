import { Module } from '@nestjs/common';
import { MigrationModule } from '../mongo/migration.module';
import { RefundController } from './refund.controller';
import { RefundService } from './refund.service';

@Module({
  imports: [MigrationModule],
  controllers: [RefundController],
  providers: [RefundService],
  exports: [RefundService],
})
export class RefundModule {}
