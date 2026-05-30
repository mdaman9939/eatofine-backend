import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { MigrationModule } from '../mongo/migration.module';

@Module({
  imports: [MigrationModule], // exports MongoDataService so OrderService can inject it
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
