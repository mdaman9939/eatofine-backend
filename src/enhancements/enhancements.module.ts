import { Module } from '@nestjs/common';
import { EnhancementsController } from './enhancements.controller';
import { EnhancementsService } from './enhancements.service';
import { DmChargesService } from './dm-charges.service';
import { UserDeliveryChargesService } from './user-delivery-charges.service';

@Module({
  controllers: [EnhancementsController],
  providers: [EnhancementsService, DmChargesService, UserDeliveryChargesService],
})
export class EnhancementsModule {}
