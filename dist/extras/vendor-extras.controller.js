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
exports.VendorExtrasController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const auth_guard_1 = require("../auth/auth.guard");
const prisma_service_1 = require("../prisma/prisma.service");
const mongo_data_service_1 = require("../mongo/mongo-data.service");
const toNum = (v) => {
    if (v === null || v === undefined)
        return 0;
    if (typeof v === 'number')
        return v;
    if (typeof v === 'string')
        return Number(v) || 0;
    return Number(v) || 0;
};
let VendorExtrasController = class VendorExtrasController {
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
    async profile(req) {
        if (this.useMongo()) {
            const v = await this.mongo.findByMysqlId('vendors', Number(req.actor.id));
            if (!v)
                return {};
            const vendorId = Number(v.mysql_id);
            const restaurants = await this.mongo.findMany('restaurants', { mysql_vendor_id: vendorId });
            const restaurantIds = restaurants.map((r) => Number(r.mysql_id));
            const wallet = await this.mongo.findOne('restaurant_wallets', { $or: [
                    { vendor_id: vendorId },
                    { mysql_vendor_id: vendorId },
                    ...(restaurantIds.length > 0 ? [{ mysql_restaurant_id: { $in: restaurantIds } }] : []),
                ] });
            const totalEarning = toNum(wallet?.total_earning) ?? 0;
            const balance = toNum(wallet?.balance) ?? 0;
            const cashInHands = toNum(wallet?.collected_cash) ?? 0;
            const alreadyWithdrawn = toNum(wallet?.total_withdrawn) ?? 0;
            const pendingWithdraw = toNum(wallet?.pending_withdraw) ?? 0;
            let todaysCount = 0, weekCount = 0, monthCount = 0, totalOrders = 0;
            let todaysEarn = 0, weekEarn = 0, monthEarn = 0;
            if (restaurantIds.length > 0) {
                const now = Date.now();
                const dayMs = 86_400_000;
                const orders = await this.mongo.findMany('orders', { mysql_restaurant_id: { $in: restaurantIds } });
                totalOrders = orders.length;
                for (const o of orders) {
                    const ts = o.created_at ? new Date(o.created_at).getTime() : 0;
                    if (!Number.isFinite(ts))
                        continue;
                    const age = now - ts;
                    const amount = toNum(o.order_amount) ?? 0;
                    if (age <= dayMs) {
                        todaysCount++;
                        if (o.order_status === 'delivered')
                            todaysEarn += amount;
                    }
                    if (age <= 7 * dayMs) {
                        weekCount++;
                        if (o.order_status === 'delivered')
                            weekEarn += amount;
                    }
                    if (age <= 30 * dayMs) {
                        monthCount++;
                        if (o.order_status === 'delivered')
                            monthEarn += amount;
                    }
                }
            }
            const vCreatedAt = v.created_at;
            const memberSince = vCreatedAt
                ? Math.max(0, Math.floor((Date.now() - new Date(vCreatedAt).getTime()) / 86_400_000))
                : 30;
            return {
                id: vendorId,
                f_name: v.f_name ?? null,
                l_name: v.l_name ?? null,
                email: v.email ?? null,
                phone: v.phone ?? null,
                image: v.image ?? null,
                status: v.status ?? null,
                cash_in_hands: cashInHands,
                balance,
                total_earning: totalEarning,
                withdraw_able_balance: balance,
                Payable_Balance: balance,
                pending_withdraw: pendingWithdraw,
                total_withdrawn: alreadyWithdrawn,
                adjust_able: true,
                over_flow_warning: false,
                over_flow_block_warning: false,
                dynamic_balance: balance,
                dynamic_balance_type: 'positive',
                show_pay_now_button: false,
                order_count: totalOrders,
                product_count: 0,
                review_count: 0,
                todays_order_count: todaysCount,
                this_week_order_count: weekCount,
                this_month_order_count: monthCount,
                todays_earning: todaysEarn,
                this_week_earning: weekEarn,
                this_month_earning: monthEarn,
                member_since_days: memberSince,
                subscription: null,
                subscription_other_data: null,
                subscription_transactions: false,
                roles: [],
                employee_info: null,
                image_full_url: this.buildStorageUrl('profile', v.image),
                restaurants: restaurants.map((r) => ({
                    id: Number(r.mysql_id),
                    name: r.name ?? null,
                    logo: r.logo ?? null,
                    logo_full_url: this.buildStorageUrl('restaurant', r.logo),
                    cover_photo: r.cover_photo ?? null,
                    cover_photo_full_url: this.buildStorageUrl('restaurant/cover', r.cover_photo),
                    status: r.status ?? null,
                    address: r.address ?? null,
                    phone: r.phone ?? null,
                    comission: r.comission !== null && r.comission !== undefined ? toNum(r.comission) : null,
                    minimum_order: toNum(r.minimum_order),
                    delivery: r.delivery ?? null,
                    take_away: r.take_away ?? null,
                    restaurant_model: r.restaurant_model ?? null,
                })),
            };
        }
        const v = await this.prisma.vendors.findUnique({ where: { id: req.actor.id } });
        if (!v)
            return {};
        const restaurants = await this.prisma.restaurants.findMany({
            where: { vendor_id: v.id },
            select: { id: true, name: true, logo: true, status: true, address: true, phone: true, comission: true, minimum_order: true, delivery: true, take_away: true, restaurant_model: true },
        });
        return {
            id: Number(v.id),
            f_name: v.f_name,
            l_name: v.l_name,
            email: v.email,
            phone: v.phone,
            image: v.image,
            status: v.status,
            restaurants: restaurants.map((r) => ({ ...r, id: Number(r.id), comission: r.comission !== null ? Number(r.comission) : null, minimum_order: Number(r.minimum_order) })),
        };
    }
    async updateProfile(req, body = {}, files = {}) {
        const b = body ?? {};
        const data = {};
        for (const k of ['f_name', 'l_name', 'email', 'phone', 'password']) {
            if (b[k] !== undefined)
                data[k] = String(b[k]);
        }
        const avatarName = this.saveUploaded(files?.image?.[0], 'profile');
        if (avatarName)
            data.image = avatarName;
        if (Object.keys(data).length === 0)
            return { message: 'nothing to update' };
        data.updated_at = new Date();
        if (this.useMongo()) {
            await this.mongo.updateOne('vendors', { mysql_id: Number(req.actor.id) }, data);
            return { message: 'Profile updated' };
        }
        await this.prisma.vendors.update({ where: { id: req.actor.id }, data: data });
        return { message: 'Profile updated' };
    }
    fcmToken() { return { message: 'token-updated' }; }
    async toggleActive(req, body) {
        if (this.useMongo()) {
            const r = await this.mongo.findOne('restaurants', { mysql_vendor_id: Number(req.actor.id) });
            if (r && body.status !== undefined) {
                await this.mongo.updateOne('restaurants', { mysql_id: r.mysql_id }, { active: body.status });
            }
            return { message: 'updated' };
        }
        const r = await this.prisma.restaurants.findFirst({ where: { vendor_id: req.actor.id }, select: { id: true } });
        if (r && body.status !== undefined) {
            await this.prisma.restaurants.update({ where: { id: r.id }, data: { active: body.status } });
        }
        return { message: 'updated' };
    }
    toggleOpen() { return { message: 'updated' }; }
    announce() { return { message: 'announcement updated' }; }
    bankInfo() { return { message: 'bank info updated' }; }
    buildStorageUrl(folder, filename) {
        const base = (process.env.STORAGE_BASE_URL ?? 'http://127.0.0.1:3000/storage').replace(/\/$/, '');
        const safeName = filename && String(filename).trim() ? String(filename) : 'default.png';
        return `${base}/${folder}/${safeName}`;
    }
    storageDir(folder) {
        const root = process.env.STORAGE_ROOT
            ?? path.resolve(__dirname, '../../storage/app/public');
        const dir = path.join(root, folder);
        fs.mkdirSync(dir, { recursive: true });
        return dir;
    }
    saveUploaded(file, folder) {
        if (!file || !file.buffer || file.buffer.length === 0)
            return null;
        const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        fs.writeFileSync(path.join(this.storageDir(folder), filename), file.buffer);
        return filename;
    }
    async basicInfo(req, body = {}, files = {}) {
        const b = body ?? {};
        const data = {};
        if (b.translations !== undefined) {
            let translations = [];
            if (typeof b.translations === 'string') {
                try {
                    translations = JSON.parse(b.translations) ?? [];
                }
                catch {
                    translations = [];
                }
            }
            else if (Array.isArray(b.translations)) {
                translations = b.translations;
            }
            data.translations = translations;
            const pick = (lang, key) => translations.find((t) => t?.locale === lang && t?.key === key)?.value;
            const enName = pick('en', 'name') ?? pick('default', 'name') ?? translations.find((t) => t?.key === 'name')?.value;
            const enAddress = pick('en', 'address') ?? pick('default', 'address') ?? translations.find((t) => t?.key === 'address')?.value;
            if (enName)
                data.name = enName;
            if (enAddress)
                data.address = enAddress;
        }
        if (b.name !== undefined)
            data.name = String(b.name);
        if (b.address !== undefined)
            data.address = String(b.address);
        if (b.contact_number !== undefined)
            data.phone = String(b.contact_number);
        if (b.phone !== undefined)
            data.phone = String(b.phone);
        if (b.gst !== undefined)
            data.gst = String(b.gst);
        if (b.gst_status !== undefined)
            data.gst_status = !!Number(b.gst_status);
        if (b.minimum_order !== undefined)
            data.minimum_order = Number(b.minimum_order);
        if (b.meta_title !== undefined)
            data.meta_title = String(b.meta_title);
        if (b.meta_description !== undefined)
            data.meta_description = String(b.meta_description);
        if (b.meta_keywords !== undefined)
            data.meta_keywords = String(b.meta_keywords);
        const logoName = this.saveUploaded(files?.logo?.[0], 'restaurant');
        const coverName = this.saveUploaded(files?.cover_photo?.[0], 'restaurant/cover');
        const metaName = this.saveUploaded(files?.meta_image?.[0], 'restaurant');
        if (logoName)
            data.logo = logoName;
        if (coverName)
            data.cover_photo = coverName;
        if (metaName)
            data.meta_image = metaName;
        if (Object.keys(data).length === 0)
            return { message: 'nothing to update' };
        data.updated_at = new Date();
        if (this.useMongo()) {
            await this.mongo.updateOne('restaurants', { mysql_vendor_id: Number(req.actor.id) }, data);
            return { message: 'basic info updated' };
        }
        const r = await this.prisma.restaurants.findFirst({ where: { vendor_id: req.actor.id }, select: { id: true } });
        if (r)
            await this.prisma.restaurants.update({
                where: { id: r.id },
                data: data,
            });
        return { message: 'basic info updated' };
    }
    async businessSetup(req, body = {}) {
        const b = body ?? {};
        const data = {};
        for (const k of ['minimum_order', 'minimum_shipping_charge']) {
            if (b[k] !== undefined)
                data[k] = Number(b[k]);
        }
        for (const k of ['delivery', 'take_away', 'free_delivery', 'veg', 'non_veg', 'self_delivery_system']) {
            if (b[k] !== undefined)
                data[k] = !!Number(b[k]);
        }
        if (b.restaurant_model !== undefined)
            data.restaurant_model = String(b.restaurant_model);
        if (b.delivery_time !== undefined)
            data.delivery_time = String(b.delivery_time);
        if (Object.keys(data).length === 0)
            return { message: 'nothing to update' };
        data.updated_at = new Date();
        if (this.useMongo()) {
            await this.mongo.updateOne('restaurants', { mysql_vendor_id: Number(req.actor.id) }, data);
        }
        return { message: 'business setup updated' };
    }
    addDineInTable() { return { message: 'added' }; }
    remove() { return { message: 'Not available in demo' }; }
    shapeOrder(rIn, detailsCount) {
        const r = rIn;
        const created = r.created_at;
        const updated = r.updated_at;
        return {
            ...(r.legacy ?? {}),
            ...r,
            id: Number(r.mysql_id),
            user_id: r.mysql_user_id !== null && r.mysql_user_id !== undefined ? Number(r.mysql_user_id) : null,
            restaurant_id: r.mysql_restaurant_id !== null && r.mysql_restaurant_id !== undefined ? Number(r.mysql_restaurant_id) : 0,
            order_amount: toNum(r.order_amount) ?? 0,
            details_count: detailsCount,
            order_status: (r.order_status ?? 'pending'),
            order_type: (r.order_type ?? 'delivery'),
            payment_method: (r.payment_method ?? 'cash_on_delivery'),
            payment_status: (r.payment_status ?? 'unpaid'),
            delivery_address: r.delivery_address ?? null,
            created_at: created ? new Date(created).toISOString() : new Date().toISOString(),
            updated_at: updated ? new Date(updated).toISOString() : new Date().toISOString(),
        };
    }
    async detailsCountMap(orderIds) {
        if (orderIds.length === 0)
            return new Map();
        const rows = await this.mongo.aggregate('order_details', [
            { $match: { order_id: { $in: orderIds } } },
            { $group: { _id: '$order_id', count: { $sum: 1 } } },
        ]);
        return new Map(rows.map((r) => [Number(r._id), r.count]));
    }
    async currentOrders(req) {
        if (this.useMongo()) {
            const restaurant = await this.mongo.findOne('restaurants', { mysql_vendor_id: Number(req.actor.id) });
            if (!restaurant)
                return [];
            const rows = await this.mongo.findMany('orders', { mysql_restaurant_id: Number(restaurant.mysql_id), order_status: { $in: ['accepted', 'confirmed', 'processing'] } }, { sort: { mysql_id: -1 } });
            const countsByOrderId = await this.detailsCountMap(rows.map((r) => Number(r.mysql_id)));
            return rows.map((r) => this.shapeOrder(r, countsByOrderId.get(Number(r.mysql_id)) ?? 1));
        }
        const restaurant = await this.prisma.restaurants.findFirst({ where: { vendor_id: req.actor.id }, select: { id: true } });
        if (!restaurant)
            return [];
        const rows = await this.prisma.orders.findMany({
            where: { restaurant_id: restaurant.id, order_status: { in: ['accepted', 'confirmed', 'processing'] } },
            orderBy: { id: 'desc' },
        });
        return rows.map((r) => ({ ...r, id: Number(r.id), user_id: r.user_id ? Number(r.user_id) : null, restaurant_id: Number(r.restaurant_id), order_amount: Number(r.order_amount) }));
    }
    async completedOrders(req) {
        if (this.useMongo()) {
            const restaurant = await this.mongo.findOne('restaurants', { mysql_vendor_id: Number(req.actor.id) });
            if (!restaurant)
                return { orders: [], total_size: 0 };
            const rows = await this.mongo.findMany('orders', { mysql_restaurant_id: Number(restaurant.mysql_id), order_status: { $in: ['delivered', 'canceled', 'refunded'] } }, { sort: { mysql_id: -1 }, limit: 50 });
            const countsByOrderId = await this.detailsCountMap(rows.map((r) => Number(r.mysql_id)));
            return {
                orders: rows.map((r) => this.shapeOrder(r, countsByOrderId.get(Number(r.mysql_id)) ?? 1)),
                total_size: rows.length,
            };
        }
        const restaurant = await this.prisma.restaurants.findFirst({ where: { vendor_id: req.actor.id }, select: { id: true } });
        if (!restaurant)
            return { orders: [], total_size: 0 };
        const rows = await this.prisma.orders.findMany({
            where: { restaurant_id: restaurant.id, order_status: { in: ['delivered', 'canceled', 'refunded'] } },
            orderBy: { id: 'desc' },
            take: 50,
        });
        return { orders: rows.map((r) => ({ ...r, id: Number(r.id), user_id: r.user_id ? Number(r.user_id) : null, restaurant_id: Number(r.restaurant_id), order_amount: Number(r.order_amount) })), total_size: rows.length };
    }
    async vendorOrder(idStr) {
        const id = parseInt(idStr ?? '', 10);
        if (!Number.isFinite(id))
            return null;
        if (this.useMongo()) {
            const o = await this.mongo.findByMysqlId('orders', id);
            if (!o)
                return null;
            const counts = await this.detailsCountMap([Number(o.mysql_id)]);
            return this.shapeOrder(o, counts.get(Number(o.mysql_id)) ?? 1);
        }
        const o = await this.prisma.orders.findUnique({ where: { id: BigInt(id) } });
        return o ? { ...o, id: Number(o.id), user_id: o.user_id ? Number(o.user_id) : null, restaurant_id: Number(o.restaurant_id), order_amount: Number(o.order_amount) } : null;
    }
    updateOrder() { return { message: 'order updated' }; }
    sendOrderOtp() { return { otp: '1234', message: 'otp generated' }; }
    customerAddressUpdate() { return { message: 'address updated' }; }
    async products(req, limitStr, offsetStr) {
        const limit = parseInt(limitStr ?? '25', 10);
        const offset = parseInt(offsetStr ?? '1', 10);
        if (this.useMongo()) {
            const restaurant = await this.mongo.findOne('restaurants', { mysql_vendor_id: Number(req.actor.id) });
            if (!restaurant)
                return { products: [], total_size: 0, limit, offset };
            const filter = { mysql_restaurant_id: Number(restaurant.mysql_id) };
            const [rows, total] = await Promise.all([
                this.mongo.findMany('foods', filter, { sort: { mysql_id: -1 }, limit, skip: Math.max(0, (offset - 1) * limit) }),
                this.mongo.count('foods', filter),
            ]);
            return {
                products: rows.map((r) => ({
                    ...(r.legacy ?? {}),
                    ...r,
                    id: Number(r.mysql_id),
                    price: toNum(r.price),
                    tax: toNum(r.tax),
                    discount: toNum(r.discount),
                    restaurant_id: r.mysql_restaurant_id !== null && r.mysql_restaurant_id !== undefined ? Number(r.mysql_restaurant_id) : 0,
                    category_id: r.mysql_category_id !== null && r.mysql_category_id !== undefined ? Number(r.mysql_category_id) : null,
                })),
                total_size: total,
                limit,
                offset,
            };
        }
        const restaurant = await this.prisma.restaurants.findFirst({ where: { vendor_id: req.actor.id }, select: { id: true } });
        if (!restaurant)
            return { products: [], total_size: 0, limit, offset };
        const [rows, total] = await Promise.all([
            this.prisma.food.findMany({ where: { restaurant_id: restaurant.id }, orderBy: { id: 'desc' }, take: limit, skip: Math.max(0, (offset - 1) * limit) }),
            this.prisma.food.count({ where: { restaurant_id: restaurant.id } }),
        ]);
        return { products: rows.map((r) => ({ ...r, id: Number(r.id), price: Number(r.price), tax: Number(r.tax), discount: Number(r.discount), restaurant_id: Number(r.restaurant_id), category_id: r.category_id ? Number(r.category_id) : null })), total_size: total, limit, offset };
    }
    async productDetails(idStr) {
        const id = parseInt(idStr ?? '', 10);
        if (!Number.isFinite(id))
            return null;
        if (this.useMongo()) {
            const f = await this.mongo.findByMysqlId('foods', id);
            return f
                ? {
                    ...(f.legacy ?? {}),
                    ...f,
                    id: Number(f.mysql_id),
                    price: toNum(f.price),
                    tax: toNum(f.tax),
                    discount: toNum(f.discount),
                    restaurant_id: f.mysql_restaurant_id !== null && f.mysql_restaurant_id !== undefined ? Number(f.mysql_restaurant_id) : 0,
                    category_id: f.mysql_category_id !== null && f.mysql_category_id !== undefined ? Number(f.mysql_category_id) : null,
                }
                : null;
        }
        const f = await this.prisma.food.findUnique({ where: { id: BigInt(id) } });
        return f ? { ...f, id: Number(f.id), price: Number(f.price), tax: Number(f.tax), discount: Number(f.discount), restaurant_id: Number(f.restaurant_id), category_id: f.category_id ? Number(f.category_id) : null } : null;
    }
    productSearch() { return { products: [], total_size: 0 }; }
    productStatus() { return { message: 'updated' }; }
    productRecommended() { return { message: 'updated' }; }
    updateStock() { return { message: 'stock updated' }; }
    async productStore(req, body = {}, files = {}) {
        if (!this.useMongo())
            return { message: 'product created' };
        const b = body ?? {};
        const restaurant = await this.mongo.findOne('restaurants', { mysql_vendor_id: Number(req.actor.id) });
        if (!restaurant)
            return { errors: [{ code: 'restaurant', message: 'restaurant not found' }] };
        const { name: trName, description: trDesc, translations } = this.parseProductTranslations(b.translations);
        const nextId = await this.mongo.nextMysqlId('foods');
        const imageName = this.saveUploaded(files?.image?.[0], 'product') ?? 'default.png';
        const metaImage = this.saveUploaded(files?.meta_image?.[0], 'product');
        const now = new Date();
        const food = {
            mysql_id: nextId,
            mysql_restaurant_id: Number(restaurant.mysql_id),
            restaurant_id: Number(restaurant.mysql_id),
            mysql_category_id: b.category_id !== undefined && b.category_id !== '' ? Number(b.category_id) : null,
            category_id: b.category_id !== undefined && b.category_id !== '' ? Number(b.category_id) : null,
            name: trName ?? String(b.name ?? 'Untitled food'),
            description: trDesc ?? String(b.description ?? ''),
            translations,
            price: Number(b.price ?? 0),
            tax: Number(b.tax ?? 0),
            tax_type: String(b.tax_type ?? 'percent'),
            discount: Number(b.discount ?? 0),
            discount_type: String(b.discount_type ?? 'percent'),
            veg: !!Number(b.veg ?? 0),
            status: true,
            image: imageName,
            meta_image: metaImage,
            meta_title: b.meta_title ? String(b.meta_title) : null,
            meta_description: b.meta_description ? String(b.meta_description) : null,
            available_time_starts: b.available_time_starts ? String(b.available_time_starts) : '00:00',
            available_time_ends: b.available_time_ends ? String(b.available_time_ends) : '23:59',
            stock_type: String(b.stock_type ?? 'unlimited'),
            item_stock: Number(b.item_stock ?? 0),
            sell_count: 0,
            avg_rating: 0,
            rating_count: 0,
            addon_ids: b.addon_ids ?? [],
            variations: b.variations ?? [],
            created_at: now,
            updated_at: now,
        };
        await this.mongo.insertOne('foods', food);
        return { message: 'Product added successfully', id: nextId };
    }
    async productUpdate(body = {}, files = {}) {
        if (!this.useMongo())
            return { message: 'product updated' };
        const b = body ?? {};
        const foodId = b.id !== undefined && b.id !== '' ? Number(b.id) : null;
        if (!foodId)
            return { errors: [{ code: 'id', message: 'product id required' }] };
        const data = {};
        if (b.translations !== undefined) {
            const { name: trName, description: trDesc, translations } = this.parseProductTranslations(b.translations);
            data.translations = translations;
            if (trName)
                data.name = trName;
            if (trDesc)
                data.description = trDesc;
        }
        if (b.name !== undefined)
            data.name = String(b.name);
        if (b.description !== undefined)
            data.description = String(b.description);
        if (b.price !== undefined && b.price !== '')
            data.price = Number(b.price);
        if (b.tax !== undefined && b.tax !== '')
            data.tax = Number(b.tax);
        if (b.discount !== undefined && b.discount !== '')
            data.discount = Number(b.discount);
        if (b.discount_type !== undefined)
            data.discount_type = String(b.discount_type);
        if (b.veg !== undefined)
            data.veg = !!Number(b.veg);
        if (b.category_id !== undefined && b.category_id !== '') {
            data.category_id = Number(b.category_id);
            data.mysql_category_id = Number(b.category_id);
        }
        if (b.stock_type !== undefined)
            data.stock_type = String(b.stock_type);
        if (b.item_stock !== undefined && b.item_stock !== '')
            data.item_stock = Number(b.item_stock);
        if (b.available_time_starts !== undefined)
            data.available_time_starts = String(b.available_time_starts);
        if (b.available_time_ends !== undefined)
            data.available_time_ends = String(b.available_time_ends);
        if (b.maximum_cart_quantity !== undefined && b.maximum_cart_quantity !== '') {
            data.maximum_cart_quantity = Number(b.maximum_cart_quantity);
        }
        if (b.is_halal !== undefined)
            data.is_halal = !!Number(b.is_halal);
        const imageName = this.saveUploaded(files?.image?.[0], 'product');
        const metaImage = this.saveUploaded(files?.meta_image?.[0], 'product');
        if (imageName)
            data.image = imageName;
        if (metaImage)
            data.meta_image = metaImage;
        if (Object.keys(data).length === 0)
            return { message: 'nothing to update' };
        data.updated_at = new Date();
        const result = await this.mongo.updateOne('foods', { mysql_id: foodId }, data);
        return { message: 'Product updated successfully', matched: result?.matchedCount ?? 0, modified: result?.modifiedCount ?? 0 };
    }
    parseProductTranslations(raw) {
        let translations = [];
        if (typeof raw === 'string') {
            try {
                translations = JSON.parse(raw) ?? [];
            }
            catch {
                translations = [];
            }
        }
        else if (Array.isArray(raw)) {
            translations = raw;
        }
        const pick = (key) => translations.find((t) => t?.locale === 'en' && t?.key === key)?.value
            ?? translations.find((t) => t?.key === key)?.value
            ?? null;
        return { name: pick('name'), description: pick('description'), translations };
    }
    productDelete() { return { message: 'product deleted' }; }
    async productReviews(idStr) {
        const id = parseInt(idStr ?? '', 10);
        if (!Number.isFinite(id))
            return [];
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('reviews', { mysql_food_id: id }, { sort: { mysql_id: -1 }, limit: 50 });
            return rows.map((r) => ({
                id: Number(r.mysql_id),
                food_id: r.mysql_food_id !== null && r.mysql_food_id !== undefined ? Number(r.mysql_food_id) : 0,
                user_id: r.mysql_user_id !== null && r.mysql_user_id !== undefined ? Number(r.mysql_user_id) : 0,
                comment: r.comment ?? null,
                rating: r.rating ?? null,
                reply: r.reply ?? null,
            }));
        }
        const rows = await this.prisma.reviews.findMany({ where: { food_id: BigInt(id) }, orderBy: { id: 'desc' }, take: 50 });
        return rows.map((r) => ({ id: Number(r.id), food_id: Number(r.food_id), user_id: Number(r.user_id), comment: r.comment, rating: r.rating, reply: r.reply }));
    }
    productReply() { return { message: 'reply saved' }; }
    productLimits() { return { remaining: 'unlimited' }; }
    async categories() {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('categories', { parent_id: 0, status: true });
            return rows.map((r) => ({ id: Number(r.mysql_id), name: r.name ?? null, image: r.image ?? null, status: r.status ?? null }));
        }
        const rows = await this.prisma.categories.findMany({ where: { parent_id: 0, status: true } });
        return rows.map((r) => ({ id: Number(r.id), name: r.name, image: r.image, status: r.status }));
    }
    async childCategories(idStr) {
        const id = parseInt(idStr ?? '0', 10);
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('categories', { parent_id: id, status: true });
            return rows.map((r) => ({ id: Number(r.mysql_id), name: r.name ?? null, image: r.image ?? null, status: r.status ?? null }));
        }
        return this.prisma.categories.findMany({ where: { parent_id: id, status: true } }).then((rows) => rows.map((r) => ({ id: Number(r.id), name: r.name, image: r.image, status: r.status })));
    }
    categoryProducts() { return { products: [], total_size: 0 }; }
    async vendorAddons(req) {
        if (this.useMongo()) {
            const restaurant = await this.mongo.findOne('restaurants', { mysql_vendor_id: Number(req.actor.id) });
            if (!restaurant)
                return { addons: [] };
            const rows = await this.mongo.findMany('add_ons', { mysql_restaurant_id: Number(restaurant.mysql_id) });
            return rows.map((r) => ({
                ...(r.legacy ?? {}),
                ...r,
                id: Number(r.mysql_id),
                restaurant_id: r.mysql_restaurant_id !== null && r.mysql_restaurant_id !== undefined ? Number(r.mysql_restaurant_id) : 0,
                addon_category_id: r.mysql_addon_category_id !== null && r.mysql_addon_category_id !== undefined ? Number(r.mysql_addon_category_id) : null,
                price: toNum(r.price),
            }));
        }
        const restaurant = await this.prisma.restaurants.findFirst({ where: { vendor_id: req.actor.id }, select: { id: true } });
        if (!restaurant)
            return { addons: [] };
        const rows = await this.prisma.add_ons.findMany({ where: { restaurant_id: restaurant.id } });
        return rows.map((r) => ({ ...r, id: Number(r.id), restaurant_id: Number(r.restaurant_id), addon_category_id: r.addon_category_id ? Number(r.addon_category_id) : null, price: Number(r.price) }));
    }
    addonStore() { return { message: 'addon created' }; }
    addonUpdate() { return { message: 'addon updated' }; }
    addonDelete() { return { message: 'addon deleted' }; }
    async attributes() {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('attributes', {});
            return rows.map((r) => ({ id: Number(r.mysql_id), name: r.name ?? null }));
        }
        const rows = await this.prisma.attributes.findMany();
        return rows.map((r) => ({ id: Number(r.id), name: r.name }));
    }
    async vendorDmList(req) {
        if (this.useMongo()) {
            const restaurant = await this.mongo.findOne('restaurants', { mysql_vendor_id: Number(req.actor.id) });
            if (!restaurant)
                return { delivery_men: [], total_size: 0 };
            const zoneId = restaurant.mysql_zone_id ?? restaurant.zone_id ?? null;
            const filter = zoneId !== null && zoneId !== undefined ? { mysql_zone_id: Number(zoneId) } : {};
            const rows = await this.mongo.findMany('delivery_men', filter);
            return rows.map((r) => ({
                id: Number(r.mysql_id),
                f_name: r.f_name ?? null,
                l_name: r.l_name ?? null,
                phone: r.phone ?? null,
                status: r.status ?? null,
                application_status: r.application_status ?? null,
            }));
        }
        const restaurant = await this.prisma.restaurants.findFirst({ where: { vendor_id: req.actor.id }, select: { id: true, zone_id: true } });
        if (!restaurant)
            return { delivery_men: [], total_size: 0 };
        const rows = await this.prisma.delivery_men.findMany({ where: { zone_id: restaurant.zone_id ?? undefined } });
        return rows.map((r) => ({ id: Number(r.id), f_name: r.f_name, l_name: r.l_name, phone: r.phone, status: r.status, application_status: r.application_status }));
    }
    getDmList(req) { return this.vendorDmList(req); }
    dmPreview() { return null; }
    dmStore() { return { message: 'delivery man created' }; }
    dmUpdate() { return { message: 'updated' }; }
    dmDelete() { return { message: 'deleted' }; }
    dmStatus() { return { message: 'status updated' }; }
    dmAssign() { return { message: 'assigned' }; }
    vendorCouponList() { return { coupons: [], total_size: 0 }; }
    vendorCouponStore() { return { message: 'coupon created' }; }
    vendorCouponUpdate() { return { message: 'coupon updated' }; }
    vendorCouponStatus() { return { message: 'status updated' }; }
    vendorCouponDelete() { return { message: 'coupon deleted' }; }
    vendorCouponView() { return {}; }
    walletPaymentList() { return { data: [], total_size: 0 }; }
    collectedCash() { return { message: 'recorded' }; }
    walletAdjustment() { return { message: 'recorded' }; }
    async withdrawMethods() {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('withdrawal_methods', { $or: [{ is_active: 1 }, { is_active: true }] });
            return rows.map((r) => ({
                id: Number(r.mysql_id),
                method_name: r.method_name ?? null,
                method_fields: r.method_fields ?? null,
                is_default: r.is_default ?? null,
            }));
        }
        const rows = await this.prisma.withdrawal_methods.findMany({ where: { is_active: 1 } });
        return rows.map((r) => ({ id: Number(r.id), method_name: r.method_name, method_fields: r.method_fields, is_default: r.is_default }));
    }
    withdrawStore() { return { message: 'method added' }; }
    withdrawDefault() { return { message: 'default set' }; }
    withdrawDelete() { return { message: 'deleted' }; }
    getWithdrawMethods() { return this.withdrawMethods(); }
    getWithdrawList() { return { data: [], total_size: 0 }; }
    requestWithdraw() { return { message: 'withdraw requested' }; }
    async vendorOrdersForReports(req) {
        if (!this.useMongo())
            return [];
        const r = await this.mongo.findOne('restaurants', { mysql_vendor_id: Number(req.actor.id) });
        if (!r)
            return [];
        return this.mongo.findMany('orders', { mysql_restaurant_id: Number(r.mysql_id) });
    }
    async earningReport(req) {
        const orders = await this.vendorOrdersForReports(req);
        const now = Date.now(), dayMs = 86_400_000;
        let total = 0, today = 0, week = 0, month = 0;
        for (const o of orders) {
            if (o.order_status !== 'delivered')
                continue;
            const earn = Number(o.order_amount ?? 0) - Number(o.delivery_charge ?? 0);
            total += earn;
            const ts = o.created_at ? new Date(o.created_at).getTime() : 0;
            if (!Number.isFinite(ts) || ts === 0)
                continue;
            const age = now - ts;
            if (age <= dayMs)
                today += earn;
            if (age <= 7 * dayMs)
                week += earn;
            if (age <= 30 * dayMs)
                month += earn;
        }
        return { total, today, this_week: week, this_month: month };
    }
    async orderReport(req) {
        const orders = await this.vendorOrdersForReports(req);
        let delivered = 0, canceled = 0, returned = 0, totalAmount = 0;
        const byDay = {};
        for (const o of orders) {
            if (o.order_status === 'delivered') {
                delivered++;
                totalAmount += Number(o.order_amount ?? 0);
            }
            if (o.order_status === 'canceled')
                canceled++;
            if (o.order_status === 'refunded')
                returned++;
            const dt = o.created_at ? new Date(o.created_at).toISOString().slice(0, 10) : null;
            if (dt)
                byDay[dt] = (byDay[dt] || 0) + 1;
        }
        return {
            delivered, canceled, returned, total_orders: orders.length, total_amount: totalAmount,
            data: Object.entries(byDay).sort().map(([day, count]) => ({ day, count })),
        };
    }
    async foodReport(req) {
        const orders = await this.vendorOrdersForReports(req);
        const orderIds = orders.map((o) => Number(o.mysql_id));
        if (!this.useMongo() || orderIds.length === 0)
            return { data: [], total_data: [] };
        const items = await this.mongo.findMany('order_details', { order_id: { $in: orderIds } });
        const byFood = {};
        for (const it of items) {
            const fid = Number(it.food_id ?? 0);
            if (!fid)
                continue;
            const qty = Number(it.quantity ?? 1);
            const price = Number(it.price ?? 0);
            if (!byFood[fid])
                byFood[fid] = { food_id: fid, total_sold_quantity: 0, total_amount: 0 };
            byFood[fid].total_sold_quantity += qty;
            byFood[fid].total_amount += qty * price;
        }
        const sorted = Object.values(byFood).sort((a, b) => b.total_sold_quantity - a.total_sold_quantity);
        return { data: sorted, total_data: sorted };
    }
    campaignReport() { return { data: [], total_amount: 0, total_orders: 0 }; }
    async taxReport(req) {
        const orders = await this.vendorOrdersForReports(req);
        let total = 0;
        const data = orders
            .filter((o) => o.order_status === 'delivered')
            .map((o) => {
            const tax = Number(o.total_tax_amount ?? 0);
            total += tax;
            return {
                order_id: Number(o.mysql_id),
                order_amount: Number(o.order_amount ?? 0),
                tax_amount: tax,
                created_at: o.created_at ?? null,
            };
        });
        return { data, total };
    }
    disbursementReport() { return { data: [], total: 0 }; }
    async expenseReport(req) {
        const orders = await this.vendorOrdersForReports(req);
        let total = 0;
        const data = orders
            .filter((o) => o.order_status === 'delivered')
            .map((o) => {
            const commission = Number(o.order_amount ?? 0) * 0.10;
            total += commission;
            return {
                order_id: Number(o.mysql_id),
                order_amount: Number(o.order_amount ?? 0),
                commission_amount: +commission.toFixed(2),
                created_at: o.created_at ?? null,
            };
        });
        return { data, total: +total.toFixed(2) };
    }
    async transactionReport(req) {
        const orders = await this.vendorOrdersForReports(req);
        let total = 0;
        const data = orders.map((o) => {
            const amt = Number(o.order_amount ?? 0);
            total += amt;
            return {
                order_id: Number(o.mysql_id),
                order_amount: amt,
                payment_method: o.payment_method ?? null,
                payment_status: o.payment_status ?? null,
                order_status: o.order_status ?? null,
                created_at: o.created_at ?? null,
            };
        });
        return { data, total };
    }
    generateStatement() { return { message: 'not available in demo' }; }
    searchedFood() { return { products: [] }; }
    async vendorNotifications() {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('notifications', { status: true }, { sort: { mysql_id: -1 }, limit: 50 });
            return rows.map((r) => ({ id: Number(r.mysql_id), title: r.title ?? null, description: r.description ?? null }));
        }
        const rows = await this.prisma.notifications.findMany({ where: { status: true }, orderBy: { id: 'desc' }, take: 50 });
        return rows.map((r) => ({ id: Number(r.id), title: r.title, description: r.description }));
    }
    messageList() { return { conversations: [], total_size: 0 }; }
    messageDetails() { return { messages: [] }; }
    messageSearch() { return { conversations: [] }; }
    messageSend() { return { message: 'sent' }; }
    basicCampaigns() { return []; }
    campaignJoin() { return { message: 'joined' }; }
    campaignLeave() { return { message: 'left' }; }
    async ads(req) {
        if (this.useMongo()) {
            const r = await this.mongo.findOne('restaurants', { mysql_vendor_id: Number(req.actor.id) });
            if (!r)
                return [];
            const rows = await this.mongo.findMany('advertisements', { mysql_restaurant_id: Number(r.mysql_id) });
            return rows.map((row) => ({
                ...(row.legacy ?? {}),
                ...row,
                id: Number(row.mysql_id),
                restaurant_id: row.mysql_restaurant_id !== null && row.mysql_restaurant_id !== undefined ? Number(row.mysql_restaurant_id) : 0,
                created_by_id: row.mysql_created_by_id !== null && row.mysql_created_by_id !== undefined ? Number(row.mysql_created_by_id) : 0,
            }));
        }
        const r = await this.prisma.restaurants.findFirst({ where: { vendor_id: req.actor.id }, select: { id: true } });
        if (!r)
            return [];
        const rows = await this.prisma.advertisements.findMany({ where: { restaurant_id: r.id } });
        return rows.map((row) => ({ ...row, id: Number(row.id), restaurant_id: Number(row.restaurant_id), created_by_id: Number(row.created_by_id) }));
    }
    adDetails() { return null; }
    adStore() { return { message: 'ad created' }; }
    adUpdate() { return { message: 'updated' }; }
    adStatus() { return { message: 'status updated' }; }
    adCopy() { return { message: 'copied' }; }
    adDelete() { return { message: 'deleted' }; }
    async businessPlan(req) {
        const r = this.useMongo()
            ? await this.mongo.findOne('restaurants', { mysql_vendor_id: Number(req.actor.id) })
            : null;
        return {
            commission: 1,
            subscription: 0,
            commission_rate: r?.comission ?? 0,
            restaurant_id: r ? Number(r.mysql_id) : null,
            restaurant_name: r?.name ?? null,
        };
    }
    packageView() {
        return {
            package: {
                id: 1, package_name: 'Commission-base Plan',
                commission_status: 1, commission: 0,
                package_type: 'commission', validity: 0,
                price: 0, plan_type: 'free',
            },
            transactions: [],
        };
    }
    subscriptionTransactionsList() {
        return { transactions: [], total_size: 0, limit: 10, offset: 1 };
    }
    subscriptionTransaction() { return { message: 'recorded' }; }
    subscriptionPayment() { return { redirect_url: null }; }
    cancelSubscription() { return { message: 'canceled' }; }
    async schedule(req) {
        if (this.useMongo()) {
            const r = await this.mongo.findOne('restaurants', { mysql_vendor_id: Number(req.actor.id) });
            if (!r)
                return [];
            const rows = await this.mongo.findMany('restaurant_schedule', { mysql_restaurant_id: Number(r.mysql_id) });
            return rows.map((row) => ({
                ...(row.legacy ?? {}),
                ...row,
                id: Number(row.mysql_id),
                restaurant_id: row.mysql_restaurant_id !== null && row.mysql_restaurant_id !== undefined ? Number(row.mysql_restaurant_id) : 0,
            }));
        }
        const r = await this.prisma.restaurants.findFirst({ where: { vendor_id: req.actor.id }, select: { id: true } });
        if (!r)
            return [];
        const rows = await this.prisma.restaurant_schedule.findMany({ where: { restaurant_id: r.id } });
        return rows.map((row) => ({ ...row, id: Number(row.id), restaurant_id: Number(row.restaurant_id) }));
    }
    scheduleStore() { return { message: 'schedule saved' }; }
    posCustomers() { return { users: [], total_size: 0 }; }
    posOrders() { return { orders: [], total_size: 0 }; }
    posPlaceOrder() { return { message: 'pos not available in demo' }; }
    characteristicSuggestions() { return []; }
};
exports.VendorExtrasController = VendorExtrasController;
__decorate([
    (0, common_1.Get)('profile'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "profile", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-profile'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileFieldsInterceptor)([
        { name: 'image', maxCount: 1 },
    ], { limits: { fileSize: 5 * 1024 * 1024 } })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-fcm-token'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "fcmToken", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-active-status'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "toggleActive", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('opening-closing-status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "toggleOpen", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-announcment'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "announce", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-bank-info'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "bankInfo", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-basic-info'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileFieldsInterceptor)([
        { name: 'logo', maxCount: 1 },
        { name: 'cover_photo', maxCount: 1 },
        { name: 'meta_image', maxCount: 1 },
    ], { limits: { fileSize: 5 * 1024 * 1024 } })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "basicInfo", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-business-setup'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileFieldsInterceptor)([
        { name: 'logo', maxCount: 1 },
        { name: 'cover_photo', maxCount: 1 },
    ], { limits: { fileSize: 5 * 1024 * 1024 } })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "businessSetup", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('add-dine-in-table-number'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "addDineInTable", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('remove-account'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)('current-orders'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "currentOrders", null);
__decorate([
    (0, common_1.Get)('completed-orders'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "completedOrders", null);
__decorate([
    (0, common_1.Get)('order'),
    __param(0, (0, common_1.Query)('order_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "vendorOrder", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-order'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "updateOrder", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('send-order-otp'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "sendOrderOtp", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('customer-address-update'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "customerAddressUpdate", null);
__decorate([
    (0, common_1.Get)('get-products-list'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "products", null);
__decorate([
    (0, common_1.Get)('product/details'),
    __param(0, (0, common_1.Query)('product_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "productDetails", null);
__decorate([
    (0, common_1.Get)('product/search'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "productSearch", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('product/status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "productStatus", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('product/recommended'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "productRecommended", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('product/update-stock'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "updateStock", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('product/store'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileFieldsInterceptor)([
        { name: 'image', maxCount: 1 },
        { name: 'meta_image', maxCount: 1 },
    ], { limits: { fileSize: 5 * 1024 * 1024 } })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "productStore", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('product/update'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileFieldsInterceptor)([
        { name: 'image', maxCount: 1 },
        { name: 'meta_image', maxCount: 1 },
    ], { limits: { fileSize: 5 * 1024 * 1024 } })),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "productUpdate", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('product/delete'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "productDelete", null);
__decorate([
    (0, common_1.Get)('product/reviews'),
    __param(0, (0, common_1.Query)('product_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "productReviews", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('product/reply-update'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "productReply", null);
__decorate([
    (0, common_1.Get)('check-product-limits'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "productLimits", null);
__decorate([
    (0, common_1.Get)('categories'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "categories", null);
__decorate([
    (0, common_1.Get)('categories/childes'),
    __param(0, (0, common_1.Query)('parent_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "childCategories", null);
__decorate([
    (0, common_1.Get)('categories/category-wise-products'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "categoryProducts", null);
__decorate([
    (0, common_1.Get)('addon'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "vendorAddons", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('addon/store'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "addonStore", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('addon/update'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "addonUpdate", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('addon/delete'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "addonDelete", null);
__decorate([
    (0, common_1.Get)('attributes'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "attributes", null);
__decorate([
    (0, common_1.Get)('delivery-man/list'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "vendorDmList", null);
__decorate([
    (0, common_1.Get)('delivery-man/get-delivery-man-list'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "getDmList", null);
__decorate([
    (0, common_1.Get)('delivery-man/preview'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "dmPreview", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('delivery-man/store'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "dmStore", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('delivery-man/update'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "dmUpdate", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('delivery-man/delete'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "dmDelete", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('delivery-man/status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "dmStatus", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('delivery-man/assign-deliveryman'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "dmAssign", null);
__decorate([
    (0, common_1.Get)('coupon-list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "vendorCouponList", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('coupon-store'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "vendorCouponStore", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('coupon-update'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "vendorCouponUpdate", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('coupon-status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "vendorCouponStatus", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('coupon-delete'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "vendorCouponDelete", null);
__decorate([
    (0, common_1.Get)('coupon/view-without-translate'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "vendorCouponView", null);
__decorate([
    (0, common_1.Get)('wallet-payment-list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "walletPaymentList", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('make-collected-cash-payment'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "collectedCash", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('make-wallet-adjustment'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "walletAdjustment", null);
__decorate([
    (0, common_1.Get)('withdraw-method/list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "withdrawMethods", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('withdraw-method/store'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "withdrawStore", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('withdraw-method/make-default'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "withdrawDefault", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('withdraw-method/delete'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "withdrawDelete", null);
__decorate([
    (0, common_1.Get)('get-withdraw-method-list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "getWithdrawMethods", null);
__decorate([
    (0, common_1.Get)('get-withdraw-list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "getWithdrawList", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('request-withdraw'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "requestWithdraw", null);
__decorate([
    (0, common_1.Get)('earning-report'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "earningReport", null);
__decorate([
    (0, common_1.Get)('get-order-report'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "orderReport", null);
__decorate([
    (0, common_1.Get)('get-food-wise-report'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "foodReport", null);
__decorate([
    (0, common_1.Get)('get-campaign-order-report'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "campaignReport", null);
__decorate([
    (0, common_1.Get)('get-tax-report'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "taxReport", null);
__decorate([
    (0, common_1.Get)('get-disbursement-report'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "disbursementReport", null);
__decorate([
    (0, common_1.Get)('get-expense'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "expenseReport", null);
__decorate([
    (0, common_1.Get)('get-transaction-report'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "transactionReport", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('generate-transaction-statement'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "generateStatement", null);
__decorate([
    (0, common_1.Get)('get-searched-food'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "searchedFood", null);
__decorate([
    (0, common_1.Get)('notifications'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "vendorNotifications", null);
__decorate([
    (0, common_1.Get)('message/list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "messageList", null);
__decorate([
    (0, common_1.Get)('message/details'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "messageDetails", null);
__decorate([
    (0, common_1.Get)('message/search-list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "messageSearch", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('message/send'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "messageSend", null);
__decorate([
    (0, common_1.Get)('get-basic-campaigns'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "basicCampaigns", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('campaign-join'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "campaignJoin", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('campaign-leave'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "campaignLeave", null);
__decorate([
    (0, common_1.Get)('advertisement'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "ads", null);
__decorate([
    (0, common_1.Get)('advertisement/details'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "adDetails", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('advertisement/store'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "adStore", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('advertisement/update'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "adUpdate", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('advertisement/status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "adStatus", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('advertisement/copy-add-post'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "adCopy", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('advertisement/delete'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "adDelete", null);
__decorate([
    (0, common_1.Get)('business_plan'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "businessPlan", null);
__decorate([
    (0, common_1.Get)('package-view'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "packageView", null);
__decorate([
    (0, common_1.Get)('subscription-transaction'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "subscriptionTransactionsList", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('subscription-transaction'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "subscriptionTransaction", null);
__decorate([
    (0, common_1.Get)('subscription/payment/api'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "subscriptionPayment", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('cancel-subscription'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "cancelSubscription", null);
__decorate([
    (0, common_1.Get)('schedule'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "schedule", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('schedule/store'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "scheduleStore", null);
__decorate([
    (0, common_1.Get)('pos/customers'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "posCustomers", null);
__decorate([
    (0, common_1.Get)('pos/orders'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "posOrders", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('pos/place-order'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "posPlaceOrder", null);
__decorate([
    (0, common_1.Get)('get-characteristic-suggestion'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "characteristicSuggestions", null);
exports.VendorExtrasController = VendorExtrasController = __decorate([
    (0, common_1.Controller)('vendor'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, auth_guard_1.RequireAuth)('vendor'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        mongo_data_service_1.MongoDataService])
], VendorExtrasController);
//# sourceMappingURL=vendor-extras.controller.js.map