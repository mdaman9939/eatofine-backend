import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// BRD enhancements: §5.1 Slab Plan + §5.3 GST Engine + §5.2 Invoices + §5.4 TDS.
// New tables (business_plan_slabs, tax_master) are demo-time additions not yet
// in Prisma schema, so we use $queryRawUnsafe with explicit casts.

interface SlabRow {
  id: number; vendor_id: number | null;
  min_order_value: number; max_order_value: number;
  fixed_charge: number; extra_charge: number;
  gst_rate: number; gst_on_extra: number;
  effective_from: Date | null; status: number; created_at: Date | null;
}

interface TaxRow {
  id: number; charge_head: string;
  gst_rate: number; cgst: number; sgst: number; igst: number;
  hsn_sac: string | null; status: number; configurable: number;
}

@Injectable()
export class EnhancementsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── BRD §5.1 — Slab Business Plan ────────────────────────────────
  async listSlabs(vendorId?: number) {
    const rows = await this.prisma.$queryRawUnsafe<SlabRow[]>(
      `SELECT id, vendor_id, min_order_value, max_order_value, fixed_charge,
              extra_charge, gst_rate, gst_on_extra, effective_from, status, created_at
       FROM business_plan_slabs
       WHERE ${vendorId ? `vendor_id = ${vendorId}` : 'vendor_id IS NULL'}
       ORDER BY min_order_value ASC`,
    );
    return rows.map((r) => ({
      ...r,
      id: Number(r.id),
      vendor_id: r.vendor_id ? Number(r.vendor_id) : null,
      min_order_value: Number(r.min_order_value),
      max_order_value: Number(r.max_order_value),
      fixed_charge: Number(r.fixed_charge),
      extra_charge: Number(r.extra_charge),
      gst_rate: Number(r.gst_rate),
      gst_on_extra: !!r.gst_on_extra,
      status: !!r.status,
    }));
  }

  async createSlab(body: { min_order_value: number; max_order_value: number; fixed_charge: number; extra_charge?: number; gst_rate?: number; gst_on_extra?: boolean; vendor_id?: number | null }) {
    if (typeof body.min_order_value !== 'number' || typeof body.max_order_value !== 'number') {
      throw new BadRequestException({ errors: [{ code: 'body', message: 'min/max_order_value required' }] });
    }
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO business_plan_slabs
       (vendor_id, min_order_value, max_order_value, fixed_charge, extra_charge, gst_rate, gst_on_extra, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      body.vendor_id ?? null,
      body.min_order_value, body.max_order_value,
      body.fixed_charge, body.extra_charge ?? 0,
      body.gst_rate ?? 18, body.gst_on_extra ? 1 : 0,
    );
    return { ok: true };
  }

  async deleteSlab(id: number) {
    await this.prisma.$executeRawUnsafe(`DELETE FROM business_plan_slabs WHERE id = ?`, id);
    return { ok: true, id };
  }

  async toggleSlabStatus(id: number, status: boolean) {
    await this.prisma.$executeRawUnsafe(
      `UPDATE business_plan_slabs SET status = ?, updated_at = NOW() WHERE id = ?`,
      status ? 1 : 0, id,
    );
    return { ok: true, id, status };
  }

  // ── BRD §5.3 — Tax / GST Engine ──────────────────────────────────
  async listTaxes() {
    const rows = await this.prisma.$queryRawUnsafe<TaxRow[]>(
      `SELECT id, charge_head, gst_rate, cgst, sgst, igst, hsn_sac, status, configurable
       FROM tax_master ORDER BY id ASC`,
    );
    return rows.map((r) => ({
      ...r,
      id: Number(r.id),
      gst_rate: Number(r.gst_rate),
      cgst: Number(r.cgst),
      sgst: Number(r.sgst),
      igst: Number(r.igst),
      status: !!r.status,
      configurable: !!r.configurable,
    }));
  }

  async updateTaxRate(id: number, body: { gst_rate?: number; cgst?: number; sgst?: number; igst?: number; hsn_sac?: string; status?: boolean }) {
    const updates: string[] = [];
    const values: unknown[] = [];
    if (body.gst_rate !== undefined) { updates.push('gst_rate = ?'); values.push(body.gst_rate); }
    if (body.cgst !== undefined) { updates.push('cgst = ?'); values.push(body.cgst); }
    if (body.sgst !== undefined) { updates.push('sgst = ?'); values.push(body.sgst); }
    if (body.igst !== undefined) { updates.push('igst = ?'); values.push(body.igst); }
    if (body.hsn_sac !== undefined) { updates.push('hsn_sac = ?'); values.push(body.hsn_sac); }
    if (body.status !== undefined) { updates.push('status = ?'); values.push(body.status ? 1 : 0); }
    if (!updates.length) throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields' }] });
    updates.push('updated_at = NOW()');
    values.push(id);
    await this.prisma.$executeRawUnsafe(
      `UPDATE tax_master SET ${updates.join(', ')} WHERE id = ?`,
      ...values,
    );
    return { ok: true, id };
  }

  async createTax(body: { charge_head: string; gst_rate?: number; cgst?: number; sgst?: number; igst?: number; hsn_sac?: string; configurable?: boolean }) {
    if (!body.charge_head?.trim()) throw new BadRequestException({ errors: [{ code: 'charge_head', message: 'required' }] });
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO tax_master (charge_head, gst_rate, cgst, sgst, igst, hsn_sac, status, configurable, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, NOW(), NOW())`,
      body.charge_head.trim(), body.gst_rate ?? 0, body.cgst ?? 0, body.sgst ?? 0, body.igst ?? 0,
      body.hsn_sac ?? null, body.configurable ? 1 : 0,
    );
    return { ok: true };
  }

  async deleteTax(id: number) {
    await this.prisma.$executeRawUnsafe('DELETE FROM tax_master WHERE id = ?', id);
    return { ok: true, id };
  }

  // ── §1.4 — Additional user charges ───────────────────────────────
  async listAdditionalCharges() {
    interface Row {
      id: number; charge_head: string; charge_type: 'fixed' | 'percentage';
      amount: number; gst_applicable: number; gst_rate: number;
      hsn_sac: string | null; description: string | null; status: number;
    }
    const rows = await this.prisma.$queryRawUnsafe<Row[]>(
      `SELECT id, charge_head, charge_type, amount, gst_applicable, gst_rate, hsn_sac, description, status
       FROM additional_user_charges ORDER BY id ASC`,
    );
    return rows.map((r) => ({
      ...r,
      id: Number(r.id),
      amount: Number(r.amount),
      gst_rate: Number(r.gst_rate),
      gst_applicable: !!r.gst_applicable,
      status: !!r.status,
    }));
  }

  async createAdditionalCharge(body: { charge_head: string; charge_type?: 'fixed' | 'percentage'; amount: number; gst_applicable?: boolean; gst_rate?: number; hsn_sac?: string; description?: string }) {
    if (!body.charge_head?.trim()) throw new BadRequestException({ errors: [{ code: 'charge_head', message: 'required' }] });
    if (typeof body.amount !== 'number') throw new BadRequestException({ errors: [{ code: 'amount', message: 'required' }] });
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO additional_user_charges (charge_head, charge_type, amount, gst_applicable, gst_rate, hsn_sac, description, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      body.charge_head.trim(), body.charge_type ?? 'fixed', body.amount,
      body.gst_applicable ? 1 : 0, body.gst_rate ?? 0,
      body.hsn_sac ?? null, body.description ?? null,
    );
    return { ok: true };
  }

  async updateAdditionalCharge(id: number, body: { charge_head?: string; charge_type?: 'fixed' | 'percentage'; amount?: number; gst_applicable?: boolean; gst_rate?: number; hsn_sac?: string; description?: string; status?: boolean }) {
    const updates: string[] = [];
    const values: unknown[] = [];
    if (body.charge_head !== undefined) { updates.push('charge_head = ?'); values.push(body.charge_head); }
    if (body.charge_type !== undefined) { updates.push('charge_type = ?'); values.push(body.charge_type); }
    if (body.amount !== undefined) { updates.push('amount = ?'); values.push(body.amount); }
    if (body.gst_applicable !== undefined) { updates.push('gst_applicable = ?'); values.push(body.gst_applicable ? 1 : 0); }
    if (body.gst_rate !== undefined) { updates.push('gst_rate = ?'); values.push(body.gst_rate); }
    if (body.hsn_sac !== undefined) { updates.push('hsn_sac = ?'); values.push(body.hsn_sac); }
    if (body.description !== undefined) { updates.push('description = ?'); values.push(body.description); }
    if (body.status !== undefined) { updates.push('status = ?'); values.push(body.status ? 1 : 0); }
    if (!updates.length) throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields' }] });
    updates.push('updated_at = NOW()');
    values.push(id);
    await this.prisma.$executeRawUnsafe(`UPDATE additional_user_charges SET ${updates.join(', ')} WHERE id = ?`, ...values);
    return { ok: true, id };
  }

  async deleteAdditionalCharge(id: number) {
    await this.prisma.$executeRawUnsafe('DELETE FROM additional_user_charges WHERE id = ?', id);
    return { ok: true, id };
  }

  // ── §4.1 — TDS settings ──────────────────────────────────────────
  async getTdsSettings() {
    interface Row { id: number; default_rate: number; threshold: number; section_code: string; financial_year_start: Date; status: number; updated_by: string | null; updated_at: Date | null }
    const rows = await this.prisma.$queryRawUnsafe<Row[]>(
      `SELECT id, default_rate, threshold, section_code, financial_year_start, status, updated_by, updated_at
       FROM tds_settings ORDER BY id ASC LIMIT 1`,
    );
    const r = rows[0];
    if (!r) throw new NotFoundException({ errors: [{ code: 'tds_settings', message: 'no row — re-seed required' }] });
    return {
      id: Number(r.id),
      default_rate: Number(r.default_rate),
      threshold: Number(r.threshold),
      section_code: r.section_code,
      financial_year_start: r.financial_year_start,
      status: !!r.status,
      updated_by: r.updated_by,
      updated_at: r.updated_at,
    };
  }

  async updateTdsSettings(body: { default_rate?: number; threshold?: number; section_code?: string; financial_year_start?: string; status?: boolean; updated_by?: string }) {
    const updates: string[] = [];
    const values: unknown[] = [];
    if (body.default_rate !== undefined) { updates.push('default_rate = ?'); values.push(body.default_rate); }
    if (body.threshold !== undefined) { updates.push('threshold = ?'); values.push(body.threshold); }
    if (body.section_code !== undefined) { updates.push('section_code = ?'); values.push(body.section_code); }
    if (body.financial_year_start !== undefined) { updates.push('financial_year_start = ?'); values.push(body.financial_year_start); }
    if (body.status !== undefined) { updates.push('status = ?'); values.push(body.status ? 1 : 0); }
    if (body.updated_by !== undefined) { updates.push('updated_by = ?'); values.push(body.updated_by); }
    if (!updates.length) throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields' }] });
    updates.push('updated_at = NOW()');
    await this.prisma.$executeRawUnsafe(`UPDATE tds_settings SET ${updates.join(', ')} WHERE id = (SELECT id FROM (SELECT id FROM tds_settings ORDER BY id ASC LIMIT 1) AS t)`, ...values);
    return { ok: true };
  }

  // ── Unified calculator: slab + GST + vendor payout ──────────────
  async calculateOrderCharges(input: { order_value: number; vendor_id?: number; same_state?: boolean }) {
    if (typeof input.order_value !== 'number' || input.order_value <= 0) {
      throw new BadRequestException({ errors: [{ code: 'order_value', message: 'order_value > 0 required' }] });
    }
    let slab: SlabRow | undefined;
    if (input.vendor_id) {
      const v = await this.prisma.$queryRawUnsafe<SlabRow[]>(
        `SELECT * FROM business_plan_slabs WHERE vendor_id = ? AND status = 1
         AND ? BETWEEN min_order_value AND max_order_value LIMIT 1`,
        input.vendor_id, input.order_value,
      );
      slab = v[0];
    }
    if (!slab) {
      const g = await this.prisma.$queryRawUnsafe<SlabRow[]>(
        `SELECT * FROM business_plan_slabs WHERE vendor_id IS NULL AND status = 1
         AND ? BETWEEN min_order_value AND max_order_value LIMIT 1`,
        input.order_value,
      );
      slab = g[0];
    }
    if (!slab) throw new NotFoundException({ errors: [{ code: 'slab', message: `No active slab matches order value ${input.order_value}` }] });

    const fixed = Number(slab.fixed_charge);
    const extra = Number(slab.extra_charge);
    const gstRate = Number(slab.gst_rate);
    const gstOnExtra = !!slab.gst_on_extra;
    const baseCharge = fixed + extra;
    const gstBase = gstOnExtra ? baseCharge : fixed;
    const gstAmount = +(gstBase * (gstRate / 100)).toFixed(2);
    const sameState = input.same_state !== false;
    const cgst = sameState ? +(gstAmount / 2).toFixed(2) : 0;
    const sgst = sameState ? +(gstAmount / 2).toFixed(2) : 0;
    const igst = sameState ? 0 : gstAmount;
    const totalDeduction = +(baseCharge + gstAmount).toFixed(2);
    const vendorPayout = +(input.order_value - totalDeduction).toFixed(2);
    return {
      order_value: input.order_value,
      matched_slab: {
        id: Number(slab.id),
        min_order_value: Number(slab.min_order_value),
        max_order_value: Number(slab.max_order_value),
        fixed_charge: fixed, extra_charge: extra,
        gst_rate: gstRate, gst_on_extra: gstOnExtra,
        vendor_id: slab.vendor_id ? Number(slab.vendor_id) : null,
      },
      breakdown: {
        fixed_charge: fixed, extra_charge: extra,
        base_charge: baseCharge,
        gst_base: gstBase, gst_rate: gstRate, gst_amount: gstAmount,
        cgst, sgst, igst, total_deduction: totalDeduction,
      },
      vendor_payout: vendorPayout,
      tax_mode: sameState ? 'intra-state (CGST + SGST)' : 'inter-state (IGST)',
    };
  }

  // ── BRD §5.2 — Tax invoice list/detail ───────────────────────────
  async listInvoices(limit = 50, offset = 0) {
    const orders = await this.prisma.orders.findMany({
      where: { order_status: 'delivered', payment_status: 'paid' },
      orderBy: { id: 'desc' }, take: limit, skip: offset,
    });
    const rIds = Array.from(new Set(orders.map((o) => o.restaurant_id)));
    const uIds = Array.from(new Set(orders.map((o) => o.user_id).filter((u): u is bigint => u !== null)));
    const [rs, us] = await Promise.all([
      rIds.length ? this.prisma.restaurants.findMany({ where: { id: { in: rIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
      uIds.length ? this.prisma.users.findMany({ where: { id: { in: uIds } }, select: { id: true, f_name: true, l_name: true, email: true } }) : Promise.resolve([]),
    ]);
    const rMap = new Map(rs.map((r) => [String(r.id), r]));
    const uMap = new Map(us.map((u) => [String(u.id), u]));
    return {
      total: orders.length,
      invoices: orders.map((o) => {
        const orderAmount = Number(o.order_amount);
        const tax = Number(o.total_tax_amount);
        const delivery = Number(o.delivery_charge);
        const dt = o.created_at ?? new Date();
        const month = String(dt.getMonth() + 1).padStart(2, '0');
        const year = dt.getFullYear();
        return {
          invoice_no: `INV-${year}-${month}-${String(Number(o.id)).padStart(5, '0')}`,
          order_id: Number(o.id),
          issued_on: o.delivered ?? o.created_at,
          customer: o.user_id ? uMap.get(String(o.user_id)) ?? null : null,
          restaurant: rMap.get(String(o.restaurant_id)) ?? null,
          subtotal: orderAmount - tax - delivery,
          tax, delivery_charge: delivery, total: orderAmount,
          cgst: +(tax / 2).toFixed(2),
          sgst: +(tax / 2).toFixed(2),
          igst: 0,
          payment_method: o.payment_method,
          status: 'GENERATED',
        };
      }),
    };
  }

  async getInvoice(orderId: number) {
    const order = await this.prisma.orders.findUnique({ where: { id: BigInt(orderId) } });
    if (!order) throw new NotFoundException({ errors: [{ code: 'order', message: 'not found' }] });
    const [items, restaurant, user] = await Promise.all([
      this.prisma.order_details.findMany({ where: { order_id: order.id }, orderBy: { id: 'asc' } }),
      this.prisma.restaurants.findUnique({ where: { id: order.restaurant_id } }),
      order.user_id ? this.prisma.users.findUnique({ where: { id: order.user_id } }) : null,
    ]);
    const orderAmount = Number(order.order_amount);
    const tax = Number(order.total_tax_amount);
    const delivery = Number(order.delivery_charge);
    const dt = order.created_at ?? new Date();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const year = dt.getFullYear();
    return {
      invoice_no: `INV-${year}-${month}-${String(Number(order.id)).padStart(5, '0')}`,
      issued_on: order.delivered ?? order.created_at,
      bill_from: {
        name: restaurant?.name ?? '—',
        address: restaurant?.address ?? '—',
        gstin: '29ABCDE1234F1Z5',
        state: 'Delhi', state_code: '07',
      },
      bill_to: {
        name: user ? `${user.f_name ?? ''} ${user.l_name ?? ''}`.trim() : 'Customer',
        email: user?.email ?? null, phone: user?.phone ?? null,
        address: order.delivery_address,
      },
      items: items.map((it) => {
        let parsed: { name?: string } = {};
        try { parsed = JSON.parse(it.food_details ?? '{}'); } catch { /* ignore */ }
        return {
          id: Number(it.id),
          name: parsed.name ?? `Item #${it.food_id ?? '?'}`,
          hsn: '996331',
          qty: it.quantity,
          unit_price: Number(it.price),
          subtotal: Number(it.price) * it.quantity,
          tax: Number(it.tax_amount),
        };
      }),
      summary: {
        subtotal: orderAmount - tax - delivery,
        delivery_charge: delivery,
        tax_total: tax,
        cgst: +(tax / 2).toFixed(2),
        sgst: +(tax / 2).toFixed(2),
        igst: 0,
        grand_total: orderAmount,
      },
      payment_method: order.payment_method,
      payment_status: order.payment_status,
    };
  }

  // ── BRD §5.4 — TDS Report ────────────────────────────────────────
  async tdsReport(opts: { vendor_id?: number; rate?: number; threshold?: number }) {
    let defaults: { default_rate: number; threshold: number };
    try { defaults = await this.getTdsSettings(); }
    catch { defaults = { default_rate: 2, threshold: 30000 }; }
    const rate = opts.rate ?? defaults.default_rate;
    const threshold = opts.threshold ?? defaults.threshold;
    const where: { order_status: string; payment_status: string; restaurant_id?: bigint } = {
      order_status: 'delivered', payment_status: 'paid',
    };
    if (opts.vendor_id) {
      const r = await this.prisma.restaurants.findFirst({
        where: { vendor_id: BigInt(opts.vendor_id) }, select: { id: true },
      });
      if (r) where.restaurant_id = r.id;
    }
    const groups = await this.prisma.orders.groupBy({
      by: ['restaurant_id'], where,
      _sum: { order_amount: true },
      _count: { _all: true },
      orderBy: { _sum: { order_amount: 'desc' } },
    });
    const rIds = groups.map((g) => g.restaurant_id);
    const restaurants = rIds.length
      ? await this.prisma.restaurants.findMany({
          where: { id: { in: rIds } },
          select: { id: true, name: true, vendor_id: true, comission: true },
        })
      : [];
    const rMap = new Map(restaurants.map((r) => [String(r.id), r]));
    return {
      tds_rate: rate, threshold,
      rows: groups.map((g) => {
        const r = rMap.get(String(g.restaurant_id));
        const grossPayout = Number(g._sum.order_amount ?? 0);
        const commission = r?.comission !== null && r?.comission !== undefined ? Number(r.comission) : 0;
        const adminCut = grossPayout * (commission / 100);
        const netVendorPayout = grossPayout - adminCut;
        const tdsApplies = netVendorPayout >= threshold;
        const tdsAmount = tdsApplies ? +(netVendorPayout * (rate / 100)).toFixed(2) : 0;
        const finalDisbursement = +(netVendorPayout - tdsAmount).toFixed(2);
        return {
          restaurant_id: Number(g.restaurant_id),
          restaurant: r?.name ?? null,
          vendor_id: r?.vendor_id ? Number(r.vendor_id) : null,
          orders: g._count._all,
          gross_payout: grossPayout,
          admin_commission_pct: commission,
          admin_cut: +adminCut.toFixed(2),
          net_vendor_payout: +netVendorPayout.toFixed(2),
          tds_applies: tdsApplies,
          tds_amount: tdsAmount,
          final_disbursement: finalDisbursement,
        };
      }),
    };
  }
}
