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
exports.DmChargesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const mongo_data_service_1 = require("../mongo/mongo-data.service");
let DmChargesService = class DmChargesService {
    prisma;
    mongo;
    constructor(prisma, mongo) {
        this.prisma = prisma;
        this.mongo = mongo;
    }
    useMongo() {
        const v = (process.env.USE_MONGO_ENHANCEMENTS ?? '').toLowerCase();
        return v === '1' || v === 'true' || v === 'yes';
    }
    async listSlabs() {
        if (this.useMongo()) {
            const docs = await this.mongo.findMany('dm_distance_slabs', {}, { sort: { min_km: 1 } });
            return docs.map((r) => ({
                id: Number(r.mysql_id),
                min_km: Number(r.min_km),
                max_km: Number(r.max_km),
                base_charge: Number(r.base_charge),
                extra_per_km: Number(r.extra_per_km),
                status: !!r.status,
                effective_from: r.effective_from ?? null,
            }));
        }
        const rows = await this.prisma.$queryRawUnsafe(`SELECT id, min_km, max_km, base_charge, extra_per_km, status, effective_from
       FROM dm_distance_slabs ORDER BY min_km ASC`);
        return rows.map((r) => ({
            ...r,
            id: Number(r.id),
            min_km: Number(r.min_km),
            max_km: Number(r.max_km),
            base_charge: Number(r.base_charge),
            extra_per_km: Number(r.extra_per_km),
            status: !!r.status,
        }));
    }
    async createSlab(body) {
        if (typeof body.min_km !== 'number' || typeof body.max_km !== 'number') {
            throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'min_km/max_km required' }] });
        }
        if (body.max_km <= body.min_km)
            throw new common_1.BadRequestException({ errors: [{ code: 'range', message: 'max_km must be > min_km' }] });
        if (this.useMongo()) {
            const nextId = await this.mongo.nextMysqlId('dm_distance_slabs');
            const now = new Date();
            await this.mongo.insertOne('dm_distance_slabs', {
                mysql_id: nextId,
                min_km: body.min_km,
                max_km: body.max_km,
                base_charge: body.base_charge,
                extra_per_km: body.extra_per_km ?? 0,
                status: 1,
                effective_from: body.effective_from ? new Date(body.effective_from) : now,
                created_at: now,
                updated_at: now,
            });
            return { ok: true };
        }
        await this.prisma.$executeRawUnsafe(`INSERT INTO dm_distance_slabs (min_km, max_km, base_charge, extra_per_km, status, effective_from, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, NOW(), NOW())`, body.min_km, body.max_km, body.base_charge, body.extra_per_km ?? 0, body.effective_from ?? new Date());
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
            if (body.status !== undefined)
                set.status = body.status ? 1 : 0;
            if (!Object.keys(set).length)
                throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'no fields' }] });
            set.updated_at = new Date();
            await this.mongo.updateOne('dm_distance_slabs', { mysql_id: Number(id) }, set);
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
        if (body.status !== undefined) {
            updates.push('status = ?');
            values.push(body.status ? 1 : 0);
        }
        if (!updates.length)
            throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'no fields' }] });
        updates.push('updated_at = NOW()');
        values.push(id);
        await this.prisma.$executeRawUnsafe(`UPDATE dm_distance_slabs SET ${updates.join(', ')} WHERE id = ?`, ...values);
        return { ok: true, id };
    }
    async deleteSlab(id) {
        if (this.useMongo()) {
            await this.mongo.deleteOne('dm_distance_slabs', { mysql_id: Number(id) });
            return { ok: true, id };
        }
        await this.prisma.$executeRawUnsafe('DELETE FROM dm_distance_slabs WHERE id = ?', id);
        return { ok: true, id };
    }
    async listSurcharges() {
        if (this.useMongo()) {
            const docs = await this.mongo.findMany('dm_surcharges', {}, { sort: { surcharge_type: 1, mysql_id: 1 } });
            return docs.map((r) => ({
                id: Number(r.mysql_id),
                surcharge_type: r.surcharge_type,
                label: r.label,
                config_json: typeof r.config_json === 'string' ? JSON.parse(r.config_json) : r.config_json,
                surcharge_type_value: r.surcharge_type_value,
                amount: Number(r.amount),
                status: !!r.status,
                effective_from: r.effective_from ?? null,
            }));
        }
        const rows = await this.prisma.$queryRawUnsafe(`SELECT id, surcharge_type, label, config_json, surcharge_type_value, amount, status, effective_from
       FROM dm_surcharges ORDER BY surcharge_type ASC, id ASC`);
        return rows.map((r) => ({
            ...r,
            id: Number(r.id),
            amount: Number(r.amount),
            status: !!r.status,
            config_json: typeof r.config_json === 'string' ? JSON.parse(r.config_json) : r.config_json,
        }));
    }
    async createSurcharge(body) {
        if (!body.surcharge_type || !body.label || body.config_json === undefined || body.config_json === null) {
            throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'type/label/config_json required' }] });
        }
        if (this.useMongo()) {
            const nextId = await this.mongo.nextMysqlId('dm_surcharges');
            const now = new Date();
            await this.mongo.insertOne('dm_surcharges', {
                mysql_id: nextId,
                surcharge_type: body.surcharge_type,
                label: body.label,
                config_json: body.config_json,
                surcharge_type_value: body.surcharge_type_value ?? 'fixed',
                amount: body.amount,
                status: 1,
                effective_from: body.effective_from ? new Date(body.effective_from) : now,
                created_at: now,
                updated_at: now,
            });
            return { ok: true };
        }
        await this.prisma.$executeRawUnsafe(`INSERT INTO dm_surcharges (surcharge_type, label, config_json, surcharge_type_value, amount, status, effective_from, created_at, updated_at)
       VALUES (?, ?, CAST(? AS JSON), ?, ?, 1, ?, NOW(), NOW())`, body.surcharge_type, body.label, JSON.stringify(body.config_json), body.surcharge_type_value ?? 'fixed', body.amount, body.effective_from ?? new Date());
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
            if (body.status !== undefined)
                set.status = body.status ? 1 : 0;
            if (!Object.keys(set).length)
                throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'no fields' }] });
            set.updated_at = new Date();
            await this.mongo.updateOne('dm_surcharges', { mysql_id: Number(id) }, set);
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
        if (body.status !== undefined) {
            updates.push('status = ?');
            values.push(body.status ? 1 : 0);
        }
        if (!updates.length)
            throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'no fields' }] });
        updates.push('updated_at = NOW()');
        values.push(id);
        await this.prisma.$executeRawUnsafe(`UPDATE dm_surcharges SET ${updates.join(', ')} WHERE id = ?`, ...values);
        return { ok: true, id };
    }
    async deleteSurcharge(id) {
        if (this.useMongo()) {
            await this.mongo.deleteOne('dm_surcharges', { mysql_id: Number(id) });
            return { ok: true, id };
        }
        await this.prisma.$executeRawUnsafe('DELETE FROM dm_surcharges WHERE id = ?', id);
        return { ok: true, id };
    }
    async calculate(input) {
        if (typeof input.distance_km !== 'number' || input.distance_km < 0) {
            throw new common_1.BadRequestException({ errors: [{ code: 'distance_km', message: 'distance_km >= 0 required' }] });
        }
        const slabs = await this.listSlabs();
        const slab = slabs.find((s) => s.status && input.distance_km >= s.min_km && input.distance_km <= s.max_km);
        if (!slab) {
            return {
                distance_km: input.distance_km,
                matched_slab: null,
                base_charge: 0, extra_charge: 0, surcharges: [], total: 0,
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
        const surcharges = await this.listSurcharges();
        const applicable = [];
        for (const s of surcharges) {
            if (!s.status)
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
            const amount = s.surcharge_type_value === 'percentage' ? +(baseTotal * s.amount / 100).toFixed(2) : s.amount;
            applicable.push({ id: s.id, type: s.surcharge_type, label: s.label, amount });
        }
        const surchargeTotal = applicable.reduce((a, b) => a + b.amount, 0);
        return {
            distance_km: input.distance_km,
            matched_slab: { id: slab.id, min_km: slab.min_km, max_km: slab.max_km, base_charge: slab.base_charge, extra_per_km: slab.extra_per_km },
            base_charge: slab.base_charge,
            extra_charge: extraCharge,
            surcharges: applicable,
            total: +(baseTotal + surchargeTotal).toFixed(2),
            notes: 'Per BRD §5.4 no GST is applied to delivery-partner-side charges.',
        };
    }
};
exports.DmChargesService = DmChargesService;
exports.DmChargesService = DmChargesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        mongo_data_service_1.MongoDataService])
], DmChargesService);
//# sourceMappingURL=dm-charges.service.js.map