import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CompletionService } from './completion.service';

/**
 * Auto-generates the monthly restaurant (vendor) invoices.
 *
 * Runs at 02:00 on the 1st of every month and bills the PREVIOUS calendar
 * month. `generateMonthlyInvoices()` with no arguments already targets the
 * previous month from the 1st to its last day, so month length (28 / 29 / 30 /
 * 31) is handled automatically by the date math. Generation is idempotent — it
 * skips any restaurant that already has an invoice for that period, so a manual
 * "Generate invoices" run + this cron will never create duplicates.
 */
@Injectable()
export class InvoiceCronService {
  private readonly logger = new Logger('InvoiceCron');

  constructor(private readonly completion: CompletionService) {}

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async runMonthly() {
    try {
      // Default args → previous month, 1st → last day (auto 28/30/31).
      const res = (await this.completion.generateMonthlyInvoices()) as { created?: number; period?: { start: string; end: string } };
      this.logger.log(`Monthly vendor invoices generated: ${res?.created ?? 0} (period ${res?.period?.start} → ${res?.period?.end})`);
    } catch (e) {
      this.logger.error('Monthly vendor-invoice generation failed', e instanceof Error ? e.stack : String(e));
    }
  }
}
