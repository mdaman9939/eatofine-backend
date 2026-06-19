import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';
import { BusinessSettingsService } from '../business-settings/business-settings.service';
import { toNum } from '../common/decimal';

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

interface MongoSlabDoc {
  mysql_id: number;
  vendor_id: number | null;
  min_order_value: number;
  max_order_value: number;
  fixed_charge: number;
  extra_charge: number;
  gst_rate: number;
  gst_on_extra: number | boolean;
  effective_from: Date | null;
  status: number | boolean;
  created_at: Date | null;
}

interface MongoTaxDoc {
  mysql_id: number;
  charge_head: string;
  gst_rate: number;
  cgst: number;
  sgst: number;
  igst: number;
  hsn_sac: string | null;
  status: number | boolean;
  configurable: number | boolean;
}

interface MongoAdditionalChargeDoc {
  mysql_id: number;
  charge_head: string;
  charge_type: 'fixed' | 'percentage';
  amount: number;
  gst_applicable: number | boolean;
  gst_rate: number;
  hsn_sac: string | null;
  description: string | null;
  status: number | boolean;
}

interface MongoTdsDoc {
  mysql_id: number;
  default_rate: number;
  threshold: number;
  section_code: string;
  financial_year_start: Date | null;
  status: number | boolean;
  updated_by: string | null;
  updated_at: Date | null;
}

interface MongoOrderDoc {
  mysql_id: number;
  mysql_user_id: number | null;
  mysql_restaurant_id: number | null;
  order_status: string;
  payment_status: string;
  payment_method: string | null;
  order_amount: number;
  delivery_charge: number;
  total_tax_amount: number;
  additional_charge?: number | null;
  extra_packaging_amount?: number | null;
  coupon_discount_amount?: number | null;
  restaurant_discount_amount?: number | null;
  delivery_address: string | null;
  delivered: Date | null;
  created_at: Date | null;
  created_at_legacy?: Date | null;
  contact_person_name?: string | null;
  contact_person_number?: string | null;
  // Persisted invoice numbers — assigned once on first view so they stay stable.
  customer_invoice_number?: string | null; // OBR<FY>-NNNN (On Behalf of Restaurant)
  eatofine_invoice_number?: string | null; // ETFU<FY>-NNNN (Eatofine service invoice)
}

interface MongoOrderDetailDoc {
  mysql_id: number;
  order_id: number;
  food_id: number | null;
  price: number;
  quantity: number;
  tax_amount: number;
  food_details: string | null;
}

interface MongoRestaurantDoc {
  mysql_id: number;
  name?: string | null;
  address?: string | null;
  mysql_vendor_id?: number | null;
  comission?: number | null;
  business_name?: string | null;
  gstin?: string | null;
  fssai?: string | null;
  cin?: string | null;
}

