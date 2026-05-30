import { Global, Module } from '@nestjs/common';
import { BusinessSettingsService } from './business-settings.service';

@Global()
@Module({
  providers: [BusinessSettingsService],
  exports: [BusinessSettingsService],
})
export class BusinessSettingsModule {}
