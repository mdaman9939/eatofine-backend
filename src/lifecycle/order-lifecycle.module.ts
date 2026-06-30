import { Global, Module } from '@nestjs/common';
import { OrderLifecycleService } from './order-lifecycle.service';
import { OrderAutoCancelCron } from './order-autocancel.cron';
import { OrderLifecycleController } from './order-lifecycle.controller';
import { RefundModule } from '../refund/refund.module';

/** Global so the existing status-update endpoints (admin / vendor / rider) can
 *  delegate cancellation, audit logging and notifications to one engine. */
@Global()
@Module({
  imports: [RefundModule],
  controllers: [OrderLifecycleController],
  providers: [OrderLifecycleService, OrderAutoCancelCron],
  exports: [OrderLifecycleService],
})
export class OrderLifecycleModule {}
