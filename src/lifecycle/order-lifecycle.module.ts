import { Global, Module } from '@nestjs/common';
import { OrderLifecycleService } from './order-lifecycle.service';
import { OrderAutoCancelCron } from './order-autocancel.cron';
import { OrderLifecycleController } from './order-lifecycle.controller';

/** Global so the existing status-update endpoints (admin / vendor / rider) can
 *  delegate cancellation, audit logging and notifications to one engine. */
@Global()
@Module({
  controllers: [OrderLifecycleController],
  providers: [OrderLifecycleService, OrderAutoCancelCron],
  exports: [OrderLifecycleService],
})
export class OrderLifecycleModule {}
