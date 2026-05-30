import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// SOW Admin Completion — unified service for the 5 remaining admin features:
//   1. Vendor invoices (monthly auto-generate)
//   2. Credit notes (digital, on refund)
//   3. Platform settings (OTP limits, DM limits, auto-online)
//   4. Fraud / misuse flags
//   5. Vendor-created promotions (with admin moderation)

type SettingType = 'int' | 'float' | 'string' | 'bool' | 'json';

interface InvoiceRow {
  id: number; invoice_number: string;
  vendor_id: number; restaurant_id: number | null;
  plan_type: string; period_start: Date; period_end: Date;
  gross_sales: number; order_count: number;
  commission_base: number; ppo_base: number; subscription_fee: number;
  taxable_amount: number; cgst: number; sgst: number; igst: number;
  total_amount: number; tds_amount: number; net_payable: number;
  status: string; notes: string | null;
  issued_at: Date | null; paid_at: Date | null;
  created_at: Date | null;
  vendor_name: string | null; restaurant_name: string | null;
}

interface CreditNoteRow {
  id: number; credit_note_number: string;
  order_id: number; customer_id: number; restaurant_id: number | null;
  reason: string | null;
  refund_amount: number; tax_reversed: number; delivery_reversed: number; total_credit: number;
  status: string; notes: string | null;
  issued_by: number | null;
  created_at: Date | null;
  customer_name: string | null; restaurant_name: string | null;
}

interface SettingRow {
  id: number; setting_key: string; setting_value: string; value_type: SettingType;
  category: string; label: string; description: string | null;
  min_value: number | null; max_value: number | null;
  updated_at: Date | null;
}

interface FraudFlagRow {
  id: number;
  subject_type: 'customer' | 'vendor' | 'delivery_man';
  subject_id: number;
  subject_name: string | null;
  flag_type: string; severity: string; description: string | null;
  auto_triggered: number;
  status: string;
  flagged_by: number | null; resolved_by: number | null;
  resolved_at: Date | null; resolution_notes: string | null;
  created_at: Date | null;
}

interface VendorPromoRow {
  id: number; vendor_id: number; restaurant_id: number;
  vendor_name: string | null; restaurant_name: string | null;
  title: string; description: string | null;
  promo_type: string;
  discount_type: string | null; discount_value: number | null;
  min_order_value: number | null; max_discount: number | null;
  start_date: Date | null; end_date: Date | null;
  image_path: string | null; target_audience: string;
  status: string; admin_remarks: string | null;
  reviewed_by: number | null; reviewed_at: Date | null;
  total_uses: number;
  created_at: Date | null;
}

@Injectable()
export class CompletionService {
  constructor(private readonly prisma: PrismaService) {}

  // ╔══════════════════════════════════════════════════════════════╗
  // ║ 1. VENDOR INVOICES                                            ║
  // ╚══════════════════════════════════════════════════════════════╝
  async listInvoices(filters: { vendorId?: number; status?: string; limit?: number } = {}) {
    const conds: string[] = [];
    if (filters.vendorId) conds.push(`vi.vendor_id = ${filters.vendorId}`);
    if (filters.status) conds.push(`vi.status = '${filters.status}'`);
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const limit = Math.min(filters.limit ?? 500, 2000);

    const rows = await this.prisma.$queryRawUnsafe<InvoiceRow[]>(
      `SELECT vi.*,
              CONCAT_WS(' ', v.f_name, v.l_name) AS vendor_name,
              r.name AS restaurant_name
       FROM vendor_invoices vi
       LEFT JOIN vendors v ON v.id = vi.vendor_id
       LEFT JOIN restaurants r ON r.id = vi.restaurant_id
       ${where}
       ORDER BY vi.period_end DESC, vi.id DESC
       LIMIT ${limit}`,
    );
    return rows.map((r) => ({
      ...r,
      id: Number(r.id),
      vendor_id: Number(r.vendor_id),
      restaurant_id: r.restaurant_id ? Number(r.restaurant_id) : null,
      gross_sales: Number(r.gross_sales),
      order_count: Number(r.order_count),
      commission_base: Number(r.commission_base),
      ppo_base: Number(r.ppo_base),
      subscription_fee: Number(r.subscription_fee),
      taxable_amount: Number(r.taxable_amount),
      cgst: Number(r.cgst), sgst: Number(r.sgst), igst: Number(r.igst),
      total_amount: Number(r.total_amount),
      tds_amount: Number(r.tds_amount),
      net_payable: Number(r.net_payable),
    }));
  }

