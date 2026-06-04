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
const mongo_data_service_1 = require("../mongo/mongo-data.service");
let CompletionService = class CompletionService {
    prisma;
    mongo;
    constructor(prisma, mongo) {
        this.prisma = prisma;
        this.mongo = mongo;
    }
    useMongo() {
        const v = (process.env.USE_MONGO_COMPLETION ?? '1').toLowerCase();
        return v === '1' || v === 'true' || v === 'yes';
    }
    async vendorNameMongo(vendorId) {
        const v = await this.mongo.findByMysqlId('vendors', vendorId);
        if (!v)
            return null;
        return [v.f_name, v.l_name].filter((x) => x != null && String(x).length > 0).join(' ') || null;
    }
    async restaurantNameMongo(restaurantId) {
        if (restaurantId == null)
            return null;
        const r = await this.mongo.findByMysqlId('restaurants', Number(restaurantId));
        return r?.name ?? null;
    }
    async userNameMongo(userId) {
        const u = await this.mongo.findByMysqlId('users', userId);
        if (!u)
            return null;
        return [u.f_name, u.l_name].filter((x) => x != null && String(x).length > 0).join(' ') || null;
    }
    async subjectNameMongo(subjectType, subjectId) {
        if (subjectType === 'customer')
            return this.userNameMongo(subjectId);
        if (subjectType === 'vendor')
            return this.vendorNameMongo(subjectId);
        if (subjectType === 'delivery_man') {
            const dm = await this.mongo.findByMysqlId('delivery_men', subjectId);
            if (!dm)
                return null;
            return [dm.f_name, dm.l_name].filter((x) => x != null && String(x).length > 0).join(' ') || null;
        }
        return null;
    }
    async listInvoices(filters = {}) {
        const limit = Math.min(filters.limit ?? 500, 2000);
        if (this.useMongo()) {
            const filter = {};
            if (filters.vendorId)
                filter.vendor_id = Number(filters.vendorId);
            if (filters.status)
                filter.status = filters.status;
            const docs = await this.mongo.findMany('vendor_invoices', filter, {
                sort: { period_end: -1, mysql_id: -1 },
                limit,
            });
            const out = [];
            for (const d of docs) {
                out.push({
                    id: Number(d.mysql_id),
                    invoice_number: d.invoice_number,
                    vendor_id: Number(d.vendor_id),
                    restaurant_id: d.restaurant_id != null ? Number(d.restaurant_id) : null,
                    plan_type: d.plan_type,
                    period_start: d.period_start,
                    period_end: d.period_end,
                    gross_sales: Number(d.gross_sales ?? 0),
                    order_count: Number(d.order_count ?? 0),
                    commission_base: Number(d.commission_base ?? 0),
                    ppo_base: Number(d.ppo_base ?? 0),
                    subscription_fee: Number(d.subscription_fee ?? 0),
                    taxable_amount: Number(d.taxable_amount ?? 0),
                    cgst: Number(d.cgst ?? 0),
                    sgst: Number(d.sgst ?? 0),
                    igst: Number(d.igst ?? 0),
                    total_amount: Number(d.total_amount ?? 0),
                    tds_amount: Number(d.tds_amount ?? 0),
                    net_payable: Number(d.net_payable ?? 0),
                    status: d.status,
                    notes: d.notes ?? null,
                    issued_at: d.issued_at ?? null,
                    paid_at: d.paid_at ?? null,
                    created_at: d.created_at ?? null,
                    vendor_name: await this.vendorNameMongo(Number(d.vendor_id)),
                    restaurant_name: await this.restaurantNameMongo(d.restaurant_id),
                });
            }
            return out;
        }
        const conds = [];
        if (filters.vendorId)
            conds.push(`vi.vendor_id = ${filters.vendorId}`);
        if (filters.status)
            conds.push(`vi.status = '${filters.status}'`);
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
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
    async getInvoiceById(id) {
        if (this.useMongo()) {
            const d = await this.mongo.findByMysqlId('vendor_invoices', id);
            if (!d)
                return null;
            const restaurant = d.restaurant_id != null
                ? await this.mongo.findByMysqlId('restaurants', Number(d.restaurant_id))
                : null;
            const vendor = d.vendor_id != null
                ? await this.mongo.findByMysqlId('vendors', Number(d.vendor_id))
                : null;
            return {
                id: Number(d.mysql_id),
                invoice_number: d.invoice_number,
                plan_type: d.plan_type,
                period_start: d.period_start,
                period_end: d.period_end,
                gross_sales: Number(d.gross_sales ?? 0),
                order_count: Number(d.order_count ?? 0),
                subscription_fee: Number(d.subscription_fee ?? 0),
                commission_base: Number(d.commission_base ?? 0),
                ppo_base: Number(d.ppo_base ?? 0),
                taxable_amount: Number(d.taxable_amount ?? 0),
                cgst: Number(d.cgst ?? 0),
                sgst: Number(d.sgst ?? 0),
                igst: Number(d.igst ?? 0),
                total_amount: Number(d.total_amount ?? 0),
                tds_amount: Number(d.tds_amount ?? 0),
                net_payable: Number(d.net_payable ?? 0),
                status: d.status,
                notes: d.notes ?? null,
                issued_at: d.issued_at ?? null,
                paid_at: d.paid_at ?? null,
                created_at: d.created_at ?? null,
                restaurant: restaurant ? {
                    id: restaurant.mysql_id,
                    name: restaurant.name ?? null,
                    registered_name: restaurant.registered_name ?? null,
                    address: restaurant.address ?? null,
                    phone: restaurant.phone ?? null,
                    email: restaurant.email ?? null,
                    gstin: restaurant.gstin ?? null,
                    cin: restaurant.cin ?? null,
                    fssai: restaurant.fssai ?? null,
                    state_code: restaurant.state_code ?? null,
                } : null,
                vendor: vendor ? {
                    id: vendor.mysql_id,
                    name: [vendor.f_name, vendor.l_name].filter(Boolean).join(' '),
                    email: vendor.email ?? null,
                    phone: vendor.phone ?? null,
                } : null,
            };
        }
        const rows = await this.prisma.$queryRawUnsafe(`SELECT vi.*, r.name AS restaurant_name, r.address AS restaurant_address,
              r.phone AS restaurant_phone, r.email AS restaurant_email
       FROM vendor_invoices vi
       LEFT JOIN restaurants r ON r.id = vi.restaurant_id
       WHERE vi.id = ${id} LIMIT 1`);
        if (rows.length === 0)
            return null;
        const r = rows[0];
        return {
            id: Number(r.id),
            invoice_number: String(r.invoice_number),
            plan_type: String(r.plan_type),
            period_start: r.period_start,
            period_end: r.period_end,
            gross_sales: Number(r.gross_sales ?? 0),
            order_count: Number(r.order_count ?? 0),
            subscription_fee: Number(r.subscription_fee ?? 0),
            commission_base: Number(r.commission_base ?? 0),
            ppo_base: Number(r.ppo_base ?? 0),
            taxable_amount: Number(r.taxable_amount ?? 0),
            cgst: Number(r.cgst ?? 0),
            sgst: Number(r.sgst ?? 0),
            igst: Number(r.igst ?? 0),
            total_amount: Number(r.total_amount ?? 0),
            tds_amount: Number(r.tds_amount ?? 0),
            net_payable: Number(r.net_payable ?? 0),
            status: r.status,
            notes: r.notes ?? null,
            issued_at: r.issued_at,
            paid_at: r.paid_at,
            created_at: r.created_at,
            restaurant: r.restaurant_id ? {
                id: Number(r.restaurant_id),
                name: r.restaurant_name ?? null,
                registered_name: null,
                address: r.restaurant_address ?? null,
                phone: r.restaurant_phone ?? null,
                email: r.restaurant_email ?? null,
                gstin: null, cin: null, fssai: null, state_code: null,
            } : null,
            vendor: null,
        };
    }
    async getInvoiceStats() {
        if (this.useMongo()) {
            const rows = await this.mongo.aggregate('vendor_invoices', [
                {
                    $group: {
                        _id: '$status',
                        c: { $sum: 1 },
                        total: { $sum: { $ifNull: ['$total_amount', 0] } },
                    },
                },
            ]);
            const summary = {
                draft: 0, issued: 0, paid: 0, cancelled: 0, total_count: 0,
                total_value: 0, paid_value: 0, outstanding_value: 0,
            };
            for (const r of rows) {
                const n = Number(r.c ?? 0);
                const t = Number(r.total ?? 0);
                const status = String(r._id);
                if (status in summary)
                    summary[status] = n;
                summary.total_count += n;
                summary.total_value += t;
                if (status === 'paid')
                    summary.paid_value += t;
                if (status === 'issued')
                    summary.outstanding_value += t;
            }
            return summary;
        }
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
        if (this.useMongo()) {
            const dayStart = new Date(`${startStr}T00:00:00.000Z`);
            const dayEnd = new Date(`${endStr}T00:00:00.000Z`);
            dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
            const rollups = await this.mongo.aggregate('orders', [
                {
                    $match: {
                        order_status: 'delivered',
                        delivered: { $gte: dayStart, $lt: dayEnd },
                    },
                },
                {
                    $group: {
                        _id: { restaurant_id: '$mysql_restaurant_id' },
                        orders: { $sum: 1 },
                        gross: { $sum: { $ifNull: ['$order_amount', 0] } },
                    },
                },
            ]);
            let created = 0;
            for (const row of rollups) {
                const rid = Number(row._id?.restaurant_id ?? 0);
                if (!rid)
                    continue;
                const restaurant = await this.mongo.findByMysqlId('restaurants', rid);
                if (!restaurant)
                    continue;
                const vendorId = await this.mongo.findOne('restaurants', { mysql_id: rid });
                const vid = Number(vendorId?.mysql_vendor_id ?? 0);
                if (!vid)
                    continue;
                const orders = Number(row.orders ?? 0);
                const gross = Number(row.gross ?? 0);
                if (gross <= 0)
                    continue;
                const existing = await this.mongo.findOne('vendor_invoices', {
                    vendor_id: vid,
                    restaurant_id: rid,
                    period_start: startStr,
                    period_end: endStr,
                });
                if (existing)
                    continue;
                const commissionPct = Number(restaurant.comission ?? 0);
                const planType = (restaurant.restaurant_model ?? 'commission').toLowerCase();
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
                const mysqlId = await this.mongo.nextMysqlId('vendor_invoices');
                const nowDate = new Date();
                await this.mongo.insertOne('vendor_invoices', {
                    mysql_id: mysqlId,
                    invoice_number: invNumber,
                    vendor_id: vid,
                    restaurant_id: rid,
                    plan_type: planType,
                    period_start: startStr,
                    period_end: endStr,
                    gross_sales: gross,
                    order_count: orders,
                    commission_base: commissionBase,
                    ppo_base: ppoBase,
                    subscription_fee: subFee,
                    taxable_amount: taxable,
                    cgst,
                    sgst,
                    igst: 0,
                    total_amount: total,
                    tds_amount: tds,
                    net_payable: netPayable,
                    status: 'issued',
                    issued_at: nowDate,
                    created_at: nowDate,
                    updated_at: nowDate,
                });
                created++;
            }
            return { ok: true, period: { start: startStr, end: endStr }, created };
        }
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
        if (this.useMongo()) {
            const now = new Date();
            await this.mongo.updateOne('vendor_invoices', { mysql_id: Number(id) }, { status: 'paid', paid_at: now, updated_at: now });
            return { ok: true, id };
        }
        await this.prisma.$executeRawUnsafe(`UPDATE vendor_invoices SET status = 'paid', paid_at = NOW(), updated_at = NOW() WHERE id = ?`, id);
        return { ok: true, id };
    }
    async cancelInvoice(id, notes) {
        if (this.useMongo()) {
            await this.mongo.updateOne('vendor_invoices', { mysql_id: Number(id) }, { status: 'cancelled', notes: notes ?? null, updated_at: new Date() });
            return { ok: true, id };
        }
        await this.prisma.$executeRawUnsafe(`UPDATE vendor_invoices SET status = 'cancelled', notes = ?, updated_at = NOW() WHERE id = ?`, notes ?? null, id);
        return { ok: true, id };
    }
    async listCreditNotes(filters = {}) {
        const limit = Math.min(filters.limit ?? 500, 2000);
        if (this.useMongo()) {
            const filter = {};
            if (filters.status)
                filter.status = filters.status;
            const docs = await this.mongo.findMany('credit_notes', filter, {
                sort: { created_at: -1, mysql_id: -1 },
                limit,
            });
            const out = [];
            for (const d of docs) {
                out.push({
                    id: Number(d.mysql_id),
                    credit_note_number: d.credit_note_number,
                    order_id: Number(d.order_id),
                    customer_id: Number(d.customer_id),
                    restaurant_id: d.restaurant_id != null ? Number(d.restaurant_id) : null,
                    reason: d.reason ?? null,
                    refund_amount: Number(d.refund_amount ?? 0),
                    tax_reversed: Number(d.tax_reversed ?? 0),
                    delivery_reversed: Number(d.delivery_reversed ?? 0),
                    total_credit: Number(d.total_credit ?? 0),
                    status: d.status,
                    notes: d.notes ?? null,
                    issued_by: d.issued_by != null ? Number(d.issued_by) : null,
                    created_at: d.created_at ?? null,
                    customer_name: await this.userNameMongo(Number(d.customer_id)),
                    restaurant_name: await this.restaurantNameMongo(d.restaurant_id),
                });
            }
            return out;
        }
        const where = filters.status ? `WHERE cn.status = '${filters.status}'` : '';
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
        if (this.useMongo()) {
            const order = await this.mongo.findByMysqlId('orders', body.order_id);
            if (!order)
                throw new common_1.NotFoundException({ errors: [{ code: 'order', message: 'order not found' }] });
            const taxReversed = body.tax_reversed ?? 0;
            const delivReversed = body.delivery_reversed ?? 0;
            const total = Number(body.refund_amount) + Number(taxReversed) + Number(delivReversed);
            const today = new Date();
            const cnNumber = `CN-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${body.order_id}`;
            const mysqlId = await this.mongo.nextMysqlId('credit_notes');
            await this.mongo.insertOne('credit_notes', {
                mysql_id: mysqlId,
                credit_note_number: cnNumber,
                order_id: Number(body.order_id),
                customer_id: Number(order.mysql_user_id ?? 0),
                restaurant_id: order.mysql_restaurant_id != null ? Number(order.mysql_restaurant_id) : null,
                reason: body.reason ?? null,
                refund_amount: Number(body.refund_amount),
                tax_reversed: Number(taxReversed),
                delivery_reversed: Number(delivReversed),
                total_credit: total,
                status: 'issued',
                notes: body.notes ?? null,
                issued_by: body.issued_by ?? null,
                created_at: today,
                updated_at: today,
            });
            return { ok: true, credit_note_number: cnNumber, total_credit: total };
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
        if (this.useMongo()) {
            const rows = await this.mongo.aggregate('credit_notes', [
                {
                    $group: {
                        _id: '$status',
                        c: { $sum: 1 },
                        total: { $sum: { $ifNull: ['$total_credit', 0] } },
                    },
                },
            ]);
            const summary = { issued: 0, adjusted: 0, cancelled: 0, total_count: 0, total_value: 0 };
            for (const r of rows) {
                const n = Number(r.c ?? 0);
                const t = Number(r.total ?? 0);
                const status = String(r._id);
                if (status in summary)
                    summary[status] = n;
                summary.total_count += n;
                summary.total_value += t;
            }
            return summary;
        }
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
        if (this.useMongo()) {
            const filter = {};
            if (category)
                filter.category = category;
            const docs = await this.mongo.findMany('platform_settings', filter, {
                sort: { category: 1, setting_key: 1 },
            });
            return docs.map((d) => ({
                id: Number(d.mysql_id),
                setting_key: d.setting_key,
                setting_value: d.setting_value,
                value_type: d.value_type,
                category: d.category,
                label: d.label,
                description: d.description ?? null,
                min_value: d.min_value != null ? Number(d.min_value) : null,
                max_value: d.max_value != null ? Number(d.max_value) : null,
                updated_at: d.updated_at ?? null,
            }));
        }
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
        if (this.useMongo()) {
            const meta = await this.mongo.findOne('platform_settings', { setting_key: key });
            if (!meta)
                throw new common_1.NotFoundException({ errors: [{ code: 'key', message: 'setting not found' }] });
            if (meta.value_type === 'int' || meta.value_type === 'float') {
                const n = Number(value);
                if (Number.isNaN(n))
                    throw new common_1.BadRequestException({ errors: [{ code: 'value', message: 'numeric value required' }] });
                if (meta.min_value != null && n < Number(meta.min_value)) {
                    throw new common_1.BadRequestException({ errors: [{ code: 'value', message: `min ${meta.min_value}` }] });
                }
                if (meta.max_value != null && n > Number(meta.max_value)) {
                    throw new common_1.BadRequestException({ errors: [{ code: 'value', message: `max ${meta.max_value}` }] });
                }
            }
            else if (meta.value_type === 'bool') {
                if (!['0', '1', 'true', 'false'].includes(value.toLowerCase())) {
                    throw new common_1.BadRequestException({ errors: [{ code: 'value', message: 'bool must be 0/1/true/false' }] });
                }
            }
            await this.mongo.updateOne('platform_settings', { setting_key: key }, { setting_value: value, updated_by: updatedBy ?? null, updated_at: new Date() });
            return { ok: true, key, value };
        }
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
        const limit = Math.min(filters.limit ?? 500, 2000);
        if (this.useMongo()) {
            const filter = {};
            if (filters.status)
                filter.status = filters.status;
            if (filters.subjectType)
                filter.subject_type = filters.subjectType;
            const docs = await this.mongo.findMany('fraud_flags', filter, {
                sort: { created_at: -1, mysql_id: -1 },
                limit,
            });
            const out = [];
            for (const d of docs) {
                out.push({
                    id: Number(d.mysql_id),
                    subject_type: d.subject_type,
                    subject_id: Number(d.subject_id),
                    subject_name: await this.subjectNameMongo(d.subject_type, Number(d.subject_id)),
                    flag_type: d.flag_type,
                    severity: d.severity,
                    description: d.description ?? null,
                    auto_triggered: d.auto_triggered ? 1 : 0,
                    status: d.status,
                    flagged_by: d.flagged_by != null ? Number(d.flagged_by) : null,
                    resolved_by: d.resolved_by != null ? Number(d.resolved_by) : null,
                    resolved_at: d.resolved_at ?? null,
                    resolution_notes: d.resolution_notes ?? null,
                    created_at: d.created_at ?? null,
                });
            }
            return out.map((r) => ({
                ...r,
                auto_triggered: !!Number(r.auto_triggered),
            }));
        }
        const conds = [];
        if (filters.status)
            conds.push(`ff.status = '${filters.status}'`);
        if (filters.subjectType)
            conds.push(`ff.subject_type = '${filters.subjectType}'`);
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
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
        if (this.useMongo()) {
            const now = new Date();
            const mysqlId = await this.mongo.nextMysqlId('fraud_flags');
            await this.mongo.insertOne('fraud_flags', {
                mysql_id: mysqlId,
                subject_type: body.subject_type,
                subject_id: Number(body.subject_id),
                flag_type: body.flag_type,
                severity: body.severity ?? 'medium',
                description: body.description ?? null,
                auto_triggered: false,
                status: 'open',
                flagged_by: body.flagged_by ?? null,
                created_at: now,
                updated_at: now,
            });
            return { ok: true };
        }
        await this.prisma.$executeRawUnsafe(`INSERT INTO fraud_flags
       (subject_type, subject_id, flag_type, severity, description, auto_triggered, status, flagged_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, 'open', ?, NOW(), NOW())`, body.subject_type, body.subject_id, body.flag_type, body.severity ?? 'medium', body.description ?? null, body.flagged_by ?? null);
        return { ok: true };
    }
    async resolveFraudFlag(id, status, notes, resolvedBy) {
        if (this.useMongo()) {
            const now = new Date();
            const set = {
                status,
                resolution_notes: notes,
                resolved_by: Number(resolvedBy),
                updated_at: now,
            };
            if (status === 'resolved' || status === 'dismissed') {
                set.resolved_at = now;
            }
            await this.mongo.updateOne('fraud_flags', { mysql_id: Number(id) }, set);
            return { ok: true, id, status };
        }
        await this.prisma.$executeRawUnsafe(`UPDATE fraud_flags SET status = ?, resolution_notes = ?, resolved_by = ?,
       resolved_at = CASE WHEN ? IN ('resolved','dismissed') THEN NOW() ELSE resolved_at END,
       updated_at = NOW() WHERE id = ?`, status, notes, resolvedBy, status, id);
        return { ok: true, id, status };
    }
    async getFraudStats() {
        if (this.useMongo()) {
            const rows = await this.mongo.aggregate('fraud_flags', [
                {
                    $group: {
                        _id: { status: '$status', severity: '$severity' },
                        c: { $sum: 1 },
                    },
                },
            ]);
            const byStatus = { open: 0, investigating: 0, resolved: 0, dismissed: 0 };
            const bySeverity = { low: 0, medium: 0, high: 0, critical: 0 };
            let total = 0;
            for (const r of rows) {
                const n = Number(r.c ?? 0);
                total += n;
                const status = String(r._id?.status ?? '');
                const severity = String(r._id?.severity ?? '');
                if (status in byStatus)
                    byStatus[status] += n;
                if (severity in bySeverity)
                    bySeverity[severity] += n;
            }
            return { total, byStatus, bySeverity };
        }
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
        const limit = Math.min(filters.limit ?? 500, 2000);
        if (this.useMongo()) {
            const filter = {};
            if (filters.status)
                filter.status = filters.status;
            if (filters.vendorId)
                filter.vendor_id = Number(filters.vendorId);
            const docs = await this.mongo.findMany('vendor_promotions', filter, {
                sort: { created_at: -1, mysql_id: -1 },
                limit,
            });
            const out = [];
            for (const d of docs) {
                out.push({
                    id: Number(d.mysql_id),
                    vendor_id: Number(d.vendor_id),
                    restaurant_id: Number(d.restaurant_id),
                    vendor_name: await this.vendorNameMongo(Number(d.vendor_id)),
                    restaurant_name: await this.restaurantNameMongo(Number(d.restaurant_id)),
                    title: d.title,
                    description: d.description ?? null,
                    promo_type: d.promo_type,
                    discount_type: d.discount_type ?? null,
                    discount_value: d.discount_value != null ? Number(d.discount_value) : null,
                    min_order_value: d.min_order_value != null ? Number(d.min_order_value) : null,
                    max_discount: d.max_discount != null ? Number(d.max_discount) : null,
                    start_date: d.start_date ?? null,
                    end_date: d.end_date ?? null,
                    image_path: d.image_path ?? null,
                    target_audience: d.target_audience ?? 'all',
                    status: d.status,
                    admin_remarks: d.admin_remarks ?? null,
                    reviewed_by: d.reviewed_by != null ? Number(d.reviewed_by) : null,
                    reviewed_at: d.reviewed_at ?? null,
                    total_uses: Number(d.total_uses ?? 0),
                    created_at: d.created_at ?? null,
                });
            }
            return out;
        }
        const conds = [];
        if (filters.status)
            conds.push(`vp.status = '${filters.status}'`);
        if (filters.vendorId)
            conds.push(`vp.vendor_id = ${filters.vendorId}`);
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
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
        if (this.useMongo()) {
            const now = new Date();
            await this.mongo.updateOne('vendor_promotions', { mysql_id: Number(id) }, {
                status: 'approved',
                admin_remarks: remarks ?? null,
                reviewed_by: Number(reviewerId),
                reviewed_at: now,
                updated_at: now,
            });
            return { ok: true, id };
        }
        await this.prisma.$executeRawUnsafe(`UPDATE vendor_promotions
       SET status = 'approved', admin_remarks = ?, reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = ?`, remarks ?? null, reviewerId, id);
        return { ok: true, id };
    }
    async rejectPromo(id, reviewerId, remarks) {
        if (!remarks?.trim()) {
            throw new common_1.BadRequestException({ errors: [{ code: 'remarks', message: 'remarks required to reject' }] });
        }
        if (this.useMongo()) {
            const now = new Date();
            await this.mongo.updateOne('vendor_promotions', { mysql_id: Number(id) }, {
                status: 'rejected',
                admin_remarks: remarks,
                reviewed_by: Number(reviewerId),
                reviewed_at: now,
                updated_at: now,
            });
            return { ok: true, id };
        }
        await this.prisma.$executeRawUnsafe(`UPDATE vendor_promotions
       SET status = 'rejected', admin_remarks = ?, reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = ?`, remarks, reviewerId, id);
        return { ok: true, id };
    }
    async pausePromo(id, paused) {
        if (this.useMongo()) {
            await this.mongo.updateOne('vendor_promotions', { mysql_id: Number(id) }, { status: paused ? 'paused' : 'approved', updated_at: new Date() });
            return { ok: true, id };
        }
        await this.prisma.$executeRawUnsafe(`UPDATE vendor_promotions SET status = ?, updated_at = NOW() WHERE id = ?`, paused ? 'paused' : 'approved', id);
        return { ok: true, id };
    }
    async getPromoStats() {
        if (this.useMongo()) {
            const rows = await this.mongo.aggregate('vendor_promotions', [{ $group: { _id: '$status', c: { $sum: 1 } } }]);
            const summary = { draft: 0, pending: 0, approved: 0, rejected: 0, live: 0, paused: 0, expired: 0, total: 0 };
            for (const r of rows) {
                const n = Number(r.c ?? 0);
                summary[String(r._id)] = n;
                summary.total += n;
            }
            return summary;
        }
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
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        mongo_data_service_1.MongoDataService])
], CompletionService);
//# sourceMappingURL=completion.service.js.map