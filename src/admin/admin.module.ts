import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { MigrationModule } from '../mongo/migration.module';

@Module({
  imports: [MigrationModule], // gives AdminService access to MongoDataService
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