interface MongoUserDoc {
  mysql_id: number;
  f_name?: string | null;
  l_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

@Injectable()
export class EnhancementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mongo: MongoDataService,
    private readonly bs: BusinessSettingsService,
  ) {}

  /** Feature flag — when "1"/"true"/"yes", reads/writes route to MongoDB. */
  private useMongo(): boolean {
    const v = (process.env.USE_MONGO_ENHANCEMENTS ?? '1').toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }

  // ── BRD §5.1 — Slab Business Plan ────────────────────────────────
  async listSlabs(vendorId?: number) {
    if (this.useMongo()) {
      const filter: Record<string, unknown> = vendorId ? { vendor_id: Number(vendorId) } : { vendor_id: null };
      const docs = await this.mongo.findMany<MongoSlabDoc>(
        'business_plan_slabs',
        filter,
        { sort: { min_order_value: 1 } },
      );
      return docs.map((r) => ({
        id: Number(r.mysql_id),
        vendor_id: r.vendor_id != null ? Number(r.vendor_id) : null,
        min_order_value: Number(r.min_order_value),
        max_order_value: Number(r.max_order_value),
        fixed_charge: Number(r.fixed_charge),
        extra_charge: Number(r.extra_charge),
        gst_rate: Number(r.gst_rate),
        gst_on_extra: !!r.gst_on_extra,
        effective_from: r.effective_from ?? null,
        status: !!r.status,
        created_at: r.created_at ?? null,
      }));
    }
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

  // Extra charge is configured by the admin as a PERCENTAGE of the slab's max
  // order value, but stored on the row as a flat ₹ amount (so the calculator and
  // settlement keep working unchanged). This converts pct → ₹ using the max bound.
  private extraPctToAmount(pct: number, maxOrderValue: number): number {
    const p = Number(pct) || 0;
    const max = Number(maxOrderValue) || 0;
    return +((p / 100) * max).toFixed(2);
  }

  async createSlab(body: { min_order_value: number; max_order_value: number; fixed_charge: number; extra_charge?: number; extra_charge_pct?: number; gst_rate?: number; gst_on_extra?: boolean; vendor_id?: number | null }) {
    if (typeof body.min_order_value !== 'number' || typeof body.max_order_value !== 'number') {
      throw new BadRequestException({ errors: [{ code: 'body', message: 'min/max_order_value required' }] });
    }
    // Prefer the percentage input; fall back to a raw ₹ amount for older callers.
    const extraCharge = body.extra_charge_pct !== undefined && body.extra_charge_pct !== null
      ? this.extraPctToAmount(body.extra_charge_pct, body.max_order_value)
      : (body.extra_charge ?? 0);
    if (this.useMongo()) {
      const nextId = await this.mongo.nextMysqlId('business_plan_slabs');
      const now = new Date();
      await this.mongo.insertOne('business_plan_slabs', {
        mysql_id: nextId,
        vendor_id: body.vendor_id ?? null,
        min_order_value: body.min_order_value,
        max_order_value: body.max_order_value,
        fixed_charge: body.fixed_charge,
        extra_charge: extraCharge,
        gst_rate: body.gst_rate ?? 18,
        gst_on_extra: body.gst_on_extra ? 1 : 0,
        status: 1,
        created_at: now,
        updated_at: now,
      });
      return { ok: true };
    }
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO business_plan_slabs
       (vendor_id, min_order_value, max_order_value, fixed_charge, extra_charge, gst_rate, gst_on_extra, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      body.vendor_id ?? null,
      body.min_order_value, body.max_order_value,
      body.fixed_charge, extraCharge,
      body.gst_rate ?? 18, body.gst_on_extra ? 1 : 0,
    );
    return { ok: true };
  }

  async updateSlab(id: number, body: { min_order_value?: number; max_order_value?: number; fixed_charge?: number; extra_charge?: number; extra_charge_pct?: number; gst_rate?: number; gst_on_extra?: boolean }) {
    const set: Record<string, unknown> = {};
    if (body.min_order_value !== undefined) set.min_order_value = Number(body.min_order_value);
    if (body.max_order_value !== undefined) set.max_order_value = Number(body.max_order_value);
    if (body.fixed_charge !== undefined) set.fixed_charge = Number(body.fixed_charge);
    if (body.extra_charge_pct !== undefined && body.extra_charge_pct !== null) {
      // Convert the % back to a ₹ amount using the new max (if being changed) or
      // the existing max already on the slab.
      let max = body.max_order_value;
      if (max === undefined) {
        const existing = await this.mongo.findByMysqlId<{ max_order_value: number }>('business_plan_slabs', Number(id));
        max = Number(existing?.max_order_value ?? 0);
      }
      set.extra_charge = this.extraPctToAmount(body.extra_charge_pct, max);
    } else if (body.extra_charge !== undefined) {
      set.extra_charge = Number(body.extra_charge);
    }
    if (body.gst_rate !== undefined) set.gst_rate = Number(body.gst_rate);
    if (body.gst_on_extra !== undefined) set.gst_on_extra = body.gst_on_extra ? 1 : 0;
    if (Object.keys(set).length === 0) throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields to update' }] });
    set.updated_at = new Date();
    if (this.useMongo()) {
      await this.mongo.updateOne('business_plan_slabs', { mysql_id: Number(id) }, set);
      return { ok: true, id };
    }
    const cols = Object.keys(set).filter((k) => k !== 'updated_at');
    await this.prisma.$executeRawUnsafe(
      `UPDATE business_plan_slabs SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = NOW() WHERE id = ?`,
      ...cols.map((c) => set[c]), id,
    );
    return { ok: true, id };
  }

  async deleteSlab(id: number) {
    if (this.useMongo()) {
      await this.mongo.deleteOne('business_plan_slabs', { mysql_id: Number(id) });
      return { ok: true, id };
    }
    await this.prisma.$executeRawUnsafe(`DELETE FROM business_plan_slabs WHERE id = ?`, id);
    return { ok: true, id };
  }

  async toggleSlabStatus(id: number, status: boolean) {
    if (this.useMongo()) {
      await this.mongo.updateOne(
        'business_plan_slabs',
        { mysql_id: Number(id) },
        { status: status ? 1 : 0, updated_at: new Date() },
      );
      return { ok: true, id, status };
    }
    await this.prisma.$executeRawUnsafe(
      `UPDATE business_plan_slabs SET status = ?, updated_at = NOW() WHERE id = ?`,
      status ? 1 : 0, id,
    );
    return { ok: true, id, status };
  }

  // ── BRD §5.3 — Tax / GST Engine ──────────────────────────────────
  async listTaxes() {
    if (this.useMongo()) {
      const docs = await this.mongo.findMany<MongoTaxDoc>(
        'tax_master',
        {},
        { sort: { mysql_id: 1 } },
      );
      return docs.map((r) => ({
        id: Number(r.mysql_id),
        charge_head: r.charge_head,
        gst_rate: Number(r.gst_rate),
        cgst: Number(r.cgst),
        sgst: Number(r.sgst),
        igst: Number(r.igst),
        hsn_sac: r.hsn_sac ?? null,
        status: !!r.status,
        configurable: !!r.configurable,
      }));
    }
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
    if (this.useMongo()) {
      const set: Record<string, unknown> = {};
      if (body.gst_rate !== undefined) set.gst_rate = body.gst_rate;
      if (body.cgst !== undefined) set.cgst = body.cgst;
      if (body.sgst !== undefined) set.sgst = body.sgst;
      if (body.igst !== undefined) set.igst = body.igst;
      if (body.hsn_sac !== undefined) set.hsn_sac = body.hsn_sac;
      if (body.status !== undefined) set.status = body.status ? 1 : 0;
      if (!Object.keys(set).length) throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields' }] });
      set.updated_at = new Date();
      await this.mongo.updateOne('tax_master', { mysql_id: Number(id) }, set);
      return { ok: true, id };
    }
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
    if (this.useMongo()) {
      const nextId = await this.mongo.nextMysqlId('tax_master');
      const now = new Date();
      await this.mongo.insertOne('tax_master', {
        mysql_id: nextId,
        charge_head: body.charge_head.trim(),
        gst_rate: body.gst_rate ?? 0,
        cgst: body.cgst ?? 0,
        sgst: body.sgst ?? 0,
        igst: body.igst ?? 0,
        hsn_sac: body.hsn_sac ?? null,
        status: 1,
        configurable: body.configurable ? 1 : 0,
        created_at: now,
        updated_at: now,
      });
      return { ok: true };
    }
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO tax_master (charge_head, gst_rate, cgst, sgst, igst, hsn_sac, status, configurable, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, NOW(), NOW())`,
      body.charge_head.trim(), body.gst_rate ?? 0, body.cgst ?? 0, body.sgst ?? 0, body.igst ?? 0,
      body.hsn_sac ?? null, body.configurable ? 1 : 0,
    );
    return { ok: true };
  }

  async deleteTax(id: number) {
    if (this.useMongo()) {
      await this.mongo.deleteOne('tax_master', { mysql_id: Number(id) });
      return { ok: true, id };
    }
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
    if (this.useMongo()) {
      const docs = await this.mongo.findMany<MongoAdditionalChargeDoc>(
        'additional_user_charges',
        {},
        { sort: { mysql_id: 1 } },
      );
      return docs.map((r) => ({
        id: Number(r.mysql_id),
        charge_head: r.charge_head,
        charge_type: r.charge_type,
        // Migrated DECIMAL columns arrive as decimal.js objects → Number() = NaN
        // (shows as ₹0). toNum decodes them robustly.
        amount: toNum(r.amount),
        gst_applicable: !!r.gst_applicable,
        gst_rate: toNum(r.gst_rate),
        hsn_sac: r.hsn_sac ?? null,
        description: r.description ?? null,
        status: !!r.status,
      }));
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
    if (this.useMongo()) {
      const nextId = await this.mongo.nextMysqlId('additional_user_charges');
      const now = new Date();
      await this.mongo.insertOne('additional_user_charges', {
        mysql_id: nextId,
        charge_head: body.charge_head.trim(),
        charge_type: body.charge_type ?? 'fixed',
        amount: body.amount,
        gst_applicable: body.gst_applicable ? 1 : 0,
        gst_rate: body.gst_rate ?? 0,
        hsn_sac: body.hsn_sac ?? null,
        description: body.description ?? null,
        status: 1,
        created_at: now,
        updated_at: now,
      });
      return { ok: true };
    }
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
    if (this.useMongo()) {
      const set: Record<string, unknown> = {};
      if (body.charge_head !== undefined) set.charge_head = body.charge_head;
      if (body.charge_type !== undefined) set.charge_type = body.charge_type;
      if (body.amount !== undefined) set.amount = body.amount;
      if (body.gst_applicable !== undefined) set.gst_applicable = body.gst_applicable ? 1 : 0;
      if (body.gst_rate !== undefined) set.gst_rate = body.gst_rate;
      if (body.hsn_sac !== undefined) set.hsn_sac = body.hsn_sac;
      if (body.description !== undefined) set.description = body.description;
      if (body.status !== undefined) set.status = body.status ? 1 : 0;
      if (!Object.keys(set).length) throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields' }] });
      set.updated_at = new Date();
      await this.mongo.updateOne('additional_user_charges', { mysql_id: Number(id) }, set);
      return { ok: true, id };
    }
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
    if (this.useMongo()) {
      await this.mongo.deleteOne('additional_user_charges', { mysql_id: Number(id) });
      return { ok: true, id };
    }
    await this.prisma.$executeRawUnsafe('DELETE FROM additional_user_charges WHERE id = ?', id);
    return { ok: true, id };
  }

  // ── §4.1 — TDS settings ──────────────────────────────────────────
  async getTdsSettings() {
    interface Row { id: number; default_rate: number; threshold: number; section_code: string; financial_year_start: Date; status: number; updated_by: string | null; updated_at: Date | null }
    if (this.useMongo()) {
      const docs = await this.mongo.findMany<MongoTdsDoc>(
        'tds_settings',
        {},
        { sort: { mysql_id: 1 }, limit: 1 },
      );
      const r = docs[0];
      if (!r) throw new NotFoundException({ errors: [{ code: 'tds_settings', message: 'no row — re-seed required' }] });
      return {
        id: Number(r.mysql_id),
        default_rate: Number(r.default_rate),
        threshold: Number(r.threshold),
        section_code: r.section_code,
        financial_year_start: r.financial_year_start as Date,
        status: !!r.status,
        updated_by: r.updated_by ?? null,
        updated_at: r.updated_at ?? null,
      };
    }
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
    if (this.useMongo()) {
      const set: Record<string, unknown> = {};
      if (body.default_rate !== undefined) set.default_rate = body.default_rate;
      if (body.threshold !== undefined) set.threshold = body.threshold;
      if (body.section_code !== undefined) set.section_code = body.section_code;
      if (body.financial_year_start !== undefined) set.financial_year_start = new Date(body.financial_year_start);
      if (body.status !== undefined) set.status = body.status ? 1 : 0;
      if (body.updated_by !== undefined) set.updated_by = body.updated_by;
      if (!Object.keys(set).length) throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields' }] });
      set.updated_at = new Date();
      const top = await this.mongo.findMany<MongoTdsDoc>(
        'tds_settings',
        {},
        { sort: { mysql_id: 1 }, limit: 1 },
      );
      if (top[0]) {
        await this.mongo.updateOne('tds_settings', { mysql_id: Number(top[0].mysql_id) }, set);
      }
      return { ok: true };
    }
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

    if (this.useMongo()) {
      let slab: MongoSlabDoc | null = null;
      if (input.vendor_id) {
        slab = await this.mongo.findOne<MongoSlabDoc>('business_plan_slabs', {
          vendor_id: Number(input.vendor_id),
          status: { $in: [1, true] },
          min_order_value: { $lte: input.order_value },
          max_order_value: { $gte: input.order_value },
        });
      }
      if (!slab) {
        slab = await this.mongo.findOne<MongoSlabDoc>('business_plan_slabs', {
          vendor_id: null,
          status: { $in: [1, true] },
          min_order_value: { $lte: input.order_value },
          max_order_value: { $gte: input.order_value },
        });
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
          id: Number(slab.mysql_id),
          min_order_value: Number(slab.min_order_value),
          max_order_value: Number(slab.max_order_value),
          fixed_charge: fixed, extra_charge: extra,
          gst_rate: gstRate, gst_on_extra: gstOnExtra,
          vendor_id: slab.vendor_id != null ? Number(slab.vendor_id) : null,
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
    if (this.useMongo()) {
      const orders = await this.mongo.findMany<MongoOrderDoc>(
        'orders',
        { order_status: 'delivered', payment_status: 'paid' },
        { sort: { mysql_id: -1 }, limit, skip: offset },
      );
      const rIds = Array.from(new Set(orders.map((o) => Number(o.mysql_restaurant_id)).filter((n) => !isNaN(n))));
      const uIds = Array.from(new Set(orders.map((o) => (o.mysql_user_id != null ? Number(o.mysql_user_id) : null)).filter((u): u is number => u !== null)));
      const [rs, us] = await Promise.all([
        rIds.length
          ? this.mongo.findMany<MongoRestaurantDoc>('restaurants', { mysql_id: { $in: rIds } })
          : Promise.resolve([] as MongoRestaurantDoc[]),
        uIds.length
          ? this.mongo.findMany<MongoUserDoc>('users', { mysql_id: { $in: uIds } })
          : Promise.resolve([] as MongoUserDoc[]),
      ]);
      const rMap = new Map(rs.map((r) => [String(r.mysql_id), { id: BigInt(r.mysql_id), name: r.name ?? null }]));
      const uMap = new Map(us.map((u) => [String(u.mysql_id), { id: BigInt(u.mysql_id), f_name: u.f_name ?? null, l_name: u.l_name ?? null, email: u.email ?? null }]));
      // Sequential (not Promise.all) so the per-FY counter can't race when a few
      // orders still need a number. Orders that already have one short-circuit
      // (no DB write), so this stays fast.
      const invoices: Array<Record<string, unknown>> = [];
      for (const o of orders) {
        const orderAmount = Number(o.order_amount ?? 0);
        const tax = Number(o.total_tax_amount ?? 0);
        const delivery = Number(o.delivery_charge ?? 0);
        const dt = (o.created_at_legacy ?? o.created_at) ?? new Date();
        // Same OBR<FY>-NNNN number the detail view shows (persisted on the order),
        // so the list and the invoice detail always match.
        const invoiceNo = await this.assignInvoiceNumber(o, 'customer_invoice_number', 'OBR', this.fyCode(dt), o.customer_invoice_number);
        invoices.push({
          invoice_no: invoiceNo,
          order_id: Number(o.mysql_id),
          issued_on: o.delivered ?? o.created_at_legacy ?? o.created_at,
          customer: o.mysql_user_id != null ? uMap.get(String(Number(o.mysql_user_id))) ?? null : null,
          restaurant: rMap.get(String(Number(o.mysql_restaurant_id))) ?? null,
          subtotal: orderAmount - tax - delivery,
          tax, delivery_charge: delivery, total: orderAmount,
          cgst: +(tax / 2).toFixed(2),
          sgst: +(tax / 2).toFixed(2),
          igst: 0,
          payment_method: o.payment_method,
          status: 'GENERATED',
        });
      }
      return { total: orders.length, invoices };
    }
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
        return {
          invoice_no: `OBR${this.fyCode(dt)}-${String(Number(o.id)).padStart(4, '0')}`,
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

  /** delivery_address was a plain string in the original MySQL schema, but
   *  Mongo seed/migration sometimes stores it as { address, latitude, longitude }.
   *  The admin invoice page renders this directly in JSX, so an object value
   *  crashes React with "Objects are not valid as a React child". Always
   *  flatten to a string here. */
  private flattenAddress(value: unknown): string | null {
    if (value == null) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      const v = value as { address?: unknown; formatted?: unknown };
      if (typeof v.address === 'string') return v.address;
      if (typeof v.formatted === 'string') return v.formatted;
      return null;
    }
    return String(value);
  }

  /** Indian financial-year code for a date, e.g. 25-Sep-2025 → "2526"
   *  (FY runs Apr→Mar, so Jan–Mar belong to the previous start year). */
  private fyCode(dt: Date): string {
    const startYear = dt.getMonth() + 1 >= 4 ? dt.getFullYear() : dt.getFullYear() - 1;
    return `${String(startYear % 100).padStart(2, '0')}${String((startYear + 1) % 100).padStart(2, '0')}`;
  }

  /** Assign (and persist) the next sequential invoice number for a given prefix
   *  + financial year, or return the one already stored on the order. Mirrors the
   *  restaurant (RES) vendor-invoice numbering so the series never repeats. */
  private async assignInvoiceNumber(
    order: { mysql_id: number },
    field: 'customer_invoice_number' | 'eatofine_invoice_number',
    prefix: 'OBR' | 'ETFU',
    fy: string,
    existing?: string | null,
  ): Promise<string> {
    if (existing) return existing;
    const seq = (await this.mongo.count('orders', { [field]: { $regex: `^${prefix}${fy}-` } })) + 1;
    const number = `${prefix}${fy}-${String(seq).padStart(4, '0')}`;
    await this.mongo.updateOne('orders', { mysql_id: Number(order.mysql_id) }, { [field]: number });
    return number;
  }

  async getInvoice(orderId: number) {
    if (this.useMongo()) {
      const order = await this.mongo.findByMysqlId<MongoOrderDoc>('orders', orderId);
      if (!order) throw new NotFoundException({ errors: [{ code: 'order', message: 'not found' }] });
      const [items, restaurant, user] = await Promise.all([
        this.mongo.findMany<MongoOrderDetailDoc>(
          'order_details',
          { order_id: Number(order.mysql_id) },
          { sort: { mysql_id: 1 } },
        ),
        order.mysql_restaurant_id != null
          ? this.mongo.findByMysqlId<MongoRestaurantDoc>('restaurants', Number(order.mysql_restaurant_id))
          : Promise.resolve(null),
        order.mysql_user_id != null
          ? this.mongo.findByMysqlId<MongoUserDoc>('users', Number(order.mysql_user_id))
          : Promise.resolve(null),
      ]);
      const orderAmount = Number(order.order_amount ?? 0);
      const tax = Number(order.total_tax_amount ?? 0);
      const delivery = Number(order.delivery_charge ?? 0);
      const dt = (order.created_at_legacy ?? order.created_at) ?? new Date();
      const fy = this.fyCode(dt);
      // OBR<FY>-NNNN = "On Behalf of Restaurant" customer tax invoice number.
      const invoiceNo = await this.assignInvoiceNumber(order, 'customer_invoice_number', 'OBR', fy, order.customer_invoice_number);
      // ETFU<FY>-NNNN = Eatofine's own delivery-service invoice number.
      const eatofineNo = await this.assignInvoiceNumber(order, 'eatofine_invoice_number', 'ETFU', fy, order.eatofine_invoice_number);

      // Admin-configurable invoice rates (defaults = previously hardcoded values).
      const [svcCgstRate, svcSgstRate, foodGstRate] = await Promise.all([
        this.bs.getNumber('service_invoice_cgst_rate', 9),
        this.bs.getNumber('service_invoice_sgst_rate', 9),
        this.bs.getNumber('food_gst_rate', 5),
      ]);

      // ── Page 1: restaurant ("On Behalf of Restaurant") food invoice ──────
      const r2inv = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
      const foodSubtotal = items.reduce((s, it) => s + Number(it.price) * Number(it.quantity), 0);
      const foodTax = items.reduce((s, it) => s + Number(it.tax_amount ?? 0), 0);
      const discountTotal = Number(order.coupon_discount_amount ?? 0) + Number(order.restaurant_discount_amount ?? 0);
      const netValue = Math.max(0, foodSubtotal - discountTotal);
      const foodHalfTax = r2inv(foodTax / 2);
      const gstRateHalf = netValue > 0 ? r2inv(((foodTax / netValue) * 100) / 2) : r2inv(foodGstRate / 2);
      const restItems = items.map((it) => {
        let parsed: { name?: string } = {};
        try { parsed = JSON.parse(it.food_details ?? '{}'); } catch { /* ignore */ }
        return {
          name: parsed.name ?? `Item #${it.food_id ?? '?'}`,
          qty: Number(it.quantity),
          unit_rate: r2inv(Number(it.price)),
          amount: r2inv(Number(it.price) * Number(it.quantity)),
        };
      });

      // ── Page 2: Eatofine service invoice — 18% GST (9% CGST + 9% SGST) ────
      const svcRow = (description: string, amount: number) => {
        const cgst = r2inv(amount * (svcCgstRate / 100));
        const sgst = r2inv(amount * (svcSgstRate / 100));
        return { description, amount: r2inv(amount), cgst, sgst, net: r2inv(amount + cgst + sgst) };
      };
      const eatofineRows = [
        svcRow('Delivery Charges', Number(order.delivery_charge ?? 0)),
        svcRow('Order Management Fees', Number(order.additional_charge ?? 0)),
        svcRow('Other Fees (Ex - convenience/surge/packaging)', Number(order.extra_packaging_amount ?? 0)),
      ];
      const eatofineTotal = r2inv(eatofineRows.reduce((s, x) => s + x.net, 0));
      const ph = (v?: string | null) => (v && String(v).trim() !== '' ? String(v) : null);

      return {
        invoice_no: invoiceNo,
        eatofine_invoice_no: eatofineNo,
        order_id: Number(order.mysql_id),
        order_date: dt,
        restaurant: {
          name: restaurant?.name ?? '—',
          // Legal/registered "business name" = the parent company the outlet is
          // registered under. A DISTINCT field from the outlet name — never
          // defaulted to it (null when the admin hasn't set it).
          business_name: ph(restaurant?.business_name),
          address: restaurant?.address ?? '—',
          gstin: ph(restaurant?.gstin),
          fssai: ph(restaurant?.fssai),
          cin: ph(restaurant?.cin),
        },
        customer: {
          name: (user ? `${user.f_name ?? ''} ${user.l_name ?? ''}`.trim() : '') || order.contact_person_name || 'Customer',
          email: user?.email ?? null,
          phone: user?.phone ?? order.contact_person_number ?? null,
          address: this.flattenAddress(order.delivery_address),
          place_of_delivery: null as string | null,
        },
        restaurant_invoice: {
          hsn: '996331',
          service_type: 'Restaurant Service',
          items: restItems,
          sub_total: r2inv(foodSubtotal),
          discount: r2inv(discountTotal),
          net_value: r2inv(netValue),
          gst_rate_half: gstRateHalf,
          cgst: foodHalfTax,
          igst: foodHalfTax,
          total: r2inv(netValue + foodTax),
        },
        eatofine_invoice: {
          hsn: '999799',
          supply_description: 'Other Services N.E.C',
          rows: eatofineRows,
          total: eatofineTotal,
        },
        issued_on: order.delivered ?? order.created_at_legacy ?? order.created_at,
        bill_from: {
          name: restaurant?.name ?? '—',
          address: restaurant?.address ?? '—',
          gstin: '29ABCDE1234F1Z5',
          state: 'Delhi', state_code: '07',
        },
        bill_to: {
          // POS / walk-in orders have no user — use the counter contact details.
          name: (user ? `${user.f_name ?? ''} ${user.l_name ?? ''}`.trim() : '') || order.contact_person_name || 'Customer',
          email: user?.email ?? null,
          phone: user?.phone ?? order.contact_person_number ?? null,
          address: this.flattenAddress(order.delivery_address),
        },
        items: items.map((it) => {
          let parsed: { name?: string } = {};
          try { parsed = JSON.parse(it.food_details ?? '{}'); } catch { /* ignore */ }
          return {
            id: Number(it.mysql_id),
            name: parsed.name ?? `Item #${it.food_id ?? '?'}`,
            hsn: '996331',
            qty: it.quantity,
            unit_price: Number(it.price),
            subtotal: Number(it.price) * Number(it.quantity),
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
    const fy = this.fyCode(dt);
    return {
      invoice_no: `OBR${fy}-${String(Number(order.id)).padStart(4, '0')}`,
      eatofine_invoice_no: `ETFU${fy}-${String(Number(order.id)).padStart(4, '0')}`,
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
        address: this.flattenAddress(order.delivery_address),
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

    if (this.useMongo()) {
      const match: Record<string, unknown> = { order_status: 'delivered', payment_status: 'paid' };
      if (opts.vendor_id) {
        const r = await this.mongo.findOne<MongoRestaurantDoc>('restaurants', { mysql_vendor_id: Number(opts.vendor_id) });
        if (r) match.mysql_restaurant_id = Number(r.mysql_id);
      }
      const groups = await this.mongo.aggregate<{
        _id: number;
        total: number;
        count: number;
      }>('orders', [
        { $match: match },
        {
          $group: {
            _id: '$mysql_restaurant_id',
            total: { $sum: '$order_amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
      ]);
      const rIds = groups.map((g) => Number(g._id)).filter((n) => !isNaN(n));
      const restaurants = rIds.length
        ? await this.mongo.findMany<MongoRestaurantDoc>('restaurants', { mysql_id: { $in: rIds } })
        : [];
      const rMap = new Map(restaurants.map((r) => [String(r.mysql_id), r]));
      return {
        tds_rate: rate, threshold,
        rows: groups.map((g) => {
          const r = rMap.get(String(Number(g._id)));
          const grossPayout = Number(g.total ?? 0);
          const commission = r?.comission !== null && r?.comission !== undefined ? Number(r.comission) : 0;
          const adminCut = grossPayout * (commission / 100);
          const netVendorPayout = grossPayout - adminCut;
          const tdsApplies = netVendorPayout >= threshold;
          const tdsAmount = tdsApplies ? +(netVendorPayout * (rate / 100)).toFixed(2) : 0;
          const finalDisbursement = +(netVendorPayout - tdsAmount).toFixed(2);
          return {
            restaurant_id: Number(g._id),
            restaurant: r?.name ?? null,
            vendor_id: r?.mysql_vendor_id != null ? Number(r.mysql_vendor_id) : null,
            orders: Number(g.count ?? 0),
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
