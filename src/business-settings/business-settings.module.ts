import { Global, Module } from '@nestjs/common';
import { BusinessSettingsService } from './business-settings.service';
import { MigrationModule } from '../mongo/migration.module';

@Global()
@Module({
  imports: [MigrationModule], // exports MongoDataService so BusinessSettingsService can inject it
  providers: [BusinessSettingsService],
  exports: [BusinessSettingsService],
})
export class BusinessSettingsModule {}