  async getInvoiceStats() {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ status: string; c: bigint | number; total: number }>>(
      `SELECT status, COUNT(*) AS c, COALESCE(SUM(total_amount),0) AS total
       FROM vendor_invoices GROUP BY status`,
    );
    const summary = {
      draft: 0, issued: 0, paid: 0, cancelled: 0, total_count: 0,
      total_value: 0, paid_value: 0, outstanding_value: 0,
    };
    for (const r of rows) {
      const n = Number(r.c);
      const t = Number(r.total);
      if (r.status in summary) (summary as Record<string, number>)[r.status] = n;
      summary.total_count += n;
      summary.total_value += t;
      if (r.status === 'paid') summary.paid_value += t;
      if (r.status === 'issued') summary.outstanding_value += t;
    }
    return summary;
  }

  /** Auto-generate monthly invoices for the previous calendar month. */
  async generateMonthlyInvoices(periodStart?: string, periodEnd?: string) {
    const now = new Date();
    const start = periodStart ? new Date(periodStart) : new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = periodEnd ? new Date(periodEnd) : new Date(now.getFullYear(), now.getMonth(), 0);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    // Aggregate gross sales per vendor for delivered orders in the period
    const rollups = await this.prisma.$queryRawUnsafe<Array<{
      vendor_id: bigint | number;
      restaurant_id: bigint | number;
      orders: bigint | number;
      gross: number;
    }>>(
      `SELECT r.vendor_id AS vendor_id,
              r.id AS restaurant_id,
              COUNT(*) AS orders,
              COALESCE(SUM(o.order_amount), 0) AS gross
       FROM orders o
       JOIN restaurants r ON r.id = o.restaurant_id
       WHERE o.order_status = 'delivered'
         AND DATE(o.delivered) BETWEEN '${startStr}' AND '${endStr}'
       GROUP BY r.vendor_id, r.id`,
    );

    let created = 0;
    for (const row of rollups) {
      const vid = Number(row.vendor_id);
      const rid = Number(row.restaurant_id);
      const orders = Number(row.orders);
      const gross = Number(row.gross);
      if (gross <= 0) continue;

      // Skip if invoice already exists for this period
      const existing = await this.prisma.$queryRawUnsafe<Array<{ id: number }>>(
        `SELECT id FROM vendor_invoices
         WHERE vendor_id = ? AND restaurant_id = ? AND period_start = ? AND period_end = ?
         LIMIT 1`,
        vid, rid, startStr, endStr,
      );
      if (existing.length > 0) continue;

      // Get commission % from restaurant
      const commRows = await this.prisma.$queryRawUnsafe<Array<{ comission: number; restaurant_model: string }>>(
        `SELECT comission, restaurant_model FROM restaurants WHERE id = ?`,
        rid,
      );
      const commissionPct = Number(commRows[0]?.comission ?? 0);
      const planType = (commRows[0]?.restaurant_model ?? 'commission').toLowerCase();

      const commissionBase = (gross * commissionPct) / 100;
      const ppoBase = planType === 'ppo' ? orders * 10 : 0; // ₹10/order placeholder
      const subFee = 0;
      const taxable = commissionBase + ppoBase + subFee;
      const cgst = taxable * 0.09;
      const sgst = taxable * 0.09;
      const total = taxable + cgst + sgst;
      const tds = total * 0.01;
      const netPayable = gross - total - tds; // what vendor receives

      const invNumber = `INV-${start.getFullYear()}${String(start.getMonth() + 1).padStart(2, '0')}-${vid}-${rid}`;

      await this.prisma.$executeRawUnsafe(
        `INSERT INTO vendor_invoices
         (invoice_number, vendor_id, restaurant_id, plan_type, period_start, period_end,
          gross_sales, order_count, commission_base, ppo_base, subscription_fee,
          taxable_amount, cgst, sgst, igst, total_amount, tds_amount, net_payable,
          status, issued_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'issued', NOW(), NOW(), NOW())`,
        invNumber, vid, rid, planType, startStr, endStr,
        gross, orders, commissionBase, ppoBase, subFee,
        taxable, cgst, sgst, total, tds, netPayable,
      );
      created++;
    }

    return { ok: true, period: { start: startStr, end: endStr }, created };
  }

  async markInvoicePaid(id: number) {
    await this.prisma.$executeRawUnsafe(
      `UPDATE vendor_invoices SET status = 'paid', paid_at = NOW(), updated_at = NOW() WHERE id = ?`,
      id,
    );
    return { ok: true, id };
  }

  async cancelInvoice(id: number, notes?: string) {
    await this.prisma.$executeRawUnsafe(
      `UPDATE vendor_invoices SET status = 'cancelled', notes = ?, updated_at = NOW() WHERE id = ?`,
      notes ?? null, id,
    );
    return { ok: true, id };
  }

  // ╔══════════════════════════════════════════════════════════════╗
  // ║ 2. CREDIT NOTES                                               ║
  // ╚══════════════════════════════════════════════════════════════╝
  async listCreditNotes(filters: { status?: string; limit?: number } = {}) {
    const where = filters.status ? `WHERE cn.status = '${filters.status}'` : '';
    const limit = Math.min(filters.limit ?? 500, 2000);
    const rows = await this.prisma.$queryRawUnsafe<CreditNoteRow[]>(
      `SELECT cn.*,
              CONCAT_WS(' ', u.f_name, u.l_name) AS customer_name,
              r.name AS restaurant_name
       FROM credit_notes cn
       LEFT JOIN users u ON u.id = cn.customer_id
       LEFT JOIN restaurants r ON r.id = cn.restaurant_id
       ${where}
       ORDER BY cn.created_at DESC, cn.id DESC
       LIMIT ${limit}`,
    );
    return rows.map((r) => ({
      ...r,
      id: Number(r.id),
      order_id: Number(r.order_id),
      customer_id: Number(r.customer_id),
      restaurant_id: r.restaurant_id ? Number(r.restaurant_id) : null,
      refund_amount: Number(r.refund_amount),
      tax_reversed: Number(r.tax_reversed),
      delivery_reversed: Number(r.delivery_reversed),
      total_credit: Number(r.total_credit),
      issued_by: r.issued_by ? Number(r.issued_by) : null,
    }));
  }

  async createCreditNote(body: {
    order_id: number;
    refund_amount: number;
    tax_reversed?: number;
    delivery_reversed?: number;
    reason?: string;
    notes?: string;
    issued_by?: number;
  }) {
    if (!body.order_id) throw new BadRequestException({ errors: [{ code: 'order_id', message: 'order_id required' }] });
    if (!body.refund_amount || body.refund_amount <= 0) {
      throw new BadRequestException({ errors: [{ code: 'refund_amount', message: 'refund_amount must be > 0' }] });
    }
    const orderRows = await this.prisma.$queryRawUnsafe<Array<{
      id: number; user_id: number; restaurant_id: number;
    }>>(
      `SELECT id, user_id, restaurant_id FROM orders WHERE id = ? LIMIT 1`,
      body.order_id,
    );
    if (!orderRows.length) throw new NotFoundException({ errors: [{ code: 'order', message: 'order not found' }] });
    const order = orderRows[0];

    const taxReversed = body.tax_reversed ?? 0;
    const delivReversed = body.delivery_reversed ?? 0;
    const total = Number(body.refund_amount) + Number(taxReversed) + Number(delivReversed);
    const today = new Date();
    const cnNumber = `CN-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${body.order_id}`;

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO credit_notes
       (credit_note_number, order_id, customer_id, restaurant_id, reason,
        refund_amount, tax_reversed, delivery_reversed, total_credit,
        status, notes, issued_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'issued', ?, ?, NOW(), NOW())`,
      cnNumber, body.order_id, Number(order.user_id), Number(order.restaurant_id), body.reason ?? null,
      body.refund_amount, taxReversed, delivReversed, total,
      body.notes ?? null, body.issued_by ?? null,
    );
    return { ok: true, credit_note_number: cnNumber, total_credit: total };
  }

  async getCreditNoteStats() {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ status: string; c: bigint | number; total: number }>>(
      `SELECT status, COUNT(*) AS c, COALESCE(SUM(total_credit),0) AS total
       FROM credit_notes GROUP BY status`,
    );
    const summary = { issued: 0, adjusted: 0, cancelled: 0, total_count: 0, total_value: 0 };
    for (const r of rows) {
      const n = Number(r.c); const t = Number(r.total);
      if (r.status in summary) (summary as Record<string, number>)[r.status] = n;
      summary.total_count += n;
      summary.total_value += t;
    }
    return summary;
  }

  // ╔══════════════════════════════════════════════════════════════╗
  // ║ 3. PLATFORM SETTINGS                                          ║
  // ╚══════════════════════════════════════════════════════════════╝
  async listSettings(category?: string) {
    const where = category ? `WHERE category = '${category}'` : '';
    const rows = await this.prisma.$queryRawUnsafe<SettingRow[]>(
      `SELECT id, setting_key, setting_value, value_type, category, label,
              description, min_value, max_value, updated_at
       FROM platform_settings ${where} ORDER BY category, setting_key`,
    );
    return rows.map((r) => ({
      ...r,
      id: Number(r.id),
      min_value: r.min_value !== null ? Number(r.min_value) : null,
      max_value: r.max_value !== null ? Number(r.max_value) : null,
    }));
  }

  async updateSetting(key: string, value: string, updatedBy?: number) {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ value_type: SettingType; min_value: number | null; max_value: number | null }>>(
      `SELECT value_type, min_value, max_value FROM platform_settings WHERE setting_key = ? LIMIT 1`,
      key,
    );
    if (!rows.length) throw new NotFoundException({ errors: [{ code: 'key', message: 'setting not found' }] });
    const meta = rows[0];

    if (meta.value_type === 'int' || meta.value_type === 'float') {
      const n = Number(value);
      if (Number.isNaN(n)) throw new BadRequestException({ errors: [{ code: 'value', message: 'numeric value required' }] });
      if (meta.min_value !== null && n < Number(meta.min_value)) {
        throw new BadRequestException({ errors: [{ code: 'value', message: `min ${meta.min_value}` }] });
      }
      if (meta.max_value !== null && n > Number(meta.max_value)) {
        throw new BadRequestException({ errors: [{ code: 'value', message: `max ${meta.max_value}` }] });
      }
    } else if (meta.value_type === 'bool') {
      if (!['0', '1', 'true', 'false'].includes(value.toLowerCase())) {
        throw new BadRequestException({ errors: [{ code: 'value', message: 'bool must be 0/1/true/false' }] });
      }
    }
    await this.prisma.$executeRawUnsafe(
      `UPDATE platform_settings SET setting_value = ?, updated_by = ?, updated_at = NOW() WHERE setting_key = ?`,
      value, updatedBy ?? null, key,
    );
    return { ok: true, key, value };
  }

  // ╔══════════════════════════════════════════════════════════════╗
  // ║ 4. FRAUD FLAGS                                                ║
  // ╚══════════════════════════════════════════════════════════════╝
  async listFraudFlags(filters: { status?: string; subjectType?: string; limit?: number } = {}) {
    const conds: string[] = [];
    if (filters.status) conds.push(`ff.status = '${filters.status}'`);
    if (filters.subjectType) conds.push(`ff.subject_type = '${filters.subjectType}'`);
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const limit = Math.min(filters.limit ?? 500, 2000);

    const rows = await this.prisma.$queryRawUnsafe<FraudFlagRow[]>(
      `SELECT ff.*,
              CASE
                WHEN ff.subject_type = 'customer' THEN (SELECT CONCAT_WS(' ', u.f_name, u.l_name) FROM users u WHERE u.id = ff.subject_id)
                WHEN ff.subject_type = 'vendor' THEN (SELECT CONCAT_WS(' ', v.f_name, v.l_name) FROM vendors v WHERE v.id = ff.subject_id)
                WHEN ff.subject_type = 'delivery_man' THEN (SELECT CONCAT_WS(' ', dm.f_name, dm.l_name) FROM delivery_men dm WHERE dm.id = ff.subject_id)
                ELSE NULL
              END AS subject_name
       FROM fraud_flags ff
       ${where}
       ORDER BY ff.created_at DESC, ff.id DESC
       LIMIT ${limit}`,
    );
    return rows.map((r) => ({
      ...r,
      id: Number(r.id),
      subject_id: Number(r.subject_id),
      auto_triggered: !!Number(r.auto_triggered),
      flagged_by: r.flagged_by ? Number(r.flagged_by) : null,
      resolved_by: r.resolved_by ? Number(r.resolved_by) : null,
    }));
  }

  async createFraudFlag(body: {
    subject_type: 'customer' | 'vendor' | 'delivery_man';
    subject_id: number;
    flag_type: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    description?: string;
    flagged_by?: number;
  }) {
    if (!body.subject_type || !body.subject_id || !body.flag_type) {
      throw new BadRequestException({ errors: [{ code: 'fields', message: 'subject_type, subject_id, flag_type required' }] });
    }
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO fraud_flags
       (subject_type, subject_id, flag_type, severity, description, auto_triggered, status, flagged_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, 'open', ?, NOW(), NOW())`,
      body.subject_type, body.subject_id, body.flag_type, body.severity ?? 'medium',
      body.description ?? null, body.flagged_by ?? null,
    );
    return { ok: true };
  }

  async resolveFraudFlag(id: number, status: 'investigating' | 'resolved' | 'dismissed', notes: string, resolvedBy: number) {
    await this.prisma.$executeRawUnsafe(
      `UPDATE fraud_flags SET status = ?, resolution_notes = ?, resolved_by = ?,
       resolved_at = CASE WHEN ? IN ('resolved','dismissed') THEN NOW() ELSE resolved_at END,
       updated_at = NOW() WHERE id = ?`,
      status, notes, resolvedBy, status, id,
    );
    return { ok: true, id, status };
  }

  async getFraudStats() {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ status: string; severity: string; c: bigint | number }>>(
      `SELECT status, severity, COUNT(*) AS c FROM fraud_flags GROUP BY status, severity`,
    );
    const byStatus = { open: 0, investigating: 0, resolved: 0, dismissed: 0 };
    const bySeverity = { low: 0, medium: 0, high: 0, critical: 0 };
    let total = 0;
    for (const r of rows) {
      const n = Number(r.c);
      total += n;
      if (r.status in byStatus) (byStatus as Record<string, number>)[r.status] += n;
      if (r.severity in bySeverity) (bySeverity as Record<string, number>)[r.severity] += n;
    }
    return { total, byStatus, bySeverity };
  }

  // ╔══════════════════════════════════════════════════════════════╗
  // ║ 5. VENDOR PROMOTIONS                                          ║
  // ╚══════════════════════════════════════════════════════════════╝
  async listVendorPromos(filters: { status?: string; vendorId?: number; limit?: number } = {}) {
    const conds: string[] = [];
    if (filters.status) conds.push(`vp.status = '${filters.status}'`);
    if (filters.vendorId) conds.push(`vp.vendor_id = ${filters.vendorId}`);
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const limit = Math.min(filters.limit ?? 500, 2000);
    const rows = await this.prisma.$queryRawUnsafe<VendorPromoRow[]>(
      `SELECT vp.*,
              CONCAT_WS(' ', v.f_name, v.l_name) AS vendor_name,
              r.name AS restaurant_name
       FROM vendor_promotions vp
       LEFT JOIN vendors v ON v.id = vp.vendor_id
       LEFT JOIN restaurants r ON r.id = vp.restaurant_id
       ${where}
       ORDER BY vp.created_at DESC, vp.id DESC
       LIMIT ${limit}`,
    );
    return rows.map((r) => ({
      ...r,
      id: Number(r.id),
      vendor_id: Number(r.vendor_id),
      restaurant_id: Number(r.restaurant_id),
      discount_value: r.discount_value !== null ? Number(r.discount_value) : null,
      min_order_value: r.min_order_value !== null ? Number(r.min_order_value) : null,
      max_discount: r.max_discount !== null ? Number(r.max_discount) : null,
      total_uses: Number(r.total_uses),
      reviewed_by: r.reviewed_by ? Number(r.reviewed_by) : null,
    }));
  }

  async approvePromo(id: number, reviewerId: number, remarks?: string) {
    await this.prisma.$executeRawUnsafe(
      `UPDATE vendor_promotions
       SET status = 'approved', admin_remarks = ?, reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      remarks ?? null, reviewerId, id,
    );
    return { ok: true, id };
  }

  async rejectPromo(id: number, reviewerId: number, remarks: string) {
    if (!remarks?.trim()) {
      throw new BadRequestException({ errors: [{ code: 'remarks', message: 'remarks required to reject' }] });
    }
    await this.prisma.$executeRawUnsafe(
      `UPDATE vendor_promotions
       SET status = 'rejected', admin_remarks = ?, reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      remarks, reviewerId, id,
    );
    return { ok: true, id };
  }

  async pausePromo(id: number, paused: boolean) {
    await this.prisma.$executeRawUnsafe(
      `UPDATE vendor_promotions SET status = ?, updated_at = NOW() WHERE id = ?`,
      paused ? 'paused' : 'approved', id,
    );
    return { ok: true, id };
  }

  async getPromoStats() {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ status: string; c: bigint | number }>>(
      `SELECT status, COUNT(*) AS c FROM vendor_promotions GROUP BY status`,
    );
    const summary: Record<string, number> = { draft: 0, pending: 0, approved: 0, rejected: 0, live: 0, paused: 0, expired: 0, total: 0 };
    for (const r of rows) {
      const n = Number(r.c);
      summary[r.status] = n;
      summary.total += n;
    }
    return summary;
  }
}
