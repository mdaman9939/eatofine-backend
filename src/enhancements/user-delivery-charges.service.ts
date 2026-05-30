import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// BRD §6 — User-side delivery charge: slabs + surcharges + free-delivery threshold + surge pricing matrix.
// Per BRD §6.5 the result IS GST-applicable (unlike §5.4 DM side).

interface SlabRow { id: number; min_km: number; max_km: number; base_charge: number; extra_per_km: number; gst_rate: number; status: number }
interface SurRow { id: number; surcharge_type: 'weekend'|'festival'|'late_night'|'surge'; label: string; config_json: unknown; surcharge_type_value: 'fixed'|'percentage'|'multiplier'; amount: number; gst_rate: number; status: number }
interface FreeRow { id: number; min_order_value: number; status: number }
interface SurgeRow { day_of_week: number; hour_of_day: number; multiplier: number; status: number }

export interface UserApplicableSurcharge {
  id: number;
  type: SurRow['surcharge_type'];
  label: string;
  amount: number;
  gst_amount: number;
}

@Injectable()
export class UserDeliveryChargesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Slabs ────────────────────────────────────────────────────────
  async listSlabs() {
    const rows = await this.prisma.$queryRawUnsafe<SlabRow[]>(
      `SELECT id, min_km, max_km, base_charge, extra_per_km, gst_rate, status
       FROM user_delivery_slabs ORDER BY min_km ASC`,
    );
    return rows.map((r) => ({ ...r, id: Number(r.id), min_km: Number(r.min_km), max_km: Number(r.max_km), base_charge: Number(r.base_charge), extra_per_km: Number(r.extra_per_km), gst_rate: Number(r.gst_rate), status: !!r.status }));
  }

  async createSlab(body: { min_km: number; max_km: number; base_charge: number; extra_per_km?: number; gst_rate?: number }) {
    if (typeof body.min_km !== 'number' || typeof body.max_km !== 'number') {
      throw new BadRequestException({ errors: [{ code: 'body', message: 'min_km/max_km required' }] });
    }
    if (body.max_km <= body.min_km) throw new BadRequestException({ errors: [{ code: 'range', message: 'max_km must be > min_km' }] });
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO user_delivery_slabs (min_km, max_km, base_charge, extra_per_km, gst_rate, status, effective_from, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW(), NOW())`,
      body.min_km, body.max_km, body.base_charge, body.extra_per_km ?? 0, body.gst_rate ?? 18,
    );
    return { ok: true };
  }

  async updateSlab(id: number, body: { min_km?: number; max_km?: number; base_charge?: number; extra_per_km?: number; gst_rate?: number; status?: boolean }) {
    const updates: string[] = [];
    const values: unknown[] = [];
    if (body.min_km !== undefined) { updates.push('min_km = ?'); values.push(body.min_km); }
    if (body.max_km !== undefined) { updates.push('max_km = ?'); values.push(body.max_km); }
    if (body.base_charge !== undefined) { updates.push('base_charge = ?'); values.push(body.base_charge); }
    if (body.extra_per_km !== undefined) { updates.push('extra_per_km = ?'); values.push(body.extra_per_km); }
    if (body.gst_rate !== undefined) { updates.push('gst_rate = ?'); values.push(body.gst_rate); }
    if (body.status !== undefined) { updates.push('status = ?'); values.push(body.status ? 1 : 0); }
    if (!updates.length) throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields' }] });
    updates.push('updated_at = NOW()');
    values.push(id);
    await this.prisma.$executeRawUnsafe(`UPDATE user_delivery_slabs SET ${updates.join(', ')} WHERE id = ?`, ...values);
    return { ok: true, id };
  }

  async deleteSlab(id: number) {
    await this.prisma.$executeRawUnsafe('DELETE FROM user_delivery_slabs WHERE id = ?', id);
    return { ok: true, id };
  }

  // ── Surcharges ───────────────────────────────────────────────────
  async listSurcharges() {
    const rows = await this.prisma.$queryRawUnsafe<SurRow[]>(
      `SELECT id, surcharge_type, label, config_json, surcharge_type_value, amount, gst_rate, status
       FROM user_delivery_surcharges ORDER BY surcharge_type ASC, id ASC`,
    );
    return rows.map((r) => ({
      ...r,
      id: Number(r.id), amount: Number(r.amount), gst_rate: Number(r.gst_rate),
      status: !!r.status,
      config_json: typeof r.config_json === 'string' ? JSON.parse(r.config_json) : r.config_json,
    }));
  }

  async createSurcharge(body: { surcharge_type: SurRow['surcharge_type']; label: string; config_json: unknown; surcharge_type_value?: SurRow['surcharge_type_value']; amount: number; gst_rate?: number }) {
    if (!body.surcharge_type || !body.label || body.config_json === undefined || body.config_json === null) {
      throw new BadRequestException({ errors: [{ code: 'body', message: 'type/label/config_json required' }] });
    }
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO user_delivery_surcharges (surcharge_type, label, config_json, surcharge_type_value, amount, gst_rate, status, effective_from, created_at, updated_at)
       VALUES (?, ?, CAST(? AS JSON), ?, ?, ?, 1, NOW(), NOW(), NOW())`,
      body.surcharge_type, body.label, JSON.stringify(body.config_json),
      body.surcharge_type_value ?? 'fixed', body.amount, body.gst_rate ?? 18,
    );
    return { ok: true };
  }

  async updateSurcharge(id: number, body: { label?: string; config_json?: unknown; surcharge_type_value?: SurRow['surcharge_type_value']; amount?: number; gst_rate?: number; status?: boolean }) {
    const updates: string[] = [];
    const values: unknown[] = [];
    if (body.label !== undefined) { updates.push('label = ?'); values.push(body.label); }
    if (body.config_json !== undefined) { updates.push('config_json = CAST(? AS JSON)'); values.push(JSON.stringify(body.config_json)); }
    if (body.surcharge_type_value !== undefined) { updates.push('surcharge_type_value = ?'); values.push(body.surcharge_type_value); }
    if (body.amount !== undefined) { updates.push('amount = ?'); values.push(body.amount); }
    if (body.gst_rate !== undefined) { updates.push('gst_rate = ?'); values.push(body.gst_rate); }
    if (body.status !== undefined) { updates.push('status = ?'); values.push(body.status ? 1 : 0); }
    if (!updates.length) throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields' }] });
    updates.push('updated_at = NOW()');
    values.push(id);
    await this.prisma.$executeRawUnsafe(`UPDATE user_delivery_surcharges SET ${updates.join(', ')} WHERE id = ?`, ...values);
    return { ok: true, id };
  }

  async deleteSurcharge(id: number) {
    await this.prisma.$executeRawUnsafe('DELETE FROM user_delivery_surcharges WHERE id = ?', id);
    return { ok: true, id };
  }

  // ── Free delivery (singleton) ────────────────────────────────────
  async getFreeDelivery() {
    const rows = await this.prisma.$queryRawUnsafe<FreeRow[]>(
      `SELECT id, min_order_value, status FROM free_delivery_settings ORDER BY id ASC LIMIT 1`,
    );
    const r = rows[0];
    if (!r) return { id: 0, min_order_value: 0, status: false };
    return { id: Number(r.id), min_order_value: Number(r.min_order_value), status: !!r.status };
  }

  async updateFreeDelivery(body: { min_order_value?: number; status?: boolean }) {
    const updates: string[] = [];
    const values: unknown[] = [];
    if (body.min_order_value !== undefined) { updates.push('min_order_value = ?'); values.push(body.min_order_value); }
    if (body.status !== undefined) { updates.push('status = ?'); values.push(body.status ? 1 : 0); }
    if (!updates.length) throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields' }] });
    updates.push('updated_at = NOW()');
    await this.prisma.$executeRawUnsafe(`UPDATE free_delivery_settings SET ${updates.join(', ')} WHERE id = (SELECT id FROM (SELECT id FROM free_delivery_settings ORDER BY id ASC LIMIT 1) AS t)`, ...values);
    return { ok: true };
  }

  // ── Surge pricing grid (7×24) ────────────────────────────────────
  async getSurgeGrid() {
    const rows = await this.prisma.$queryRawUnsafe<SurgeRow[]>(
      `SELECT day_of_week, hour_of_day, multiplier, status FROM surge_pricing_grid ORDER BY day_of_week, hour_of_day`,
    );
    return rows.map((r) => ({ day_of_week: Number(r.day_of_week), hour_of_day: Number(r.hour_of_day), multiplier: Number(r.multiplier), status: !!r.status }));
  }

  async updateSurgeCell(body: { day_of_week: number; hour_of_day: number; multiplier: number; status?: boolean }) {
    if (typeof body.day_of_week !== 'number' || typeof body.hour_of_day !== 'number' || typeof body.multiplier !== 'number') {
      throw new BadRequestException({ errors: [{ code: 'body', message: 'day_of_week/hour_of_day/multiplier required' }] });
    }
    if (body.day_of_week < 0 || body.day_of_week > 6 || body.hour_of_day < 0 || body.hour_of_day > 23) {
      throw new BadRequestException({ errors: [{ code: 'range', message: 'day_of_week 0..6, hour_of_day 0..23' }] });
    }
    await this.prisma.$executeRawUnsafe(
      `UPDATE surge_pricing_grid SET multiplier = ?, status = ?, updated_at = NOW()
       WHERE day_of_week = ? AND hour_of_day = ?`,
      body.multiplier, body.status === false ? 0 : 1, body.day_of_week, body.hour_of_day,
    );
    return { ok: true };
  }

  // ── Calculate ────────────────────────────────────────────────────
  async calculate(input: { distance_km: number; order_value: number; when?: string }) {
    if (typeof input.distance_km !== 'number' || input.distance_km < 0) {
      throw new BadRequestException({ errors: [{ code: 'distance_km', message: 'distance_km >= 0 required' }] });
    }
    if (typeof input.order_value !== 'number' || input.order_value < 0) {
      throw new BadRequestException({ errors: [{ code: 'order_value', message: 'order_value >= 0 required' }] });
    }

    const free = await this.getFreeDelivery();
    if (free.status && input.order_value >= free.min_order_value) {
      return {
        distance_km: input.distance_km, order_value: input.order_value,
        matched_slab: null,
        base_charge: 0, extra_charge: 0, surcharges: [], surge_multiplier: 1,
        gst_amount: 0, total: 0,
        free_delivery: true,
        notes: `Free delivery threshold (₹${free.min_order_value.toFixed(2)}) met.`,
      };
    }

    const slabs = await this.listSlabs();
    const slab = slabs.find((s) => s.status && input.distance_km >= s.min_km && input.distance_km <= s.max_km);
    if (!slab) {
      return {
        distance_km: input.distance_km, order_value: input.order_value,
        matched_slab: null,
        base_charge: 0, extra_charge: 0, surcharges: [], surge_multiplier: 1,
        gst_amount: 0, total: 0,
        free_delivery: false,
        notes: 'No active slab matches the given distance.',
      };
    }
    const extraKm = Math.max(0, input.distance_km - slab.min_km);
    const extraCharge = +(extraKm * slab.extra_per_km).toFixed(2);
    const baseTotal = slab.base_charge + extraCharge;

    const when = input.when ? new Date(input.when) : new Date();
    const dow = when.getDay();
    const hour = when.getHours();
    const isoDate = when.toISOString().slice(0, 10);

    // Surge cell (multiplier on subtotal)
    const grid = await this.getSurgeGrid();
    const surgeCell = grid.find((g) => g.day_of_week === dow && g.hour_of_day === hour && g.status);
    const surgeMul = surgeCell ? surgeCell.multiplier : 1;

    // Other surcharges
    const surcharges = await this.listSurcharges();
    const applicable: UserApplicableSurcharge[] = [];
    for (const s of surcharges) {
      if (!s.status) continue;
      if (s.surcharge_type === 'surge') continue; // grid handles surge
      const cfg = s.config_json as Record<string, unknown>;
      let match = false;
      if (s.surcharge_type === 'weekend' && Array.isArray(cfg.days)) {
        match = (cfg.days as number[]).includes(dow);
      } else if (s.surcharge_type === 'late_night' && typeof cfg.start === 'string' && typeof cfg.end === 'string') {
        const startH = parseInt(cfg.start.split(':')[0], 10);
        const endH = parseInt(cfg.end.split(':')[0], 10);
        match = startH <= endH ? hour >= startH && hour < endH : hour >= startH || hour < endH;
      } else if (s.surcharge_type === 'festival' && Array.isArray(cfg.dates)) {
        match = (cfg.dates as string[]).includes(isoDate);
      }
      if (!match) continue;
      let amount = 0;
      if (s.surcharge_type_value === 'percentage') amount = +(baseTotal * s.amount / 100).toFixed(2);
      else amount = s.amount;
      const gstAmount = +(amount * s.gst_rate / 100).toFixed(2);
      applicable.push({ id: s.id, type: s.surcharge_type, label: s.label, amount, gst_amount: gstAmount });
    }
    const surchargeTotal = applicable.reduce((a, b) => a + b.amount, 0);
    const surchargeGst   = applicable.reduce((a, b) => a + b.gst_amount, 0);

    const baseAfterSurge   = +(baseTotal * surgeMul).toFixed(2);
    const baseGstAmount    = +(baseAfterSurge * slab.gst_rate / 100).toFixed(2);
    const subtotal         = +(baseAfterSurge + surchargeTotal).toFixed(2);
    const gstTotal         = +(baseGstAmount + surchargeGst).toFixed(2);
    const total            = +(subtotal + gstTotal).toFixed(2);

    return {
      distance_km: input.distance_km, order_value: input.order_value,
      matched_slab: { id: slab.id, min_km: slab.min_km, max_km: slab.max_km, base_charge: slab.base_charge, extra_per_km: slab.extra_per_km, gst_rate: slab.gst_rate },
      base_charge: slab.base_charge, extra_charge: extraCharge,
      base_after_surge: baseAfterSurge,
      surge_multiplier: surgeMul,
      surcharges: applicable,
      gst_amount: gstTotal,
      subtotal, total,
      free_delivery: false,
    };
  }
}
