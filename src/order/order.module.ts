import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { MigrationModule } from '../mongo/migration.module';
import { UserDeliveryChargesService } from '../enhancements/user-delivery-charges.service';

@Module({
  imports: [MigrationModule], // exports MongoDataService so OrderService can inject it
  controllers: [OrderController],
  // UserDeliveryChargesService drives the distance-slab delivery fee. Its deps
  // (Prisma + Mongo) are @Global, so providing it here resolves cleanly.
  providers: [OrderService, UserDeliveryChargesService],
  exports: [OrderService],
})
export class OrderModule {}
