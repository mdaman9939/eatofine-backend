import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';
import { toNum } from '../common/decimal';

// BRD §6 — User-side delivery charge: slabs + surcharges + free-delivery threshold + surge pricing matrix.
// Per BRD §6.5 the result IS GST-applicable (unlike §5.4 DM side).

interface SlabRow { id: number; min_km: number; max_km: number; base_charge: number; extra_per_km: number; gst_rate: number; status: number }
interface SurRow { id: number; surcharge_type: 'weekend'|'festival'|'late_night'|'surge'; label: string; config_json: unknown; surcharge_type_value: 'fixed'|'percentage'|'multiplier'; amount: number; gst_rate: number; status: number }
interface FreeRow { id: number; min_order_value: number; status: number }
interface SurgeRow { day_of_week: number; hour_of_day: number; multiplier: number; status: number }

interface MongoSlabDoc {
  mysql_id: number;
  min_km: number;
  max_km: number;
  base_charge: number;
  extra_per_km: number;
  gst_rate: number;
  status: number | boolean;
}

interface MongoSurDoc {
  mysql_id: number;
  surcharge_type: 'weekend' | 'festival' | 'late_night' | 'surge';
  label: string;
  config_json: unknown;
  surcharge_type_value: 'fixed' | 'percentage' | 'multiplier';
  amount: number;
  gst_rate: number;
  status: number | boolean;
}

interface MongoFreeDoc {
  mysql_id: number;
  min_order_value: number;
  status: number | boolean;
}

interface MongoSurgeDoc {
  day_of_week: number;
  hour_of_day: number;
  multiplier: number;
  status: number | boolean;
}

export interface UserApplicableSurcharge {
  id: number;
  type: SurRow['surcharge_type'];
  label: string;
  amount: number;
  gst_amount: number;
}

