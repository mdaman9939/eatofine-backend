"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompletionService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let CompletionService = class CompletionService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listInvoices(filters = {}) {
        const conds = [];
        if (filters.vendorId)
            conds.push(`vi.vendor_id = ${filters.vendorId}`);
        if (filters.status)
            conds.push(`vi.status = '${filters.status}'`);
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
        const limit = Math.min(filters.limit ?? 500, 2000);
        const rows = await this.prisma.$queryRawUnsafe(`SELECT vi.*,
              CONCAT_WS(' ', v.f_name, v.l_name) AS vendor_name,
              r.name AS restaurant_name
       FROM vendor_invoices vi
       LEFT JOIN vendors v ON v.id = vi.vendor_id
       LEFT JOIN restaurants r ON r.id = vi.restaurant_id
       ${where}
       ORDER BY vi.period_end DESC, vi.id DESC
       LIMIT ${limit}`);
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
        const rows = await this.prisma.$queryRawUnsafe(`SELECT status, COUNT(*) AS c, COALESCE(SUM(total_amount),0) AS total
       FROM vendor_invoices GROUP BY status`);
        const summary = {
            draft: 0, issued: 0, paid: 0, cancelled: 0, total_count: 0,
            total_value: 0, paid_value: 0, outstanding_value: 0,
        };
        for (const r of rows) {
            const n = Number(r.c);
            const t = Number(r.total);
            if (r.status in summary)
                summary[r.status] = n;
            summary.total_count += n;
            summary.total_value += t;
            if (r.status === 'paid')
                summary.paid_value += t;
            if (r.status === 'issued')
                summary.outstanding_value += t;
        }
        return summary;
    }
    async generateMonthlyInvoices(periodStart, periodEnd) {
        const now = new Date();
        const start = periodStart ? new Date(periodStart) : new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = periodEnd ? new Date(periodEnd) : new Date(now.getFullYear(), now.getMonth(), 0);
        const startStr = start.toISOString().slice(0, 10);
        const endStr = end.toISOString().slice(0, 10);
        const rollups = await this.prisma.$queryRawUnsafe(`SELECT r.vendor_id AS vendor_id,
              r.id AS restaurant_id,
              COUNT(*) AS orders,
              COALESCE(SUM(o.order_amount), 0) AS gross
       FROM orders o
       JOIN restaurants r ON r.id = o.restaurant_id
       WHERE o.order_status = 'delivered'
         AND DATE(o.delivered) BETWEEN '${startStr}' AND '${endStr}'
       GROUP BY r.vendor_id, r.id`);
        let created = 0;
        for (const row of rollups) {
            const vid = Number(row.vendor_id);
            const rid = Number(row.restaurant_id);
            const orders = Number(row.orders);
            const gross = Number(row.gross);
            if (gross <= 0)
                continue;
            const existing = await this.prisma.$queryRawUnsafe(`SELECT id FROM vendor_invoices
         WHERE vendor_id = ? AND restaurant_id = ? AND period_start = ? AND period_end = ?
         LIMIT 1`, vid, rid, startStr, endStr);
            if (existing.length > 0)
                continue;
            const commRows = await this.prisma.$queryRawUnsafe(`SELECT comission, restaurant_model FROM restaurants WHERE id = ?`, rid);
            const commissionPct = Number(commRows[0]?.comission ?? 0);
            const planType = (commRows[0]?.restaurant_model ?? 'commission').toLowerCase();
            const commissionBase = (gross * commissionPct) / 100;
            const ppoBase = planType === 'ppo' ? orders * 10 : 0;
            const subFee = 0;
            const taxable = commissionBase + ppoBase + subFee;
            const cgst = taxable * 0.09;
            const sgst = taxable * 0.09;
            const total = taxable + cgst + sgst;
            const tds = total * 0.01;
            const netPayable = gross - total - tds;
            const invNumber = `INV-${start.getFullYear()}${String(start.getMonth() + 1).padStart(2, '0')}-${vid}-${rid}`;
            await this.prisma.$executeRawUnsafe(`INSERT INTO vendor_invoices
         (invoice_number, vendor_id, restaurant_id, plan_type, period_start, period_end,
          gross_sales, order_count, commission_base, ppo_base, subscription_fee,
          taxable_amount, cgst, sgst, igst, total_amount, tds_amount, net_payable,
          status, issued_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'issued', NOW(), NOW(), NOW())`, invNumber, vid, rid, planType, startStr, endStr, gross, orders, commissionBase, ppoBase, subFee, taxable, cgst, sgst, total, tds, netPayable);
            created++;
        }
        return { ok: true, period: { start: startStr, end: endStr }, created };
    }
    async markInvoicePaid(id) {
        await this.prisma.$executeRawUnsafe(`UPDATE vendor_invoices SET status = 'paid', paid_at = NOW(), updated_at = NOW() WHERE id = ?`, id);
        return { ok: true, id };
    }
    async cancelInvoice(id, notes) {
        await this.prisma.$executeRawUnsafe(`UPDATE vendor_invoices SET status = 'cancelled', notes = ?, updated_at = NOW() WHERE id = ?`, notes ?? null, id);
        return { ok: true, id };
    }
    async listCreditNotes(filters = {}) {
        const where = filters.status ? `WHERE cn.status = '${filters.status}'` : '';
        const limit = Math.min(filters.limit ?? 500, 2000);
        const rows = await this.prisma.$queryRawUnsafe(`SELECT cn.*,
              CONCAT_WS(' ', u.f_name, u.l_name) AS customer_name,
              r.name AS restaurant_name
       FROM credit_notes cn
       LEFT JOIN users u ON u.id = cn.customer_id
       LEFT JOIN restaurants r ON r.id = cn.restaurant_id
       ${where}
       ORDER BY cn.created_at DESC, cn.id DESC
       LIMIT ${limit}`);
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
    async createCreditNote(body) {
        if (!body.order_id)
            throw new common_1.BadRequestException({ errors: [{ code: 'order_id', message: 'order_id required' }] });
        if (!body.refund_amount || body.refund_amount <= 0) {
            throw new common_1.BadRequestException({ errors: [{ code: 'refund_amount', message: 'refund_amount must be > 0' }] });
        }
        const orderRows = await this.prisma.$queryRawUnsafe(`SELECT id, user_id, restaurant_id FROM orders WHERE id = ? LIMIT 1`, body.order_id);
        if (!orderRows.length)
            throw new common_1.NotFoundException({ errors: [{ code: 'order', message: 'order not found' }] });
        const order = orderRows[0];
        const taxReversed = body.tax_reversed ?? 0;
        const delivReversed = body.delivery_reversed ?? 0;
        const total = Number(body.refund_amount) + Number(taxReversed) + Number(delivReversed);
        const today = new Date();
        const cnNumber = `CN-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${body.order_id}`;
        await this.prisma.$executeRawUnsafe(`INSERT INTO credit_notes
       (credit_note_number, order_id, customer_id, restaurant_id, reason,
        refund_amount, tax_reversed, delivery_reversed, total_credit,
        status, notes, issued_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'issued', ?, ?, NOW(), NOW())`, cnNumber, body.order_id, Number(order.user_id), Number(order.restaurant_id), body.reason ?? null, body.refund_amount, taxReversed, delivReversed, total, body.notes ?? null, body.issued_by ?? null);
        return { ok: true, credit_note_number: cnNumber, total_credit: total };
    }
    async getCreditNoteStats() {
        const rows = await this.prisma.$queryRawUnsafe(`SELECT status, COUNT(*) AS c, COALESCE(SUM(total_credit),0) AS total
       FROM credit_notes GROUP BY status`);
        const summary = { issued: 0, adjusted: 0, cancelled: 0, total_count: 0, total_value: 0 };
        for (const r of rows) {
            const n = Number(r.c);
            const t = Number(r.total);
            if (r.status in summary)
                summary[r.status] = n;
            summary.total_count += n;
            summary.total_value += t;
        }
        return summary;
    }
    async listSettings(category) {
        const where = category ? `WHERE category = '${category}'` : '';
        const rows = await this.prisma.$queryRawUnsafe(`SELECT id, setting_key, setting_value, value_type, category, label,
              description, min_value, max_value, updated_at
       FROM platform_settings ${where} ORDER BY category, setting_key`);
        return rows.map((r) => ({
            ...r,
            id: Number(r.id),
            min_value: r.min_value !== null ? Number(r.min_value) : null,
            max_value: r.max_value !== null ? Number(r.max_value) : null,
        }));
    }
    async updateSetting(key, value, updatedBy) {
        const rows = await this.prisma.$queryRawUnsafe(`SELECT value_type, min_value, max_value FROM platform_settings WHERE setting_key = ? LIMIT 1`, key);
        if (!rows.length)
            throw new common_1.NotFoundException({ errors: [{ code: 'key', message: 'setting not found' }] });
        const meta = rows[0];
        if (meta.value_type === 'int' || meta.value_type === 'float') {
            const n = Number(value);
            if (Number.isNaN(n))
                throw new common_1.BadRequestException({ errors: [{ code: 'value', message: 'numeric value required' }] });
            if (meta.min_value !== null && n < Number(meta.min_value)) {
                throw new common_1.BadRequestException({ errors: [{ code: 'value', message: `min ${meta.min_value}` }] });
            }
            if (meta.max_value !== null && n > Number(meta.max_value)) {
                throw new common_1.BadRequestException({ errors: [{ code: 'value', message: `max ${meta.max_value}` }] });
            }
        }
        else if (meta.value_type === 'bool') {
            if (!['0', '1', 'true', 'false'].includes(value.toLowerCase())) {
                throw new common_1.BadRequestException({ errors: [{ code: 'value', message: 'bool must be 0/1/true/false' }] });
            }
        }
        await this.prisma.$executeRawUnsafe(`UPDATE platform_settings SET setting_value = ?, updated_by = ?, updated_at = NOW() WHERE setting_key = ?`, value, updatedBy ?? null, key);
        return { ok: true, key, value };
    }
    async listFraudFlags(filters = {}) {
        const conds = [];
        if (filters.status)
            conds.push(`ff.status = '${filters.status}'`);
        if (filters.subjectType)
            conds.push(`ff.subject_type = '${filters.subjectType}'`);
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
        const limit = Math.min(filters.limit ?? 500, 2000);
        const rows = await this.prisma.$queryRawUnsafe(`SELECT ff.*,
              CASE
                WHEN ff.subject_type = 'customer' THEN (SELECT CONCAT_WS(' ', u.f_name, u.l_name) FROM users u WHERE u.id = ff.subject_id)
                WHEN ff.subject_type = 'vendor' THEN (SELECT CONCAT_WS(' ', v.f_name, v.l_name) FROM vendors v WHERE v.id = ff.subject_id)
                WHEN ff.subject_type = 'delivery_man' THEN (SELECT CONCAT_WS(' ', dm.f_name, dm.l_name) FROM delivery_men dm WHERE dm.id = ff.subject_id)
                ELSE NULL
              END AS subject_name
       FROM fraud_flags ff
       ${where}
       ORDER BY ff.created_at DESC, ff.id DESC
       LIMIT ${limit}`);
        return rows.map((r) => ({
            ...r,
            id: Number(r.id),
            subject_id: Number(r.subject_id),
            auto_triggered: !!Number(r.auto_triggered),
            flagged_by: r.flagged_by ? Number(r.flagged_by) : null,
            resolved_by: r.resolved_by ? Number(r.resolved_by) : null,
        }));
    }
    async createFraudFlag(body) {
        if (!body.subject_type || !body.subject_id || !body.flag_type) {
            throw new common_1.BadRequestException({ errors: [{ code: 'fields', message: 'subject_type, subject_id, flag_type required' }] });
        }
        await this.prisma.$executeRawUnsafe(`INSERT INTO fraud_flags
       (subject_type, subject_id, flag_type, severity, description, auto_triggered, status, flagged_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, 'open', ?, NOW(), NOW())`, body.subject_type, body.subject_id, body.flag_type, body.severity ?? 'medium', body.description ?? null, body.flagged_by ?? null);
        return { ok: true };
    }
    async resolveFraudFlag(id, status, notes, resolvedBy) {
        await this.prisma.$executeRawUnsafe(`UPDATE fraud_flags SET status = ?, resolution_notes = ?, resolved_by = ?,
       resolved_at = CASE WHEN ? IN ('resolved','dismissed') THEN NOW() ELSE resolved_at END,
       updated_at = NOW() WHERE id = ?`, status, notes, resolvedBy, status, id);
        return { ok: true, id, status };
    }
    async getFraudStats() {
        const rows = await this.prisma.$queryRawUnsafe(`SELECT status, severity, COUNT(*) AS c FROM fraud_flags GROUP BY status, severity`);
        const byStatus = { open: 0, investigating: 0, resolved: 0, dismissed: 0 };
        const bySeverity = { low: 0, medium: 0, high: 0, critical: 0 };
        let total = 0;
        for (const r of rows) {
            const n = Number(r.c);
            total += n;
            if (r.status in byStatus)
                byStatus[r.status] += n;
            if (r.severity in bySeverity)
                bySeverity[r.severity] += n;
        }
        return { total, byStatus, bySeverity };
    }
    async listVendorPromos(filters = {}) {
        const conds = [];
        if (filters.status)
            conds.push(`vp.status = '${filters.status}'`);
        if (filters.vendorId)
            conds.push(`vp.vendor_id = ${filters.vendorId}`);
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
        const limit = Math.min(filters.limit ?? 500, 2000);
        const rows = await this.prisma.$queryRawUnsafe(`SELECT vp.*,
              CONCAT_WS(' ', v.f_name, v.l_name) AS vendor_name,
              r.name AS restaurant_name
       FROM vendor_promotions vp
       LEFT JOIN vendors v ON v.id = vp.vendor_id
       LEFT JOIN restaurants r ON r.id = vp.restaurant_id
       ${where}
       ORDER BY vp.created_at DESC, vp.id DESC
       LIMIT ${limit}`);
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
    async approvePromo(id, reviewerId, remarks) {
        await this.prisma.$executeRawUnsafe(`UPDATE vendor_promotions
       SET status = 'approved', admin_remarks = ?, reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = ?`, remarks ?? null, reviewerId, id);
        return { ok: true, id };
    }
    async rejectPromo(id, reviewerId, remarks) {
        if (!remarks?.trim()) {
            throw new common_1.BadRequestException({ errors: [{ code: 'remarks', message: 'remarks required to reject' }] });
        }
        await this.prisma.$executeRawUnsafe(`UPDATE vendor_promotions
       SET status = 'rejected', admin_remarks = ?, reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = ?`, remarks, reviewerId, id);
        return { ok: true, id };
    }
    async pausePromo(id, paused) {
        await this.prisma.$executeRawUnsafe(`UPDATE vendor_promotions SET status = ?, updated_at = NOW() WHERE id = ?`, paused ? 'paused' : 'approved', id);
        return { ok: true, id };
    }
    async getPromoStats() {
        const rows = await this.prisma.$queryRawUnsafe(`SELECT status, COUNT(*) AS c FROM vendor_promotions GROUP BY status`);
        const summary = { draft: 0, pending: 0, approved: 0, rejected: 0, live: 0, paused: 0, expired: 0, total: 0 };
        for (const r of rows) {
            const n = Number(r.c);
            summary[r.status] = n;
            summary.total += n;
        }
        return summary;
    }
};
exports.CompletionService = CompletionService;
exports.CompletionService = CompletionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CompletionService);
//# sourceMappingURL=completion.service.js.map