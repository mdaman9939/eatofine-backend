import { Controller, Get } from '@nestjs/common';
import { BusinessSettingsService } from '../business-settings/business-settings.service';

// Footer / settings pages the apps fetch. Each returns the corresponding
// business_settings row as `{value: string}` or null if not set.
//
// MongoDB routing is inherited transparently: BusinessSettingsService already
// branches on `USE_MONGO_BUSINESS_SETTINGS` to read the `business_settings`
// collection from MongoDB (key/value docs) instead of MySQL. No direct
// MongoDataService dependency is needed here — the service is the right
// abstraction and the response shape is identical across backends.
@Controller()
export class StaticPagesController {
  constructor(private readonly bs: BusinessSettingsService) {}

  private async page(key: string) {
    const value = await this.bs.get(key);
    return { value: value ?? null };
  }

  @Get('terms-and-conditions')
  terms() { return this.page('terms_and_conditions'); }

  @Get('privacy-policy')
  privacy() { return this.page('privacy_policy'); }

  @Get('about-us')
  about() { return this.page('about_us'); }

  @Get('refund-policy')
  refund() { return this.page('refund_policy'); }

  @Get('cancellation-policy')
  cancellation() { return this.page('cancellation_policy'); }

  @Get('shipping-policy')
  shipping() { return this.page('shipping_policy'); }
}