@Injectable()
export class UserDeliveryChargesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mongo: MongoDataService,
  ) {}

  /** Feature flag — when "1"/"true"/"yes", reads/writes route to MongoDB. */
  private useMongo(): boolean {
    const v = (process.env.USE_MONGO_ENHANCEMENTS ?? '1').toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }

  // ── Slabs ────────────────────────────────────────────────────────
  async listSlabs() {
    if (this.useMongo()) {
      const docs = await this.mongo.findMany<MongoSlabDoc>(
        'user_delivery_slabs',
        {},
        { sort: { min_km: 1 } },
      );
      return docs.map((r) => ({
        id: Number(r.mysql_id),
        // toNum decodes migrated decimal.js objects ({s,e,d}) → a NaN here would
        // make the slab never match (distance >= NaN is false) and silently
        // collapse the fee to the ₹0 fallback.
        min_km: toNum(r.min_km),
        max_km: toNum(r.max_km),
        base_charge: toNum(r.base_charge),
        extra_per_km: toNum(r.extra_per_km),
        gst_rate: toNum(r.gst_rate),
        status: !!r.status,
      }));
    }
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
    if (this.useMongo()) {
      const nextId = await this.mongo.nextMysqlId('user_delivery_slabs');
      const now = new Date();
      await this.mongo.insertOne('user_delivery_slabs', {
        mysql_id: nextId,
        min_km: body.min_km,
        max_km: body.max_km,
        base_charge: body.base_charge,
        extra_per_km: body.extra_per_km ?? 0,
        gst_rate: body.gst_rate ?? 18,
        status: 1,
        effective_from: now,
        created_at: now,
        updated_at: now,
      });
      return { ok: true };
    }
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO user_delivery_slabs (min_km, max_km, base_charge, extra_per_km, gst_rate, status, effective_from, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW(), NOW())`,
      body.min_km, body.max_km, body.base_charge, body.extra_per_km ?? 0, body.gst_rate ?? 18,
    );
    return { ok: true };
  }

  async updateSlab(id: number, body: { min_km?: number; max_km?: number; base_charge?: number; extra_per_km?: number; gst_rate?: number; status?: boolean }) {
    if (this.useMongo()) {
      const set: Record<string, unknown> = {};
      if (body.min_km !== undefined) set.min_km = body.min_km;
      if (body.max_km !== undefined) set.max_km = body.max_km;
      if (body.base_charge !== undefined) set.base_charge = body.base_charge;
      if (body.extra_per_km !== undefined) set.extra_per_km = body.extra_per_km;
      if (body.gst_rate !== undefined) set.gst_rate = body.gst_rate;
      if (body.status !== undefined) set.status = body.status ? 1 : 0;
      if (!Object.keys(set).length) throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields' }] });
      set.updated_at = new Date();
      await this.mongo.updateOne('user_delivery_slabs', { mysql_id: Number(id) }, set);
      return { ok: true, id };
    }
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
    if (this.useMongo()) {
      await this.mongo.deleteOne('user_delivery_slabs', { mysql_id: Number(id) });
      return { ok: true, id };
    }
    await this.prisma.$executeRawUnsafe('DELETE FROM user_delivery_slabs WHERE id = ?', id);
    return { ok: true, id };
  }

  // ── Surcharges ───────────────────────────────────────────────────
  async listSurcharges() {
    if (this.useMongo()) {
      const docs = await this.mongo.findMany<MongoSurDoc>(
        'user_delivery_surcharges',
        {},
        { sort: { surcharge_type: 1, mysql_id: 1 } },
      );
      return docs.map((r) => ({
        id: Number(r.mysql_id),
        surcharge_type: r.surcharge_type,
        label: r.label,
        config_json: typeof r.config_json === 'string' ? JSON.parse(r.config_json) : r.config_json,
        surcharge_type_value: r.surcharge_type_value,
        // toNum decodes migrated decimal.js objects (some surcharge amounts are
        // stored as {s,e,d}) so they don't become NaN in the fee math.
        amount: toNum(r.amount),
        gst_rate: toNum(r.gst_rate),
        status: !!r.status,
      }));
    }
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
    if (this.useMongo()) {
      const nextId = await this.mongo.nextMysqlId('user_delivery_surcharges');
      const now = new Date();
      await this.mongo.insertOne('user_delivery_surcharges', {
        mysql_id: nextId,
        surcharge_type: body.surcharge_type,
        label: body.label,
        config_json: body.config_json,
        surcharge_type_value: body.surcharge_type_value ?? 'fixed',
        amount: body.amount,
        gst_rate: body.gst_rate ?? 18,
        status: 1,
        effective_from: now,
        created_at: now,
        updated_at: now,
      });
      return { ok: true };
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
    if (this.useMongo()) {
      const set: Record<string, unknown> = {};
      if (body.label !== undefined) set.label = body.label;
      if (body.config_json !== undefined) set.config_json = body.config_json;
      if (body.surcharge_type_value !== undefined) set.surcharge_type_value = body.surcharge_type_value;
      if (body.amount !== undefined) set.amount = body.amount;
      if (body.gst_rate !== undefined) set.gst_rate = body.gst_rate;
      if (body.status !== undefined) set.status = body.status ? 1 : 0;
      if (!Object.keys(set).length) throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields' }] });
      set.updated_at = new Date();
      await this.mongo.updateOne('user_delivery_surcharges', { mysql_id: Number(id) }, set);
      return { ok: true, id };
    }
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
    if (this.useMongo()) {
      await this.mongo.deleteOne('user_delivery_surcharges', { mysql_id: Number(id) });
      return { ok: true, id };
    }
    await this.prisma.$executeRawUnsafe('DELETE FROM user_delivery_surcharges WHERE id = ?', id);
    return { ok: true, id };
  }

  // ── Free delivery (singleton) ────────────────────────────────────
  async getFreeDelivery() {
    if (this.useMongo()) {
      const docs = await this.mongo.findMany<MongoFreeDoc>(
        'free_delivery_settings',
        {},
        { sort: { mysql_id: 1 }, limit: 1 },
      );
      const r = docs[0];
      if (!r) return { id: 0, min_order_value: 0, status: false };
      return { id: Number(r.mysql_id), min_order_value: toNum(r.min_order_value), status: !!r.status };
    }
    const rows = await this.prisma.$queryRawUnsafe<FreeRow[]>(
      `SELECT id, min_order_value, status FROM free_delivery_settings ORDER BY id ASC LIMIT 1`,
    );
    const r = rows[0];
    if (!r) return { id: 0, min_order_value: 0, status: false };
    return { id: Number(r.id), min_order_value: Number(r.min_order_value), status: !!r.status };
  }

  async updateFreeDelivery(body: { min_order_value?: number; status?: boolean }) {
    if (this.useMongo()) {
      const set: Record<string, unknown> = {};
      if (body.min_order_value !== undefined) set.min_order_value = body.min_order_value;
      if (body.status !== undefined) set.status = body.status ? 1 : 0;
      if (!Object.keys(set).length) throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields' }] });
      set.updated_at = new Date();
      // Find the singleton row (lowest mysql_id) and update it
      const top = await this.mongo.findMany<MongoFreeDoc>(
        'free_delivery_settings',
        {},
        { sort: { mysql_id: 1 }, limit: 1 },
      );
      if (top[0]) {
        await this.mongo.updateOne('free_delivery_settings', { mysql_id: Number(top[0].mysql_id) }, set);
      }
      return { ok: true };
    }
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
    if (this.useMongo()) {
      const docs = await this.mongo.findMany<MongoSurgeDoc>(
        'surge_pricing_grid',
        {},
        { sort: { day_of_week: 1, hour_of_day: 1 } },
      );
      return docs.map((r) => ({
        day_of_week: Number(r.day_of_week),
        hour_of_day: Number(r.hour_of_day),
        // Migrated MySQL DECIMAL cells land in Mongo as a decimal.js object
        // ({s,e,d}); plain Number() on them is NaN, which silently zeroes the
        // whole delivery fee. toNum decodes them; default 1 = no surge.
        multiplier: toNum(r.multiplier, 1),
        status: !!r.status,
      }));
    }
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
    if (this.useMongo()) {
      await this.mongo.updateOne(
        'surge_pricing_grid',
        { day_of_week: body.day_of_week, hour_of_day: body.hour_of_day },
        {
          multiplier: body.multiplier,
          status: body.status === false ? 0 : 1,
          updated_at: new Date(),
        },
      );
      return { ok: true };
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
    const activeSlabs = slabs.filter((s) => s.status && Number.isFinite(s.min_km) && Number.isFinite(s.max_km));
    let slab = activeSlabs.find((s) => input.distance_km >= s.min_km && input.distance_km <= s.max_km);
    // When the distance falls OUTSIDE every configured tier we still price it from
    // the slabs (never ₹0, never a flat cap that ignores distance):
    //   • a gap between tiers (e.g. 6-7, 8-10 km) → round UP to the next tier;
    //   • beyond the farthest tier → that tier's charge SCALED by distance
    //     (fee × distance / tier.max_km) so a longer trip always costs more.
    let beyondScale = 1;
    let priced: 'exact' | 'rounded_up' | 'extrapolated' = 'exact';
    if (!slab && activeSlabs.length) {
      const sorted = [...activeSlabs].sort((a, b) => a.min_km - b.min_km);
      const farthest = sorted.reduce((a, b) => (b.max_km > a.max_km ? b : a));
      if (input.distance_km > farthest.max_km) {
        slab = farthest;
        beyondScale = farthest.max_km > 0 ? input.distance_km / farthest.max_km : 1;
        priced = 'extrapolated';
      } else {
        // In a gap — charge the next tier up (the cheapest tier starting past it).
        slab = sorted.find((s) => s.min_km > input.distance_km) ?? farthest;
        priced = 'rounded_up';
      }
    }
    if (!slab) {
      return {
        distance_km: input.distance_km, order_value: input.order_value,
        matched_slab: null,
        base_charge: 0, extra_charge: 0, surcharges: [], surge_multiplier: 1,
        gst_amount: 0, total: 0,
        free_delivery: false,
        notes: 'No active slab configured.',
      };
    }
    // Long-trip reward: a FLAT bonus added on top of the slab's base charge for
    // any trip in this (longer-distance) slab — NOT a per-km multiplier. The
    // whole delivery fee (incl. this reward) settles to the delivery partner, so
    // a bigger reward on the longer slabs means a better payout for long trips.
    const longTripReward = +(Number(slab.extra_per_km) || 0).toFixed(2);
    // Scale the tier's charge by distance when extrapolating beyond the farthest
    // tier (beyondScale = 1 for an exact / rounded-up match).
    const baseTotal = +(((slab.base_charge + longTripReward) * beyondScale)).toFixed(2);

    const when = input.when ? new Date(input.when) : new Date();
    const dow = when.getDay();
    const hour = when.getHours();
    const isoDate = when.toISOString().slice(0, 10);

    // Surge cell (multiplier on subtotal)
    const grid = await this.getSurgeGrid();
    const surgeCell = grid.find((g) => g.day_of_week === dow && g.hour_of_day === hour && g.status);
    // A surge multiplier must scale UP (>= 1). Guard against a missing/invalid/0
    // cell so a bad value never collapses the delivery fee to ₹0.
    const surgeMul = surgeCell && Number.isFinite(surgeCell.multiplier) && surgeCell.multiplier > 0
      ? surgeCell.multiplier : 1;

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

    // Vehicle-category surcharge: the active vehicle tier whose coverage area
    // covers this delivery distance adds its flat `extra_charges` to the fee
    // (e.g. a longer-range vehicle costs more). 0 when no tier matches.
    const vehicle = await this.vehicleTierExtra(input.distance_km);

    const baseAfterSurge   = +(baseTotal * surgeMul).toFixed(2);
    const baseGstAmount    = +(baseAfterSurge * slab.gst_rate / 100).toFixed(2);
    const subtotal         = +(baseAfterSurge + surchargeTotal + vehicle.amount).toFixed(2);
    const gstTotal         = +(baseGstAmount + surchargeGst).toFixed(2);
    const total            = +(subtotal + gstTotal).toFixed(2);

    return {
      distance_km: input.distance_km, order_value: input.order_value,
      matched_slab: { id: slab.id, min_km: slab.min_km, max_km: slab.max_km, base_charge: slab.base_charge, extra_per_km: slab.extra_per_km, gst_rate: slab.gst_rate },
      // How the tier was applied: exact match, rounded up across a gap, or
      // distance-scaled beyond the farthest tier — surfaced for the UI.
      priced_by: priced,
      base_charge: slab.base_charge, extra_charge: longTripReward,
      base_after_surge: baseAfterSurge,
      surge_multiplier: surgeMul,
      surcharges: applicable,
      vehicle_extra: vehicle.amount,
      vehicle_tier: vehicle.amount > 0 ? vehicle.label : null,
      gst_amount: gstTotal,
      subtotal, total,
      free_delivery: false,
    };
  }

  /** The active vehicle category whose coverage area covers this distance and
   *  carries an extra charge. Returns the flat extra to add to the delivery fee
   *  (0 when none matches). Admin-controlled via the Vehicle Category page. */
  private async vehicleTierExtra(distanceKm: number): Promise<{ amount: number; label: string }> {
    if (!this.useMongo()) return { amount: 0, label: '' };
    const rows = await this.mongo.findMany<{
      mysql_id?: number; type?: string; extra_charges?: number;
      starting_coverage_area?: number; maximum_coverage_area?: number; status?: boolean | number;
    }>('vehicles', { status: { $in: [true, 1] } }, { sort: { starting_coverage_area: 1, mysql_id: 1 } });
    for (const v of rows) {
      // toNum decodes migrated decimal.js objects so a tier never adds NaN.
      const extra = toNum(v.extra_charges);
      const start = toNum(v.starting_coverage_area);
      const max = toNum(v.maximum_coverage_area);
      if (extra <= 0 || max <= 0) continue; // unconfigured tier — no surcharge
      if (distanceKm >= start && distanceKm <= max) {
        return { amount: +extra.toFixed(2), label: `Vehicle: ${v.type ?? `#${v.mysql_id}`}` };
      }
    }
    return { amount: 0, label: '' };
  }
}
