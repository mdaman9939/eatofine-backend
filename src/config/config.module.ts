import { Module } from '@nestjs/common';
import { ConfigController } from './config.controller';
import { MigrationModule } from '../mongo/migration.module';

@Module({
  imports: [MigrationModule], // exports MongoDataService so ConfigController can inject it
  controllers: [ConfigController],
})
export class ConfigModule {}
