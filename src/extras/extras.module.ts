import { Module } from '@nestjs/common';
import { StaticPagesController } from './static-pages.controller';
import { CustomerExtrasController } from './customer-extras.controller';
import { CatalogExtrasController } from './catalog-extras.controller';
import { VendorExtrasController } from './vendor-extras.controller';
import { DeliveryExtrasController } from './delivery-extras.controller';
import { AuthExtrasController } from './auth-extras.controller';
import { MigrationModule } from '../mongo/migration.module';

@Module({
  imports: [MigrationModule],
  controllers: [
    StaticPagesController,
    AuthExtrasController,
    CustomerExtrasController,
    CatalogExtrasController,
    VendorExtrasController,
    DeliveryExtrasController,
  ],
})
export class ExtrasModule {}
