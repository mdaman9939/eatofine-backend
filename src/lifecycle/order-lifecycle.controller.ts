import { Controller, ForbiddenException, Get, HttpCode, Post, Query } from '@nestjs/common';
import { RequireAuth } from '../auth/auth.guard';
import { OrderLifecycleService } from './order-lifecycle.service';

/**
 * Triggers the lifecycle background jobs (auto-cancel stale pending orders +
 * process pending refunds) WITHOUT relying on the in-app @Cron. Use this when
 * the server can sleep (free-tier Render): point an external scheduler
 * (Render Cron Job, cron-job.org, GitHub Actions, UptimeRobot) at the public
 * key-protected endpoint every minute. The admin POST is for manual runs.
 */
@Controller()
export class OrderLifecycleController {
  constructor(private readonly lifecycle: OrderLifecycleService) {}

  /** Admin-triggered manual run. */
  @Post('admin/lifecycle/run-jobs')
  @RequireAuth('admin')
  @HttpCode(200)
  async runJobs() {
    const [autoCancel, refunds] = await Promise.all([
      this.lifecycle.autoCancelStalePending(),
      this.lifecycle.processPendingRefunds(),
    ]);
    return { ok: true, auto_cancelled: autoCancel.cancelled, refunds_processed: refunds.processed };
  }

  /**
   * Public, secret-protected endpoint for an EXTERNAL scheduler. Set
   * LIFECYCLE_CRON_SECRET in the environment and call:
   *   GET /cron/order-jobs?key=<secret>   (every minute)
   * Hitting it also wakes a sleeping free-tier instance.
   */
  @Get('cron/order-jobs')
  @HttpCode(200)
  async cron(@Query('key') key?: string) {
    const secret = process.env.LIFECYCLE_CRON_SECRET;
    if (!secret || key !== secret) {
      throw new ForbiddenException({ errors: [{ code: 'cron', message: 'invalid key' }] });
    }
    const [autoCancel, refunds] = await Promise.all([
      this.lifecycle.autoCancelStalePending(),
      this.lifecycle.processPendingRefunds(),
    ]);
    return { ok: true, auto_cancelled: autoCancel.cancelled, refunds_processed: refunds.processed };
  }
}
