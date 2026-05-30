import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { MigrationModule } from '../mongo/migration.module';

@Module({
  imports: [MigrationModule], // exports MongoDataService so CustomerService can inject it
  controllers: [CustomerController],
  providers: [CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}
