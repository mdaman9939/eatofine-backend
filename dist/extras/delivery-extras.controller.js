"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryExtrasController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const auth_guard_1 = require("../auth/auth.guard");
const prisma_service_1 = require("../prisma/prisma.service");
const mongo_data_service_1 = require("../mongo/mongo-data.service");
const storage_url_1 = require("../common/storage-url");
const messaging_helper_1 = require("./messaging.helper");
const image_compress_1 = require("../common/image-compress");
let DeliveryExtrasController = class DeliveryExtrasController {
    prisma;
    mongo;
    constructor(prisma, mongo) {
        this.prisma = prisma;
        this.mongo = mongo;
    }
    useMongo() {
        const v = (process.env.USE_MONGO_EXTRAS ?? '1').toLowerCase();
        return v === '1' || v === 'true' || v === 'yes';
    }
    shapeDmOrder(r, detailsCount, restaurant, user) {
        const created = r.created_at;
        const updated = r.updated_at;
        const rest = restaurant ?? null;
        const restLogo = rest ? rest.logo : null;
        const u = user ?? null;
        return {
            ...r,
            id: Number(r.mysql_id),
            user_id: r.mysql_user_id !== undefined && r.mysql_user_id !== null
                ? Number(r.mysql_user_id)
                : (r.user_id !== undefined && r.user_id !== null ? Number(r.user_id) : null),
            restaurant_id: Number(r.mysql_restaurant_id ?? r.restaurant_id ?? 0),
            delivery_man_id: r.mysql_delivery_man_id !== undefined && r.mysql_delivery_man_id !== null
                ? Number(r.mysql_delivery_man_id)
                : (r.delivery_man_id !== undefined && r.delivery_man_id !== null ? Number(r.delivery_man_id) : null),
            order_amount: r.order_amount !== undefined && r.order_amount !== null ? Number(r.order_amount) : 0,
            details_count: detailsCount,
            order_status: r.order_status ?? 'pending',
            order_type: r.order_type ?? 'delivery',
            payment_method: r.payment_method ?? 'cash_on_delivery',
            payment_status: r.payment_status ?? 'unpaid',
            delivery_address: r.delivery_address ?? null,
            created_at: created ? new Date(created).toISOString() : new Date().toISOString(),
            updated_at: updated ? new Date(updated).toISOString() : new Date().toISOString(),
            restaurant_name: rest ? (rest.name ?? null) : null,
            restaurant_address: rest ? (rest.address ?? null) : null,
            restaurant_phone: rest ? (rest.phone ?? null) : null,
            restaurant_lat: rest && rest.latitude != null ? String(rest.latitude) : null,
            restaurant_lng: rest && rest.longitude != null ? String(rest.longitude) : null,
            restaurant_logo_full_url: (0, storage_url_1.storageFullUrl)('restaurant', restLogo ?? null),
            restaurant_delivery_time: rest ? (rest.delivery_time ?? '30-40') : '30-40',
            restaurant_model: rest ? (rest.restaurant_model ?? null) : null,
            customer: u
                ? {
                    id: Number(u.mysql_id),
                    f_name: u.f_name ?? null,
                    l_name: u.l_name ?? null,
                    phone: u.phone ?? null,
                    email: u.email ?? null,
                    image_full_url: (0, storage_url_1.storageFullUrl)('profile', u.image ?? null),
                }
                : null,
        };
    }
    async dmUserMap(orders) {
        const ids = Array.from(new Set(orders.map((o) => Number(o.mysql_user_id ?? o.user_id ?? 0)).filter((n) => n > 0)));
        if (ids.length === 0)
            return new Map();
        const rows = await this.mongo.findMany('users', { mysql_id: { $in: ids } });
        return new Map(rows.map((u) => [Number(u.mysql_id), u]));
    }
    async dmRestaurantMap(orders) {
        const ids = Array.from(new Set(orders.map((o) => Number(o.mysql_restaurant_id ?? o.restaurant_id ?? 0)).filter((n) => n > 0)));
        if (ids.length === 0)
            return new Map();
        const rows = await this.mongo.findMany('restaurants', { mysql_id: { $in: ids } });
        return new Map(rows.map((r) => [Number(r.mysql_id), r]));
    }
    async dmDetailsCountMap(orderIds) {
        if (orderIds.length === 0)
            return new Map();
        const rows = await this.mongo.aggregate('order_details', [
            { $match: { order_id: { $in: orderIds } } },
            { $group: { _id: '$order_id', count: { $sum: 1 } } },
        ]);
        return new Map(rows.map((r) => [Number(r._id), r.count]));
    }
    async shapeDmOrderList(rows) {
        const counts = await this.dmDetailsCountMap(rows.map((r) => Number(r.mysql_id)));
        const restMap = await this.dmRestaurantMap(rows);
        const userMap = await this.dmUserMap(rows);
        return rows.map((r) => this.shapeDmOrder(r, counts.get(Number(r.mysql_id)) ?? 1, restMap.get(Number(r.mysql_restaurant_id ?? r.restaurant_id ?? 0)), userMap.get(Number(r.mysql_user_id ?? r.user_id ?? 0))));
    }
    async dmOrderCount(actorId) {
        const rows = await this.mongo.aggregate('orders', [
            { $match: { mysql_delivery_man_id: actorId } },
            { $group: { _id: '$order_status', count: { $sum: 1 } } },
        ]);
        const by = {};
        let all = 0;
        for (const r of rows) {
            by[String(r._id)] = r.count;
            all += r.count;
        }
        return {
            all,
            pending: by.pending ?? 0,
            confirmed: by.confirmed ?? 0,
            accepted: by.accepted ?? 0,
            processing: by.processing ?? 0,
            handover: by.handover ?? 0,
            picked_up: by.picked_up ?? 0,
            delivered: by.delivered ?? 0,
            canceled: by.canceled ?? 0,
            refund_requested: by.refund_requested ?? 0,
            refunded: by.refunded ?? 0,
            refund_request_canceled: by.refund_request_canceled ?? 0,
            failed: by.failed ?? 0,
        };
    }
    async profile(req) {
        const actorId = Number(req.actor.id);
        if (this.useMongo()) {
            const d = await this.mongo.findByMysqlId('delivery_men', actorId);
            if (!d)
                return {};
            const allOrders = await this.mongo.findMany('orders', { mysql_delivery_man_id: actorId });
            const now = Date.now();
            const dayMs = 86_400_000;
            let today = 0, week = 0;
            let todayEarn = 0, weekEarn = 0, monthEarn = 0, allEarn = 0;
            for (const o of allOrders) {
                const ts = o.created_at ? new Date(o.created_at).getTime() : 0;
                if (!Number.isFinite(ts) || ts === 0)
                    continue;
                const age = now - ts;
                const delivered = o.order_status === 'delivered';
                const dmEarn = Number(o.delivery_charge ?? 0) + Number(o.dm_tips ?? 0);
                if (delivered)
                    allEarn += dmEarn;
                if (age <= dayMs) {
                    today++;
                    if (delivered)
                        todayEarn += dmEarn;
                }
                if (age <= 7 * dayMs) {
                    week++;
                    if (delivered)
                        weekEarn += dmEarn;
                }
                if (age <= 30 * dayMs) {
                    if (delivered)
                        monthEarn += dmEarn;
                }
            }
            const wallet = await this.mongo.findOne('delivery_man_wallets', { $or: [{ delivery_man_id: actorId }, { mysql_delivery_man_id: actorId }] });
            return {
                id: Number(d.mysql_id),
                f_name: d.f_name ?? null,
                l_name: d.l_name ?? null,
                email: d.email ?? null,
                phone: d.phone ?? null,
                image: d.image ?? null,
                image_full_url: (0, storage_url_1.storageFullUrl)('delivery-man', d.image ?? null),
                identity_image: (0, storage_url_1.storageFullUrl)('delivery-man', d.image ?? null),
                status: d.status ?? null,
                active: Number(d.active ?? 0) ? 1 : 0,
                application_status: d.application_status ?? null,
                zone_id: d.mysql_zone_id !== undefined && d.mysql_zone_id !== null
                    ? Number(d.mysql_zone_id)
                    : (d.zone_id !== undefined && d.zone_id !== null ? Number(d.zone_id) : null),
                order_count: allOrders.length,
                todays_order_count: today,
                this_week_order_count: week,
                todays_earning: todayEarn,
                this_week_earning: weekEarn,
                this_month_earning: monthEarn,
                all_time_earning: allEarn,
                balance: Number(wallet?.balance ?? 0),
                total_earning: Number(wallet?.total_earning ?? allEarn),
                collected_cash: Number(wallet?.collected_cash ?? 0),
                total_withdrawn: Number(wallet?.total_withdrawn ?? 0),
                pending_withdraw: Number(wallet?.pending_withdraw ?? 0),
            };
        }
        const d = await this.prisma.delivery_men.findUnique({ where: { id: req.actor.id } });
        if (!d)
            return {};
        return {
            id: Number(d.id),
            f_name: d.f_name,
            l_name: d.l_name,
            email: d.email,
            phone: d.phone,
            image: d.image,
            status: d.status,
            application_status: d.application_status,
            zone_id: d.zone_id ? Number(d.zone_id) : null,
            order_count: 0,
            todays_order_count: 0,
            this_week_order_count: 0,
            todays_earning: 0,
            this_week_earning: 0,
            this_month_earning: 0,
            all_time_earning: 0,
            balance: 0,
            total_earning: 0,
            collected_cash: 0,
            total_withdrawn: 0,
            pending_withdraw: 0,
        };
    }
    async saveImage(file, folder) {
        if (!file || !file.buffer || file.buffer.length === 0)
            return null;
        let data = file.buffer;
        let ext = path.extname(file.originalname || '').toLowerCase() || '.png';
        let contentType = file.mimetype || 'image/png';
        if (/^image\//i.test(contentType) && !/svg/i.test(contentType)) {
            try {
                const c = await (0, image_compress_1.compressImage)(file.buffer);
                if (c) {
                    data = c.buffer;
                    ext = c.ext;
                    contentType = c.contentType;
                }
            }
            catch { }
        }
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        try {
            const root = process.env.STORAGE_ROOT ?? path.resolve(__dirname, '../../storage/app/public');
            const dir = path.join(root, folder);
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, filename), data);
        }
        catch { }
        if (data.length < 15 * 1024 * 1024) {
            await this.mongo.insertOne('uploads', { path: `${folder}/${filename}`, content_type: contentType, data, size: data.length, created_at: new Date() }).catch(() => undefined);
        }
        return filename;
    }
    async updateProfile(req, body = {}, files = {}) {
        const b = body ?? {};
        const data = {};
        if (b.f_name !== undefined)
            data.f_name = String(b.f_name);
        if (b.l_name !== undefined)
            data.l_name = String(b.l_name);
        if (b.email !== undefined)
            data.email = String(b.email);
        if (typeof b.password === 'string' && b.password.length > 1) {
            const bcrypt = await import('bcrypt');
            data.password = (await bcrypt.hash(b.password, 10)).replace(/^\$2b\$/, '$2y$');
        }
        const imageName = await this.saveImage(files?.image?.[0], 'delivery-man');
        if (imageName)
            data.image = imageName;
        if (Object.keys(data).length === 0)
            return { message: 'nothing to update' };
        data.updated_at = new Date();
        if (this.useMongo()) {
            await this.mongo.updateOne('delivery_men', { mysql_id: Number(req.actor.id) }, data);
            return { message: 'Profile updated', image: imageName ?? undefined };
        }
        await this.prisma.delivery_men.update({ where: { id: req.actor.id }, data: data });
        return { message: 'Profile updated' };
    }
    async toggleActive(req, body = {}) {
        if (this.useMongo()) {
            const actorId = Number(req.actor.id);
            const dm = await this.mongo.findByMysqlId('delivery_men', actorId);
            if (dm) {
                const raw = body.active ?? body.status;
                const next = raw !== undefined ? (Number(raw) ? 1 : 0) : (Number(dm.active ?? 0) ? 0 : 1);
                await this.mongo.updateOne('delivery_men', { mysql_id: actorId }, { active: next, updated_at: new Date() });
                return { message: 'updated', active: next };
            }
        }
        return { message: 'updated' };
    }
    fcmToken() { return { message: 'token-updated' }; }
    remove() { return { message: 'Not available in demo' }; }
    async allOrders(req, offsetQ, limitQ, status) {
        const actorId = Number(req.actor.id);
        const paginated = offsetQ !== undefined || limitQ !== undefined || status !== undefined;
        if (this.useMongo()) {
            const base = { mysql_delivery_man_id: actorId };
            if (!paginated) {
                const rows = await this.mongo.findMany('orders', base, { sort: { mysql_id: -1 }, limit: 50 });
                return this.shapeDmOrderList(rows);
            }
            const limit = parseInt(limitQ ?? '10', 10) || 10;
            const offset = parseInt(offsetQ ?? '1', 10) || 1;
            const filter = status && status !== 'all' ? { ...base, order_status: status } : base;
            const total = await this.mongo.count('orders', filter);
            const rows = await this.mongo.findMany('orders', filter, {
                sort: { mysql_id: -1 }, limit, skip: Math.max(0, (offset - 1) * limit),
            });
            return { total_size: total, limit, offset, order_count: await this.dmOrderCount(actorId), orders: await this.shapeDmOrderList(rows) };
        }
        const rows = await this.prisma.orders.findMany({ where: { delivery_man_id: req.actor.id }, orderBy: { id: 'desc' }, take: 50 });
        const mapped = rows.map((r) => ({ ...r, id: Number(r.id), user_id: r.user_id ? Number(r.user_id) : null, restaurant_id: Number(r.restaurant_id), order_amount: Number(r.order_amount) }));
        return paginated ? { total_size: mapped.length, limit: 10, offset: 1, order_count: { all: mapped.length }, orders: mapped } : mapped;
    }
    async currentOrders(req, status) {
        const actorId = Number(req.actor.id);
        if (this.useMongo()) {
            const ongoing = ['handover', 'picked_up', 'confirmed', 'processing', 'accepted', 'pending', 'cooking'];
            const filter = { mysql_delivery_man_id: actorId, order_status: { $in: ongoing } };
            if (status && status !== 'all')
                filter.order_status = status;
            const rows = await this.mongo.findMany('orders', filter, { sort: { mysql_id: -1 } });
            return {
                total_size: rows.length,
                limit: rows.length,
                offset: 1,
                order_count: await this.dmOrderCount(actorId),
                orders: await this.shapeDmOrderList(rows),
            };
        }
        return { total_size: 0, limit: 0, offset: 1, order_count: { all: 0 }, orders: [] };
    }
    async latestOrders(req) {
        const actorId = Number(req.actor.id);
        if (this.useMongo()) {
            const dm = await this.mongo.findByMysqlId('delivery_men', actorId);
            const zoneId = dm?.mysql_zone_id ?? dm?.zone_id;
            const rows = await this.mongo.findMany('orders', {
                mysql_delivery_man_id: { $in: [null, 0] },
                order_status: 'handover',
                ...(zoneId ? { $or: [{ mysql_zone_id: Number(zoneId) }, { zone_id: Number(zoneId) }] } : {}),
            }, { sort: { mysql_id: -1 }, limit: 20 });
            return { orders: await this.shapeDmOrderList(rows), total_size: rows.length };
        }
        return { orders: [], total_size: 0 };
    }
    async order(idStr) {
        const id = parseInt(idStr ?? '', 10);
        if (!Number.isFinite(id))
            return null;
        if (this.useMongo()) {
            const o = await this.mongo.findByMysqlId('orders', id);
            if (!o)
                return null;
            const counts = await this.dmDetailsCountMap([id]);
            const restId = Number(o.mysql_restaurant_id ?? o.restaurant_id ?? 0);
            const rest = restId > 0 ? await this.mongo.findByMysqlId('restaurants', restId) : null;
            const userId = Number(o.mysql_user_id ?? o.user_id ?? 0);
            const user = userId > 0 ? await this.mongo.findByMysqlId('users', userId) : null;
            return this.shapeDmOrder(o, counts.get(id) ?? 1, rest, user);
        }
        const o = await this.prisma.orders.findUnique({ where: { id: BigInt(id) } });
        return o ? { ...o, id: Number(o.id), user_id: o.user_id ? Number(o.user_id) : null, restaurant_id: Number(o.restaurant_id), order_amount: Number(o.order_amount) } : null;
    }
    async orderDetails(idStr) {
        const id = parseInt(idStr ?? '', 10);
        if (!Number.isFinite(id))
            return [];
        if (this.useMongo()) {
            const items = await this.mongo.findMany('order_details', { order_id: id }, { sort: { mysql_id: 1 } });
            const foodIds = Array.from(new Set(items.map((it) => Number(it.food_id)).filter((n) => n > 0)));
            const foods = foodIds.length
                ? await this.mongo.findMany('foods', { mysql_id: { $in: foodIds } })
                : [];
            const foodMap = new Map(foods.map((f) => [Number(f.mysql_id), f]));
            return items.map((it) => {
                let stored = {};
                const raw = it.food_details;
                if (typeof raw === 'string') {
                    try {
                        stored = JSON.parse(raw);
                    }
                    catch { }
                }
                else if (raw && typeof raw === 'object')
                    stored = raw;
                const food = foodMap.get(Number(it.food_id));
                const name = food?.name ?? stored.name ?? `Food #${it.food_id}`;
                const image = food?.image ?? stored.image ?? null;
                const imageUrl = (0, storage_url_1.storageFullUrl)('product', image);
                return {
                    id: Number(it.mysql_id),
                    order_id: id,
                    food_id: it.food_id ?? null,
                    item_campaign_id: it.item_campaign_id ?? null,
                    price: Number(it.price ?? 0),
                    quantity: Number(it.quantity ?? 1),
                    tax_amount: Number(it.tax_amount ?? 0),
                    discount_on_food: Number(it.discount_on_food ?? 0),
                    add_ons: it.add_ons ?? [],
                    total_add_on_price: Number(it.total_add_on_price ?? 0),
                    variation: it.variation ?? [],
                    variant: it.variant ?? null,
                    food_details: {
                        id: it.food_id ?? null,
                        name,
                        image,
                        image_full_url: imageUrl,
                        price: Number(it.price ?? 0),
                        quantity: Number(it.quantity ?? 1),
                    },
                    food: { id: it.food_id ?? null, name, image, image_full_url: imageUrl },
                };
            });
        }
        return [];
    }
    async acceptOrder(req, body = {}) {
        const orderId = Number(body.order_id ?? body.id ?? 0);
        if (this.useMongo() && orderId > 0) {
            const o = await this.mongo.findByMysqlId('orders', orderId);
            if (!o)
                return { errors: [{ code: 'order', message: 'Order not found' }] };
            const assigned = Number(o.mysql_delivery_man_id ?? o.delivery_man_id ?? 0);
            if (assigned > 0 && assigned !== Number(req.actor.id)) {
                return { errors: [{ code: 'order', message: 'This order has already been taken by another delivery man' }] };
            }
            await this.mongo.updateOne('orders', { mysql_id: orderId }, {
                mysql_delivery_man_id: Number(req.actor.id),
                delivery_man_id: Number(req.actor.id),
                updated_at: new Date(),
            });
            return { message: 'order accepted' };
        }
        return { message: 'order accepted' };
    }
    updatePayment() { return { message: 'updated' }; }
    sendOtp() { return { otp: '1234' }; }
    async recordLocation(req, body = {}) {
        const lat = body?.latitude;
        const lng = body?.longitude;
        if (this.useMongo() && lat != null && lng != null) {
            await this.mongo.updateOne('delivery_men', { mysql_id: Number(req.actor.id) }, {
                latitude: Number(lat),
                longitude: Number(lng),
                location: body?.location != null ? String(body.location) : null,
                location_updated_at: new Date(),
                updated_at: new Date(),
            }).catch(() => undefined);
        }
        return { ok: true };
    }
    lastLocation() { return { ok: true }; }
    async earningReport(req) {
        if (!this.useMongo())
            return { today: 0, this_week: 0, this_month: 0, all_time: 0 };
        const actorId = Number(req.actor.id);
        const rows = await this.mongo.findMany('orders', { mysql_delivery_man_id: actorId, order_status: 'delivered' });
        const now = Date.now(), dayMs = 86_400_000;
        let today = 0, week = 0, month = 0, all = 0;
        for (const o of rows) {
            const ts = o.created_at ? new Date(o.created_at).getTime() : 0;
            if (!Number.isFinite(ts) || ts === 0)
                continue;
            const earn = Number(o.delivery_charge ?? 0) + Number(o.dm_tips ?? 0);
            all += earn;
            const age = now - ts;
            if (age <= dayMs)
                today += earn;
            if (age <= 7 * dayMs)
                week += earn;
            if (age <= 30 * dayMs)
                month += earn;
        }
        return { today, this_week: week, this_month: month, all_time: all };
    }
    disbursementReport() { return { data: [], total: 0 }; }
    walletPayments() { return { data: [], total_size: 0 }; }
    collectedCash() { return { message: 'recorded' }; }
    walletAdjustment() { return { message: 'recorded' }; }
    async withdrawMethods() {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('withdrawal_methods', { $or: [{ is_active: 1 }, { is_active: true }] });
            return rows.map((r) => ({
                id: Number(r.mysql_id),
                method_name: r.method_name,
                method_fields: r.method_fields,
                is_default: r.is_default,
            }));
        }
        const rows = await this.prisma.withdrawal_methods.findMany({ where: { is_active: 1 } });
        return rows.map((r) => ({ id: Number(r.id), method_name: r.method_name, method_fields: r.method_fields, is_default: r.is_default }));
    }
    withdrawStore() { return { message: 'method added' }; }
    withdrawDefault() { return { message: 'default set' }; }
    withdrawDelete() { return { message: 'deleted' }; }
    getWithdrawMethods() { return this.withdrawMethods(); }
    async dmShift() {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('shifts', { status: true });
            return rows.map((r) => ({
                id: Number(r.mysql_id),
                name: r.name,
                start_time: r.start_time,
                end_time: r.end_time,
                is_full_day: r.is_full_day,
            }));
        }
        const rows = await this.prisma.shifts.findMany({ where: { status: true } });
        return rows.map((r) => ({ id: Number(r.id), name: r.name, start_time: r.start_time, end_time: r.end_time, is_full_day: r.is_full_day }));
    }
    dmTopic(req) {
        return { topic: `zone_${req.actor.id}_delivery_man` };
    }
    async submitReview(req, body = {}) {
        if (!this.useMongo())
            return { message: 'review submitted' };
        const dmId = Number(body.delivery_man_id ?? body.delivery_man ?? 0);
        const rating = Math.max(1, Math.min(5, Math.round(Number(body.rating ?? 0))));
        if (!dmId || !rating)
            return { errors: [{ code: 'input', message: 'delivery_man_id and rating are required' }] };
        const now = new Date();
        const nextId = await this.mongo.nextMysqlId('delivery_man_reviews');
        await this.mongo.insertOne('delivery_man_reviews', {
            mysql_id: nextId,
            delivery_man_id: dmId,
            mysql_delivery_man_id: dmId,
            user_id: Number(req.actor.id),
            mysql_user_id: Number(req.actor.id),
            order_id: body.order_id != null && body.order_id !== '' ? Number(body.order_id) : null,
            comment: body.comment ? String(body.comment) : null,
            rating,
            created_at: now,
            updated_at: now,
        });
        const agg = await this.mongo.aggregate('delivery_man_reviews', [
            { $match: { mysql_delivery_man_id: dmId } },
            { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
        ]).catch(() => []);
        const avg = agg[0]?.avg ?? rating;
        const count = agg[0]?.count ?? 1;
        await this.mongo.updateOne('delivery_men', { mysql_id: dmId }, { avg_rating: Math.round(avg * 10) / 10, rating_count: count, updated_at: now }).catch(() => undefined);
        return { message: 'review submitted' };
    }
    async notifications() {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('notifications', { status: true }, { sort: { mysql_id: -1 }, limit: 50 });
            return rows.map((r) => {
                const created = r.created_at ?? r.created_at_legacy ?? null;
                return {
                    id: Number(r.mysql_id),
                    title: r.title,
                    description: r.description,
                    image_full_url: (0, storage_url_1.storageFullUrl)('notification', r.image ?? null),
                    created_at: created,
                    updated_at: r.updated_at ?? created,
                };
            });
        }
        const rows = await this.prisma.notifications.findMany({ where: { status: true }, orderBy: { id: 'desc' }, take: 50 });
        return rows.map((r) => ({ id: Number(r.id), title: r.title, description: r.description, created_at: r.created_at, updated_at: r.updated_at ?? r.created_at }));
    }
    async messageList(req, type, offsetQ, limitQ) {
        if (!this.useMongo())
            return { conversation: [], total_size: 0, limit: 10, offset: 1 };
        const dmId = Number(req.actor.id);
        const limit = parseInt(limitQ ?? '10', 10) || 10;
        const offset = parseInt(offsetQ ?? '1', 10) || 1;
        const wantVendor = type === 'vendor' || String(type ?? '').toLowerCase().includes('rest');
        const cpSlot = wantVendor ? 'vendor_id' : 'user_id';
        const cpType = wantVendor ? 'vendor' : 'user';
        const rows = await this.mongo.findMany('conversations', { delivery_man_id: dmId, [cpSlot]: { $ne: null } }, { sort: { last_message_at: -1 }, limit: 200 });
        const myProfile = await (0, messaging_helper_1.participantProfile)(this.mongo, 'delivery_man_id', dmId, storage_url_1.storageFullUrl);
        const paged = rows.slice((offset - 1) * limit, offset * limit);
        const conversation = await Promise.all(paged.map(async (c) => {
            const cpId = Number(c[cpSlot] ?? 0);
            const receiver = await (0, messaging_helper_1.participantProfile)(this.mongo, cpSlot, cpId, storage_url_1.storageFullUrl);
            return {
                id: Number(c.mysql_id),
                sender_id: dmId, sender_type: 'delivery_man', receiver_id: cpId, receiver_type: cpType,
                unread_message_count: Number(c.unread ?? 0), last_message_id: null,
                last_message_time: c.last_message_at ?? c.created_at ?? null,
                created_at: c.created_at ?? null, updated_at: c.last_message_at ?? null,
                sender: myProfile, receiver,
                last_message: { id: null, conversation_id: Number(c.mysql_id), sender_id: dmId, message: c.last_message ?? '', is_seen: 1, files: [] },
            };
        }));
        return { conversation, total_size: rows.length, limit, offset };
    }
    async messageDetails(req, convId, userId, vendorId) {
        if (!this.useMongo())
            return { messages: [] };
        const dmId = Number(req.actor.id);
        let conversationId = convId ? Number(convId) : undefined;
        if (!conversationId && (userId || vendorId)) {
            const cp = await (0, messaging_helper_1.resolveParticipant)(this.mongo, vendorId ? 'vendor' : 'user', Number(vendorId ?? userId));
            const conv = cp ? await this.mongo.findOne('conversations', { delivery_man_id: dmId, [cp.slot]: cp.id }) : null;
            if (conv)
                conversationId = Number(conv.mysql_id);
        }
        if (!conversationId)
            return { messages: [] };
        const rows = await this.mongo.findMany('messages', { conversation_id: conversationId }, { sort: { mysql_id: 1 }, limit: 100 });
        return {
            messages: rows.map((m) => ({
                id: Number(m.mysql_id),
                conversation_id: conversationId,
                sender_type: m.sender_type,
                sender_id: m.sender_id != null ? Number(m.sender_id) : null,
                message: (m.message ?? m.body ?? ''),
                body: (m.message ?? m.body ?? ''),
                file_full_url: Array.isArray(m.files)
                    ? m.files.map((f) => (0, storage_url_1.storageFullUrl)('conversation', f)).filter((u) => !!u)
                    : [],
                is_seen: m.is_seen ?? 1,
                sent_by_me: m.sender_type === 'delivery_man' && Number(m.sender_id) === dmId,
                created_at: m.created_at ?? null,
            })),
        };
    }
    async messageSearch(req, q) {
        if (!this.useMongo() || !q?.trim())
            return { conversations: [] };
        const dmId = Number(req.actor.id);
        const rows = await this.mongo.findMany('conversations', {
            counterpart_type: 'delivery_man', counterpart_id: dmId, user_name: { $regex: q, $options: 'i' },
        }, { limit: 25 });
        return { conversations: rows.map((c) => ({ id: Number(c.mysql_id), name: c.user_name ?? `Customer #${c.user_id}` })) };
    }
    async messageSend(req, files, rawBody) {
        if (!this.useMongo())
            return { message: 'sent' };
        const dmId = Number(req.actor.id);
        const body = rawBody ?? {};
        const text = (body.message ?? body.body ?? '').toString();
        const imageNames = [];
        for (const f of files ?? []) {
            const name = await this.saveImage(f, 'conversation');
            if (name)
                imageNames.push(name);
        }
        if (!text.trim() && imageNames.length === 0) {
            return { errors: [{ code: 'body', message: 'message body required' }] };
        }
        const counterpartUserId = body.receiver_id ?? body.user_id;
        let convId = body.conversation_id != null && body.conversation_id !== '' ? Number(body.conversation_id) : undefined;
        if (!convId && counterpartUserId != null && counterpartUserId !== '') {
            const cp = await (0, messaging_helper_1.resolveParticipant)(this.mongo, String(body.receiver_type ?? 'user'), Number(counterpartUserId));
            if (cp)
                convId = await (0, messaging_helper_1.findOrCreateConversation)(this.mongo, { slot: 'delivery_man_id', id: dmId }, cp, text);
        }
        if (!convId)
            return { errors: [{ code: 'conversation', message: 'conversation_id or receiver_id required' }] };
        const msgId = await this.mongo.nextMysqlId('messages');
        await this.mongo.insertOne('messages', {
            mysql_id: msgId, conversation_id: convId, sender_type: 'delivery_man', sender_id: dmId,
            message: text, body: text, files: imageNames, created_at: new Date(),
        });
        await this.mongo.updateOne('conversations', { mysql_id: convId }, {
            last_message: text || (imageNames.length ? 'Photo' : ''), last_message_at: new Date(),
        });
        return { message: 'sent', conversation_id: convId, id: msgId, files: imageNames };
    }
};
exports.DeliveryExtrasController = DeliveryExtrasController;
__decorate([
    (0, common_1.Get)('profile'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "profile", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-profile'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileFieldsInterceptor)([{ name: 'image', maxCount: 1 }], { limits: { fileSize: 10 * 1024 * 1024 } })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-active-status'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "toggleActive", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-fcm-token'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "fcmToken", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('remove-account'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)('all-orders'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('offset')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "allOrders", null);
__decorate([
    (0, common_1.Get)('current-orders'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "currentOrders", null);
__decorate([
    (0, common_1.Get)('latest-orders'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "latestOrders", null);
__decorate([
    (0, common_1.Get)('order'),
    __param(0, (0, common_1.Query)('order_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "order", null);
__decorate([
    (0, common_1.Get)('order-details'),
    __param(0, (0, common_1.Query)('order_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "orderDetails", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('accept-order'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "acceptOrder", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-payment-status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "updatePayment", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('send-order-otp'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "sendOtp", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('record-location-data'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "recordLocation", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('last-location'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "lastLocation", null);
__decorate([
    (0, common_1.Get)('earning-report'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "earningReport", null);
__decorate([
    (0, common_1.Get)('get-disbursement-report'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "disbursementReport", null);
__decorate([
    (0, common_1.Get)('wallet-payment-list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "walletPayments", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('make-collected-cash-payment'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "collectedCash", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('make-wallet-adjustment'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "walletAdjustment", null);
__decorate([
    (0, common_1.Get)('withdraw-method/list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "withdrawMethods", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('withdraw-method/store'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "withdrawStore", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('withdraw-method/make-default'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "withdrawDefault", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('withdraw-method/delete'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "withdrawDelete", null);
__decorate([
    (0, common_1.Get)('get-withdraw-method-list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "getWithdrawMethods", null);
__decorate([
    (0, common_1.Get)('dm-shift'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "dmShift", null);
__decorate([
    (0, common_1.Get)('dm-topic'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "dmTopic", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('reviews/submit'),
    (0, auth_guard_1.RequireAuth)('customer'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "submitReview", null);
__decorate([
    (0, common_1.Get)('notifications'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "notifications", null);
__decorate([
    (0, common_1.Get)('message/list'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('type')),
    __param(2, (0, common_1.Query)('offset')),
    __param(3, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "messageList", null);
__decorate([
    (0, common_1.Get)('message/details'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('conversation_id')),
    __param(2, (0, common_1.Query)('user_id')),
    __param(3, (0, common_1.Query)('vendor_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "messageDetails", null);
__decorate([
    (0, common_1.Get)('message/search-list'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "messageSearch", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('message/send'),
    (0, common_1.UseInterceptors)((0, platform_express_1.AnyFilesInterceptor)({ limits: { fileSize: 10 * 1024 * 1024 } })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.UploadedFiles)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "messageSend", null);
exports.DeliveryExtrasController = DeliveryExtrasController = __decorate([
    (0, common_1.Controller)('delivery-man'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, auth_guard_1.RequireAuth)('deliveryman'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        mongo_data_service_1.MongoDataService])
], DeliveryExtrasController);
//# sourceMappingURL=delivery-extras.controller.js.map