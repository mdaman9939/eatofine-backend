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
exports.UserDeliveryChargesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const mongo_data_service_1 = require("../mongo/mongo-data.service");
let UserDeliveryChargesService = class UserDeliveryChargesService {
    prisma;
    mongo;
    constructor(prisma, mongo) {
        this.prisma = prisma;
        this.mongo = mongo;
    }
    useMongo() {
        const v = (process.env.USE_MONGO_ENHANCEMENTS ?? '1').toLowerCase();
        return v === '1' || v === 'true' || v === 'yes';
    }
    async listSlabs() {
        if (this.useMongo()) {
            const docs = await this.mongo.findMany('user_delivery_slabs', {}, { sort: { min_km: 1 } });
            return docs.map((r) => ({
                id: Number(r.mysql_id),
                min_km: Number(r.min_km),
                max_km: Number(r.max_km),
                base_charge: Number(r.base_charge),
                extra_per_km: Number(r.extra_per_km),
                gst_rate: Number(r.gst_rate),
                status: !!r.status,
            }));
        }
        const rows = await this.prisma.$queryRawUnsafe(`SELECT id, min_km, max_km, base_charge, extra_per_km, gst_rate, status
       FROM user_delivery_slabs ORDER BY min_km ASC`);
        return rows.map((r) => ({ ...r, id: Number(r.id), min_km: Number(r.min_km), max_km: Number(r.max_km), base_charge: Number(r.base_charge), extra_per_km: Number(r.extra_per_km), gst_rate: Number(r.gst_rate), status: !!r.status }));
    }
    async createSlab(body) {
        if (typeof body.min_km !== 'number' || typeof body.max_km !== 'number') {
            throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'min_km/max_km required' }] });
        }
        if (body.max_km <= body.min_km)
            throw new common_1.BadRequestException({ errors: [{ code: 'range', message: 'max_km must be > min_km' }] });
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
        await this.prisma.$executeRawUnsafe(`INSERT INTO user_delivery_slabs (min_km, max_km, base_charge, extra_per_km, gst_rate, status, effective_from, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW(), NOW())`, body.min_km, body.max_km, body.base_charge, body.extra_per_km ?? 0, body.gst_rate ?? 18);
        return { ok: true };
    }
    async updateSlab(id, body) {
        if (this.useMongo()) {
            const set = {};
            if (body.min_km !== undefined)
                set.min_km = body.min_km;
            if (body.max_km !== undefined)
                set.max_km = body.max_km;
            if (body.base_charge !== undefined)
                set.base_charge = body.base_charge;
            if (body.extra_per_km !== undefined)
                set.extra_per_km = body.extra_per_km;
            if (body.gst_rate !== undefined)
                set.gst_rate = body.gst_rate;
            if (body.status !== undefined)
                set.status = body.status ? 1 : 0;
            if (!Object.keys(set).length)
                throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'no fields' }] });
            set.updated_at = new Date();
            await this.mongo.updateOne('user_delivery_slabs', { mysql_id: Number(id) }, set);
            return { ok: true, id };
        }
        const updates = [];
        const values = [];
        if (body.min_km !== undefined) {
            updates.push('min_km = ?');
            values.push(body.min_km);
        }
        if (body.max_km !== undefined) {
            updates.push('max_km = ?');
            values.push(body.max_km);
        }
        if (body.base_charge !== undefined) {
            updates.push('base_charge = ?');
            values.push(body.base_charge);
        }
        if (body.extra_per_km !== undefined) {
            updates.push('extra_per_km = ?');
            values.push(body.extra_per_km);
        }
        if (body.gst_rate !== undefined) {
            updates.push('gst_rate = ?');
            values.push(body.gst_rate);
        }
        if (body.status !== undefined) {
            updates.push('status = ?');
            values.push(body.status ? 1 : 0);
        }
        if (!updates.length)
            throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'no fields' }] });
        updates.push('updated_at = NOW()');
        values.push(id);
        await this.prisma.$executeRawUnsafe(`UPDATE user_delivery_slabs SET ${updates.join(', ')} WHERE id = ?`, ...values);
        return { ok: true, id };
    }
    async deleteSlab(id) {
        if (this.useMongo()) {
            await this.mongo.deleteOne('user_delivery_slabs', { mysql_id: Number(id) });
            return { ok: true, id };
        }
        await this.prisma.$executeRawUnsafe('DELETE FROM user_delivery_slabs WHERE id = ?', id);
        return { ok: true, id };
    }
    async listSurcharges() {
        if (this.useMongo()) {
            const docs = await this.mongo.findMany('user_delivery_surcharges', {}, { sort: { surcharge_type: 1, mysql_id: 1 } });
            return docs.map((r) => ({
                id: Number(r.mysql_id),
                surcharge_type: r.surcharge_type,
                label: r.label,
                config_json: typeof r.config_json === 'string' ? JSON.parse(r.config_json) : r.config_json,
                surcharge_type_value: r.surcharge_type_value,
                amount: Number(r.amount),
                gst_rate: Number(r.gst_rate),
                status: !!r.status,
            }));
        }
        const rows = await this.prisma.$queryRawUnsafe(`SELECT id, surcharge_type, label, config_json, surcharge_type_value, amount, gst_rate, status
       FROM user_delivery_surcharges ORDER BY surcharge_type ASC, id ASC`);
        return rows.map((r) => ({
            ...r,
            id: Number(r.id), amount: Number(r.amount), gst_rate: Number(r.gst_rate),
            status: !!r.status,
            config_json: typeof r.config_json === 'string' ? JSON.parse(r.config_json) : r.config_json,
        }));
    }
    async createSurcharge(body) {
        if (!body.surcharge_type || !body.label || body.config_json === undefined || body.config_json === null) {
            throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'type/label/config_json required' }] });
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
        await this.prisma.$executeRawUnsafe(`INSERT INTO user_delivery_surcharges (surcharge_type, label, config_json, surcharge_type_value, amount, gst_rate, status, effective_from, created_at, updated_at)
       VALUES (?, ?, CAST(? AS JSON), ?, ?, ?, 1, NOW(), NOW(), NOW())`, body.surcharge_type, body.label, JSON.stringify(body.config_json), body.surcharge_type_value ?? 'fixed', body.amount, body.gst_rate ?? 18);
        return { ok: true };
    }
    async updateSurcharge(id, body) {
        if (this.useMongo()) {
            const set = {};
            if (body.label !== undefined)
                set.label = body.label;
            if (body.config_json !== undefined)
                set.config_json = body.config_json;
            if (body.surcharge_type_value !== undefined)
                set.surcharge_type_value = body.surcharge_type_value;
            if (body.amount !== undefined)
                set.amount = body.amount;
            if (body.gst_rate !== undefined)
                set.gst_rate = body.gst_rate;
            if (body.status !== undefined)
                set.status = body.status ? 1 : 0;
            if (!Object.keys(set).length)
                throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'no fields' }] });
            set.updated_at = new Date();
            await this.mongo.updateOne('user_delivery_surcharges', { mysql_id: Number(id) }, set);
            return { ok: true, id };
        }
        const updates = [];
        const values = [];
        if (body.label !== undefined) {
            updates.push('label = ?');
            values.push(body.label);
        }
        if (body.config_json !== undefined) {
            updates.push('config_json = CAST(? AS JSON)');
            values.push(JSON.stringify(body.config_json));
        }
        if (body.surcharge_type_value !== undefined) {
            updates.push('surcharge_type_value = ?');
            values.push(body.surcharge_type_value);
        }
        if (body.amount !== undefined) {
            updates.push('amount = ?');
            values.push(body.amount);
        }
        if (body.gst_rate !== undefined) {
            updates.push('gst_rate = ?');
            values.push(body.gst_rate);
        }
        if (body.status !== undefined) {
            updates.push('status = ?');
            values.push(body.status ? 1 : 0);
        }
        if (!updates.length)
            throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'no fields' }] });
        updates.push('updated_at = NOW()');
        values.push(id);
        await this.prisma.$executeRawUnsafe(`UPDATE user_delivery_surcharges SET ${updates.join(', ')} WHERE id = ?`, ...values);
        return { ok: true, id };
    }
    async deleteSurcharge(id) {
        if (this.useMongo()) {
            await this.mongo.deleteOne('user_delivery_surcharges', { mysql_id: Number(id) });
            return { ok: true, id };
        }
        await this.prisma.$executeRawUnsafe('DELETE FROM user_delivery_surcharges WHERE id = ?', id);
        return { ok: true, id };
    }
    async getFreeDelivery() {
        if (this.useMongo()) {
            const docs = await this.mongo.findMany('free_delivery_settings', {}, { sort: { mysql_id: 1 }, limit: 1 });
            const r = docs[0];
            if (!r)
                return { id: 0, min_order_value: 0, status: false };
            return { id: Number(r.mysql_id), min_order_value: Number(r.min_order_value), status: !!r.status };
        }
        const rows = await this.prisma.$queryRawUnsafe(`SELECT id, min_order_value, status FROM free_delivery_settings ORDER BY id ASC LIMIT 1`);
        const r = rows[0];
        if (!r)
            return { id: 0, min_order_value: 0, status: false };
        return { id: Number(r.id), min_order_value: Number(r.min_order_value), status: !!r.status };
    }
    async updateFreeDelivery(body) {
        if (this.useMongo()) {
            const set = {};
            if (body.min_order_value !== undefined)
                set.min_order_value = body.min_order_value;
            if (body.status !== undefined)
                set.status = body.status ? 1 : 0;
            if (!Object.keys(set).length)
                throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'no fields' }] });
            set.updated_at = new Date();
            const top = await this.mongo.findMany('free_delivery_settings', {}, { sort: { mysql_id: 1 }, limit: 1 });
            if (top[0]) {
                await this.mongo.updateOne('free_delivery_settings', { mysql_id: Number(top[0].mysql_id) }, set);
            }
            return { ok: true };
        }
        const updates = [];
        const values = [];
        if (body.min_order_value !== undefined) {
            updates.push('min_order_value = ?');
            values.push(body.min_order_value);
        }
        if (body.status !== undefined) {
            updates.push('status = ?');
            values.push(body.status ? 1 : 0);
        }
        if (!updates.length)
            throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'no fields' }] });
        updates.push('updated_at = NOW()');
        await this.prisma.$executeRawUnsafe(`UPDATE free_delivery_settings SET ${updates.join(', ')} WHERE id = (SELECT id FROM (SELECT id FROM free_delivery_settings ORDER BY id ASC LIMIT 1) AS t)`, ...values);
        return { ok: true };
    }
    async getSurgeGrid() {
        if (this.useMongo()) {
            const docs = await this.mongo.findMany('surge_pricing_grid', {}, { sort: { day_of_week: 1, hour_of_day: 1 } });
            return docs.map((r) => ({
                day_of_week: Number(r.day_of_week),
                hour_of_day: Number(r.hour_of_day),
                multiplier: Number(r.multiplier),
                status: !!r.status,
            }));
        }
        const rows = await this.prisma.$queryRawUnsafe(`SELECT day_of_week, hour_of_day, multiplier, status FROM surge_pricing_grid ORDER BY day_of_week, hour_of_day`);
        return rows.map((r) => ({ day_of_week: Number(r.day_of_week), hour_of_day: Number(r.hour_of_day), multiplier: Number(r.multiplier), status: !!r.status }));
    }
    async updateSurgeCell(body) {
        if (typeof body.day_of_week !== 'number' || typeof body.hour_of_day !== 'number' || typeof body.multiplier !== 'number') {
            throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'day_of_week/hour_of_day/multiplier required' }] });
        }
        if (body.day_of_week < 0 || body.day_of_week > 6 || body.hour_of_day < 0 || body.hour_of_day > 23) {
            throw new common_1.BadRequestException({ errors: [{ code: 'range', message: 'day_of_week 0..6, hour_of_day 0..23' }] });
        }
        if (this.useMongo()) {
            await this.mongo.updateOne('surge_pricing_grid', { day_of_week: body.day_of_week, hour_of_day: body.hour_of_day }, {
                multiplier: body.multiplier,
                status: body.status === false ? 0 : 1,
                updated_at: new Date(),
            });
            return { ok: true };
        }
        await this.prisma.$executeRawUnsafe(`UPDATE surge_pricing_grid SET multiplier = ?, status = ?, updated_at = NOW()
       WHERE day_of_week = ? AND hour_of_day = ?`, body.multiplier, body.status === false ? 0 : 1, body.day_of_week, body.hour_of_day);
        return { ok: true };
    }
    async calculate(input) {
        if (typeof input.distance_km !== 'number' || input.distance_km < 0) {
            throw new common_1.BadRequestException({ errors: [{ code: 'distance_km', message: 'distance_km >= 0 required' }] });
        }
        if (typeof input.order_value !== 'number' || input.order_value < 0) {
            throw new common_1.BadRequestException({ errors: [{ code: 'order_value', message: 'order_value >= 0 required' }] });
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
        const grid = await this.getSurgeGrid();
        const surgeCell = grid.find((g) => g.day_of_week === dow && g.hour_of_day === hour && g.status);
        const surgeMul = surgeCell ? surgeCell.multiplier : 1;
        const surcharges = await this.listSurcharges();
        const applicable = [];
        for (const s of surcharges) {
            if (!s.status)
                continue;
            if (s.surcharge_type === 'surge')
                continue;
            const cfg = s.config_json;
            let match = false;
            if (s.surcharge_type === 'weekend' && Array.isArray(cfg.days)) {
                match = cfg.days.includes(dow);
            }
            else if (s.surcharge_type === 'late_night' && typeof cfg.start === 'string' && typeof cfg.end === 'string') {
                const startH = parseInt(cfg.start.split(':')[0], 10);
                const endH = parseInt(cfg.end.split(':')[0], 10);
                match = startH <= endH ? hour >= startH && hour < endH : hour >= startH || hour < endH;
            }
            else if (s.surcharge_type === 'festival' && Array.isArray(cfg.dates)) {
                match = cfg.dates.includes(isoDate);
            }
            if (!match)
                continue;
            let amount = 0;
            if (s.surcharge_type_value === 'percentage')
                amount = +(baseTotal * s.amount / 100).toFixed(2);
            else
                amount = s.amount;
            const gstAmount = +(amount * s.gst_rate / 100).toFixed(2);
            applicable.push({ id: s.id, type: s.surcharge_type, label: s.label, amount, gst_amount: gstAmount });
        }
        const surchargeTotal = applicable.reduce((a, b) => a + b.amount, 0);
        const surchargeGst = applicable.reduce((a, b) => a + b.gst_amount, 0);
        const baseAfterSurge = +(baseTotal * surgeMul).toFixed(2);
        const baseGstAmount = +(baseAfterSurge * slab.gst_rate / 100).toFixed(2);
        const subtotal = +(baseAfterSurge + surchargeTotal).toFixed(2);
        const gstTotal = +(baseGstAmount + surchargeGst).toFixed(2);
        const total = +(subtotal + gstTotal).toFixed(2);
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
};
exports.UserDeliveryChargesService = UserDeliveryChargesService;
exports.UserDeliveryChargesService = UserDeliveryChargesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        mongo_data_service_1.MongoDataService])
], UserDeliveryChargesService);
//# sourceMappingURL=user-delivery-charges.service.js.map