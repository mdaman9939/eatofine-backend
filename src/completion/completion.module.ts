import { Module } from '@nestjs/common';
import { CompletionController } from './completion.controller';
import { CompletionService } from './completion.service';
import { InvoiceCronService } from './invoice-cron.service';
import { MigrationModule } from '../mongo/migration.module';

@Module({
  imports: [MigrationModule],
  controllers: [CompletionController],
  providers: [CompletionService, InvoiceCronService],
})
export class CompletionModule {}
