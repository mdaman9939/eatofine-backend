import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderLifecycleService } from './order-lifecycle.service';

/**
 * Runs every minute: any order still `pending` 60s after it was placed is
 * auto-cancelled (restaurant_not_responded) — Case 1 of the spec. Cancellation
 * itself fires the customer/restaurant notifications + sets refund_status.
 */
@Injectable()
export class OrderAutoCancelCron {
  private readonly logger = new Logger('OrderAutoCancelCron');
  private running = false;

  constructor(private readonly lifecycle: OrderLifecycleService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async run(): Promise<void> {
    if (this.running) return; // don't overlap if a sweep runs long
    this.running = true;
    try {
      await this.lifecycle.autoCancelStalePending();
      await this.lifecycle.processPendingRefunds();
    } catch (e) {
      this.logger.error('auto-cancel sweep failed', e instanceof Error ? e.stack : String(e));
    } finally {
      this.running = false;
    }
  }
}
