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
var VendorExtrasController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorExtrasController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const messaging_helper_1 = require("./messaging.helper");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const auth_guard_1 = require("../auth/auth.guard");
const prisma_service_1 = require("../prisma/prisma.service");
const mongo_data_service_1 = require("../mongo/mongo-data.service");
const storage_url_1 = require("../common/storage-url");
const image_compress_1 = require("../common/image-compress");
const toNum = (v) => {
    if (v === null || v === undefined)
        return 0;
    if (typeof v === 'number')
        return v;
    if (typeof v === 'string')
        return Number(v) || 0;
    return Number(v) || 0;
};
const vegNonVegFlag = (v) => {
    if (v === null || v === undefined)
        return 1;
    return Number(v) ? 1 : 0;
};
let VendorExtrasController = class VendorExtrasController {
    static { VendorExtrasController_1 = this; }
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
    async vendorRestaurant(req) {
        if (!this.useMongo())
            return null;
        return this.mongo.findOne('restaurants', { mysql_vendor_id: Number(req.actor.id) });
    }
    async vendorRestaurantIds(req) {
        if (!this.useMongo())
            return [];
        const rows = await this.mongo.findMany('restaurants', { mysql_vendor_id: Number(req.actor.id) });
        return rows.map((r) => Number(r.mysql_id));
    }
    static ONGOING_STATUSES = [
        'pending', 'confirmed', 'accepted', 'processing', 'cooking', 'handover', 'picked_up',
    ];
    async hashPassword(raw) {
        const bcrypt = await import('bcrypt');
        return (await bcrypt.hash(raw, 10)).replace(/^\$2b\$/, '$2y$');
    }
    parseJsonish(input) {
        if (Array.isArray(input))
            return input;
        if (typeof input === 'string' && input.trim()) {
            try {
                const parsed = JSON.parse(input);
                return Array.isArray(parsed) ? parsed : [];
            }
            catch {
                return input.split(',').map((s) => s.trim()).filter(Boolean);
            }
        }
        return [];
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
            let totalEarning = toNum(wallet?.total_earning);
            let balance = toNum(wallet?.balance);
            let cashInHands = toNum(wallet?.collected_cash);
            const alreadyWithdrawn = toNum(wallet?.total_withdrawn);
            const pendingWithdraw = toNum(wallet?.pending_withdraw);
            const [productCount, reviewCount] = restaurantIds.length > 0
                ? await Promise.all([
                    this.mongo.count('foods', { $or: [{ mysql_restaurant_id: { $in: restaurantIds } }, { restaurant_id: { $in: restaurantIds } }] }),
                    this.mongo.count('reviews', { $or: [{ mysql_restaurant_id: { $in: restaurantIds } }, { restaurant_id: { $in: restaurantIds } }] }),
                ])
                : [0, 0];
            const commissionMap = new Map(restaurants.map((r) => [Number(r.mysql_id), Number(r.comission ?? 0) || 10]));
            let todaysCount = 0, weekCount = 0, monthCount = 0, totalOrders = 0;
            let todaysEarn = 0, weekEarn = 0, monthEarn = 0;
            let computedEarning = 0, computedCash = 0;
            if (restaurantIds.length > 0) {
                const now = Date.now();
                const dayMs = 86_400_000;
                const orders = await this.mongo.findMany('orders', { mysql_restaurant_id: { $in: restaurantIds } });
                totalOrders = orders.length;
                for (const o of orders) {
                    const ts = o.created_at ? new Date(o.created_at).getTime() : 0;
                    const delivered = o.order_status === 'delivered';
                    const amount = toNum(o.order_amount);
                    if (delivered) {
                        const tax = toNum(o.total_tax_amount), delivery = toNum(o.delivery_charge);
                        const coupon = toNum(o.coupon_discount_amount), restDisc = toNum(o.restaurant_discount_amount), extra = toNum(o.additional_charge);
                        let item = amount + coupon + restDisc - tax - delivery - extra;
                        if (item <= 0)
                            item = Math.max(0, amount - tax - delivery) || amount;
                        const rate = commissionMap.get(Number(o.mysql_restaurant_id)) ?? 10;
                        computedEarning += item - (item * rate) / 100;
                        if (String(o.payment_method) === 'cash_on_delivery')
                            computedCash += amount;
                    }
                    if (!Number.isFinite(ts) || ts === 0)
                        continue;
                    const age = now - ts;
                    if (age <= dayMs) {
                        todaysCount++;
                        if (delivered)
                            todaysEarn += amount;
                    }
                    if (age <= 7 * dayMs) {
                        weekCount++;
                        if (delivered)
                            weekEarn += amount;
                    }
                    if (age <= 30 * dayMs) {
                        monthCount++;
                        if (delivered)
                            monthEarn += amount;
                    }
                }
            }
            const round2 = (n) => Math.round(n * 100) / 100;
            if (totalEarning <= 0 && computedEarning > 0) {
                totalEarning = round2(computedEarning);
                cashInHands = round2(computedCash);
                balance = round2(Math.max(0, computedEarning - alreadyWithdrawn - pendingWithdraw));
            }
            const vCreatedAt = v.created_at;
            const memberSince = vCreatedAt
                ? Math.max(0, Math.floor((Date.now() - new Date(vCreatedAt).getTime()) / 86_400_000))
                : 30;
            let subscription = null;
            let subscriptionOtherData = null;
            const subResto = restaurants.find((r) => Number(r.subscription_id ?? 0) > 0);
            if (subResto) {
                const sr = subResto;
                const pkgId = Number(sr.subscription_id);
                const pkg = await this.mongo.findByMysqlId('subscription_packages', pkgId);
                if (pkg) {
                    const feat = (k) => (Number(pkg[k] ?? 0) ? 1 : 0);
                    const packagePayload = {
                        id: pkgId,
                        package_name: pkg.package_name ?? 'Plan',
                        price: toNum(pkg.price),
                        validity: Number(pkg.validity ?? 30),
                        max_order: pkg.max_order ?? 'unlimited',
                        max_product: pkg.max_product ?? 'unlimited',
                        pos: feat('pos'), mobile_app: feat('mobile_app'), chat: feat('chat'),
                        review: feat('review'), self_delivery: feat('self_delivery'),
                        status: 1,
                        default: Number(pkg.default ?? 0) ? 1 : 0,
                        colour: pkg.colour ?? null,
                        text: pkg.text ?? null,
                        created_at: pkg.created_at ?? null,
                        updated_at: pkg.updated_at ?? null,
                    };
                    subscription = {
                        id: pkgId,
                        package_id: pkgId,
                        restaurant_id: Number(sr.mysql_id),
                        expiry_date: sr.subscription_expiry_date ?? null,
                        max_order: pkg.max_order ?? 'unlimited',
                        max_product: pkg.max_product ?? 'unlimited',
                        pos: feat('pos'), mobile_app: feat('mobile_app'), chat: feat('chat'),
                        review: feat('review'), self_delivery: feat('self_delivery'),
                        status: 1, is_trial: 0, total_package_renewed: 0,
                        created_at: sr.created_at ?? null, updated_at: sr.updated_at ?? null,
                        renewed_at: null, is_canceled: 0, canceled_by: null,
                        validity: Number(pkg.validity ?? 30),
                        package: packagePayload,
                    };
                    subscriptionOtherData = { total_bill: toNum(pkg.price), max_product_uploads: 0, pending_bill: 0 };
                }
            }
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
                product_count: productCount,
                review_count: reviewCount,
                todays_order_count: todaysCount,
                this_week_order_count: weekCount,
                this_month_order_count: monthCount,
                todays_earning: todaysEarn,
                this_week_earning: weekEarn,
                this_month_earning: monthEarn,
                member_since_days: memberSince,
                subscription,
                subscription_other_data: subscriptionOtherData,
                subscription_transactions: false,
                roles: [],
                employee_info: null,
                image_full_url: this.buildStorageUrl('profile', v.image),
                restaurants: restaurants.map((r) => {
                    const rr = r;
                    return {
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
                        delivery: rr.delivery ?? false,
                        take_away: rr.take_away ?? false,
                        restaurant_model: r.restaurant_model ?? null,
                        opening_closing_status: rr.opening_closing_status ?? false,
                        same_time_for_every_day: rr.same_time_for_every_day ?? false,
                        veg: vegNonVegFlag(rr.veg),
                        non_veg: vegNonVegFlag(rr.non_veg),
                        free_delivery: rr.free_delivery ?? false,
                        schedule_order: rr.schedule_order ?? false,
                        instant_order: rr.instant_order ?? false,
                        order_subscription_active: rr.order_subscription_active ?? false,
                        cutlery: rr.cutlery ?? false,
                        halal_tag_status: rr.halal_tag_status ?? false,
                        gst_status: rr.gst_status ?? false,
                        gst_code: rr.gst_code ?? rr.gst ?? null,
                        self_delivery_system: rr.self_delivery_system ?? false,
                        is_dine_in_active: rr.is_dine_in_active ?? false,
                        is_extra_packaging_active: rr.is_extra_packaging_active ?? false,
                        extra_packaging_status: toNum(rr.extra_packaging_status),
                        extra_packaging_amount: toNum(rr.extra_packaging_amount),
                        schedule_advance_dine_in_booking_duration: toNum(rr.schedule_advance_dine_in_booking_duration),
                        schedule_advance_dine_in_booking_duration_time_format: rr.schedule_advance_dine_in_booking_duration_time_format ?? 'hours',
                        customer_date_order_sratus: rr.customer_date_order_sratus ?? false,
                        customer_order_date: toNum(rr.customer_order_date),
                        free_delivery_distance_status: rr.free_delivery_distance_status ?? false,
                        free_delivery_distance_value: toNum(rr.free_delivery_distance_value),
                        minimum_shipping_charge: toNum(rr.minimum_shipping_charge),
                        maximum_shipping_charge: toNum(rr.maximum_shipping_charge),
                        per_km_shipping_charge: toNum(rr.per_km_shipping_charge),
                        delivery_time: rr.delivery_time ?? '30-40',
                        characteristics: Array.isArray(rr.characteristics) ? rr.characteristics : [],
                        tags: Array.isArray(rr.tags) ? rr.tags : [],
                        cuisine: [],
                        schedules: Array.isArray(rr.schedules) ? rr.schedules : [],
                    };
                }),
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
        const avatarName = await this.saveUploaded(files?.image?.[0], 'profile');
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
    async fcmToken(req, body = {}) {
        const token = body?.fcm_token ?? body?.cm_firebase_token ?? body?.token;
        if (this.useMongo() && token !== undefined) {
            await this.mongo.updateOne('vendors', { mysql_id: Number(req.actor.id) }, { fcm_token: String(token), updated_at: new Date() });
        }
        return { message: 'token-updated' };
    }
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
    async toggleOpen(req, body = {}) {
        if (this.useMongo()) {
            const r = await this.vendorRestaurant(req);
            if (r) {
                const update = { updated_at: new Date() };
                if (body.opening_closing_status !== undefined) {
                    update.opening_closing_status = !!Number(body.opening_closing_status);
                }
                if (body.same_time_for_every_day !== undefined) {
                    update.same_time_for_every_day = !!Number(body.same_time_for_every_day);
                }
                if (body.active !== undefined || body.status !== undefined) {
                    update.active = body.active !== undefined ? !!Number(body.active) : !!Number(body.status);
                }
                if (Object.keys(update).length === 1) {
                    update.active = !(r.active ?? true);
                }
                await this.mongo.updateOne('restaurants', { mysql_id: r.mysql_id }, update);
                return { message: 'updated', ...(update.active !== undefined ? { active: update.active } : {}) };
            }
        }
        return { message: 'updated' };
    }
    async announce(req, body = {}) {
        if (this.useMongo()) {
            const r = await this.vendorRestaurant(req);
            if (r) {
                await this.mongo.updateOne('restaurants', { mysql_id: r.mysql_id }, {
                    announcement: !!Number(body.announcement_status ?? body.announcement ?? 0),
                    announcement_message: body.announcement_message !== undefined ? String(body.announcement_message) : null,
                    updated_at: new Date(),
                });
            }
        }
        return { message: 'announcement updated' };
    }
    async bankInfo(req, body = {}) {
        if (this.useMongo()) {
            const data = {};
            for (const k of ['bank_name', 'branch', 'holder_name', 'account_no']) {
                if (body[k] !== undefined)
                    data[k] = String(body[k]);
            }
            if (Object.keys(data).length > 0) {
                data.updated_at = new Date();
                await this.mongo.updateOne('vendors', { mysql_id: Number(req.actor.id) }, data);
            }
        }
        return { message: 'bank info updated' };
    }
    buildStorageUrl(folder, filename) {
        if (filename && /^https?:\/\//i.test(String(filename)))
            return String(filename);
        const safeName = filename && String(filename).trim() ? String(filename) : 'default.png';
        return `${(0, storage_url_1.storageBaseUrl)()}/${folder}/${safeName}`;
    }
    storageDir(folder) {
        const root = process.env.STORAGE_ROOT
            ?? path.resolve(__dirname, '../../storage/app/public');
        const dir = path.join(root, folder);
        fs.mkdirSync(dir, { recursive: true });
        return dir;
    }
    async saveUploaded(file, folder) {
        if (!file || !file.buffer || file.buffer.length === 0)
            return null;
        let data = file.buffer;
        let ext = path.extname(file.originalname || '').toLowerCase() || '.png';
        let contentType = file.mimetype || 'image/png';
        if (/^image\//i.test(contentType) && !/svg/i.test(contentType)) {
            const compressed = await (0, image_compress_1.compressImage)(file.buffer);
            if (compressed) {
                data = compressed.buffer;
                ext = compressed.ext;
                contentType = compressed.contentType;
            }
        }
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        try {
            fs.writeFileSync(path.join(this.storageDir(folder), filename), data);
        }
        catch { }
        if (this.useMongo() && data.length < 15 * 1024 * 1024) {
            this.mongo.insertOne('uploads', {
                path: `${folder}/${filename}`,
                content_type: contentType,
                data,
                size: data.length,
                created_at: new Date(),
            }).catch(() => undefined);
        }
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
        const logoName = await this.saveUploaded(files?.logo?.[0], 'restaurant');
        const coverName = await this.saveUploaded(files?.cover_photo?.[0], 'restaurant/cover');
        const metaName = await this.saveUploaded(files?.meta_image?.[0], 'restaurant');
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
        const has = (k) => b[k] !== undefined && b[k] !== '';
        const numMap = {
            minimum_order: 'minimum_order',
            minimum_shipping_charge: 'minimum_shipping_charge',
            minimum_delivery_charge: 'minimum_shipping_charge',
            maximum_delivery_charge: 'maximum_shipping_charge',
            per_km_delivery_charge: 'per_km_shipping_charge',
            extra_packaging_amount: 'extra_packaging_amount',
            extra_packaging_status: 'extra_packaging_status',
            schedule_advance_dine_in_booking_duration: 'schedule_advance_dine_in_booking_duration',
            customer_order_date: 'customer_order_date',
            free_delivery_distance: 'free_delivery_distance_value',
        };
        for (const [src, dest] of Object.entries(numMap)) {
            if (has(src))
                data[dest] = Number(b[src]);
        }
        for (const k of [
            'delivery', 'take_away', 'free_delivery', 'veg', 'non_veg', 'self_delivery_system',
            'gst_status', 'cutlery', 'halal_tag_status', 'instant_order', 'order_subscription_active',
            'is_dine_in_active', 'is_extra_packaging_active', 'free_delivery_distance_status',
            'customer_date_order_sratus', 'schedule_order',
        ]) {
            if (has(k))
                data[k] = !!Number(b[k]);
        }
        if (b.restaurant_model !== undefined)
            data.restaurant_model = String(b.restaurant_model);
        if (b.delivery_time !== undefined)
            data.delivery_time = String(b.delivery_time);
        if (b.gst !== undefined)
            data.gst_code = String(b.gst);
        if (b.schedule_advance_dine_in_booking_duration_time_format !== undefined) {
            data.schedule_advance_dine_in_booking_duration_time_format = String(b.schedule_advance_dine_in_booking_duration_time_format);
        }
        const splitCsv = (s) => String(s ?? '').split(',').map((x) => x.trim()).filter(Boolean);
        if (b.characteristics !== undefined)
            data.characteristics = splitCsv(b.characteristics);
        if (b.tags !== undefined)
            data.tags = splitCsv(b.tags);
        if (b.cuisine_ids !== undefined) {
            try {
                const ids = JSON.parse(String(b.cuisine_ids));
                if (Array.isArray(ids))
                    data.cuisine_ids = ids.map((x) => Number(x)).filter((n) => Number.isFinite(n));
            }
            catch { }
        }
        if (Object.keys(data).length === 0)
            return { message: 'nothing to update' };
        data.updated_at = new Date();
        if (this.useMongo()) {
            await this.mongo.updateOne('restaurants', { mysql_vendor_id: Number(req.actor.id) }, data);
        }
        return { message: 'business setup updated' };
    }
    async addDineInTable(req, body = {}) {
        if (this.useMongo()) {
            const r = await this.vendorRestaurant(req);
            const table = body.table_number ?? body.number;
            if (r && table !== undefined && String(table).trim() !== '') {
                const existing = Array.isArray(r.dine_in_tables) ? r.dine_in_tables : [];
                const next = Array.from(new Set([...existing.map(String), String(table)]));
                await this.mongo.updateOne('restaurants', { mysql_id: r.mysql_id }, { dine_in_tables: next, updated_at: new Date() });
                return { message: 'added', tables: next };
            }
        }
        return { message: 'added' };
    }
    remove() { return { message: 'Not available in demo' }; }
    shapeOrder(rIn, detailsCount, user) {
        const r = rIn;
        const created = r.created_at;
        const updated = r.updated_at;
        const u = user ?? null;
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
    async vendorUserMap(orders) {
        const ids = Array.from(new Set(orders.map((o) => Number(o.mysql_user_id ?? 0)).filter((n) => n > 0)));
        if (ids.length === 0)
            return new Map();
        const rows = await this.mongo.findMany('users', { mysql_id: { $in: ids } });
        return new Map(rows.map((u) => [Number(u.mysql_id), u]));
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
            const restaurantIds = await this.vendorRestaurantIds(req);
            if (restaurantIds.length === 0)
                return [];
            const rows = await this.mongo.findMany('orders', { mysql_restaurant_id: { $in: restaurantIds }, order_status: { $in: VendorExtrasController_1.ONGOING_STATUSES } }, { sort: { mysql_id: -1 } });
            const countsByOrderId = await this.detailsCountMap(rows.map((r) => Number(r.mysql_id)));
            const userMap = await this.vendorUserMap(rows);
            return rows.map((r) => this.shapeOrder(r, countsByOrderId.get(Number(r.mysql_id)) ?? 1, userMap.get(Number(r.mysql_user_id ?? 0))));
        }
        const restaurant = await this.prisma.restaurants.findFirst({ where: { vendor_id: req.actor.id }, select: { id: true } });
        if (!restaurant)
            return [];
        const rows = await this.prisma.orders.findMany({
            where: { restaurant_id: restaurant.id, order_status: { in: VendorExtrasController_1.ONGOING_STATUSES } },
            orderBy: { id: 'desc' },
        });
        return rows.map((r) => ({ ...r, id: Number(r.id), user_id: r.user_id ? Number(r.user_id) : null, restaurant_id: Number(r.restaurant_id), order_amount: Number(r.order_amount) }));
    }
    async completedOrders(req) {
        if (this.useMongo()) {
            const restaurantIds = await this.vendorRestaurantIds(req);
            if (restaurantIds.length === 0)
                return { orders: [], total_size: 0 };
            const rows = await this.mongo.findMany('orders', { mysql_restaurant_id: { $in: restaurantIds }, order_status: { $in: ['delivered', 'canceled', 'refunded', 'failed'] } }, { sort: { mysql_id: -1 }, limit: 50 });
            const countsByOrderId = await this.detailsCountMap(rows.map((r) => Number(r.mysql_id)));
            const userMap = await this.vendorUserMap(rows);
            return {
                orders: rows.map((r) => this.shapeOrder(r, countsByOrderId.get(Number(r.mysql_id)) ?? 1, userMap.get(Number(r.mysql_user_id ?? 0)))),
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
            const userId = Number(o.mysql_user_id ?? 0);
            const user = userId > 0 ? await this.mongo.findByMysqlId('users', userId) : null;
            return this.shapeOrder(o, counts.get(Number(o.mysql_id)) ?? 1, user);
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
                products: rows.map((r) => {
                    const food = r;
                    return {
                        ...(food.legacy ?? {}),
                        ...food,
                        id: Number(food.mysql_id),
                        price: toNum(food.price) ?? 0,
                        tax: toNum(food.tax) ?? 0,
                        discount: toNum(food.discount) ?? 0,
                        restaurant_id: food.mysql_restaurant_id !== null && food.mysql_restaurant_id !== undefined ? Number(food.mysql_restaurant_id) : 0,
                        category_id: food.mysql_category_id !== null && food.mysql_category_id !== undefined ? Number(food.mysql_category_id) : null,
                        rating_count: Number(food.rating_count ?? 0),
                        avg_rating: Number(food.avg_rating ?? 0),
                        rating: food.rating ?? [],
                        image: food.image ?? 'default.png',
                        image_full_url: this.buildStorageUrl('product', food.image ?? null),
                        meta_image_full_url: this.buildStorageUrl('product', food.meta_image ?? null),
                        stock_type: food.stock_type ?? 'unlimited',
                        item_stock: Number(food.item_stock ?? 0),
                        sell_count: Number(food.sell_count ?? 0),
                        status: food.status ?? true,
                    };
                }),
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
            if (!f)
                return null;
            const food = f;
            return {
                ...(food.legacy ?? {}),
                ...food,
                id: Number(food.mysql_id),
                price: toNum(food.price) ?? 0,
                tax: toNum(food.tax) ?? 0,
                discount: toNum(food.discount) ?? 0,
                restaurant_id: food.mysql_restaurant_id !== null && food.mysql_restaurant_id !== undefined ? Number(food.mysql_restaurant_id) : 0,
                category_id: food.mysql_category_id !== null && food.mysql_category_id !== undefined ? Number(food.mysql_category_id) : null,
                rating_count: Number(food.rating_count ?? 0),
                avg_rating: Number(food.avg_rating ?? 0),
                rating: food.rating ?? [],
                image: food.image ?? 'default.png',
                image_full_url: this.buildStorageUrl('product', food.image ?? null),
                meta_image_full_url: this.buildStorageUrl('product', food.meta_image ?? null),
                stock_type: food.stock_type ?? 'unlimited',
                item_stock: Number(food.item_stock ?? 0),
            };
        }
        const f = await this.prisma.food.findUnique({ where: { id: BigInt(id) } });
        return f ? { ...f, id: Number(f.id), price: Number(f.price), tax: Number(f.tax), discount: Number(f.discount), restaurant_id: Number(f.restaurant_id), category_id: f.category_id ? Number(f.category_id) : null } : null;
    }
    async productSearch(req, name) {
        if (this.useMongo()) {
            const restaurant = await this.vendorRestaurant(req);
            if (!restaurant)
                return { products: [], total_size: 0 };
            const filter = { mysql_restaurant_id: Number(restaurant.mysql_id) };
            if (name && name.trim())
                filter.name = { $regex: name.trim(), $options: 'i' };
            const rows = await this.mongo.findMany('foods', filter, { sort: { mysql_id: -1 }, limit: 50 });
            return {
                products: rows.map((r) => {
                    const food = r;
                    return {
                        ...(food.legacy ?? {}),
                        ...food,
                        id: Number(food.mysql_id),
                        price: toNum(food.price),
                        tax: toNum(food.tax),
                        discount: toNum(food.discount),
                        restaurant_id: food.mysql_restaurant_id ? Number(food.mysql_restaurant_id) : 0,
                        category_id: food.mysql_category_id ? Number(food.mysql_category_id) : null,
                        image: food.image ?? 'default.png',
                        image_full_url: this.buildStorageUrl('product', food.image ?? null),
                        status: food.status ?? true,
                    };
                }),
                total_size: rows.length,
            };
        }
        return { products: [], total_size: 0 };
    }
    productStatusGet(query = {}) {
        return this.productStatus({}, query);
    }
    async productStatus(body = {}, query = {}) {
        const src = { ...query, ...body };
        const id = src.id !== undefined && src.id !== '' ? Number(src.id) : null;
        if (this.useMongo() && id) {
            await this.mongo.updateOne('foods', { mysql_id: id }, { status: !!Number(src.status ?? 0), updated_at: new Date() });
        }
        return { message: 'updated' };
    }
    productRecommendedGet(query = {}) {
        return this.productRecommended({}, query);
    }
    async productRecommended(body = {}, query = {}) {
        const src = { ...query, ...body };
        const id = src.id !== undefined && src.id !== '' ? Number(src.id) : null;
        if (this.useMongo() && id) {
            const value = !!Number(src.is_recommended ?? src.recommended ?? src.status ?? 0);
            await this.mongo.updateOne('foods', { mysql_id: id }, { recommended: value, updated_at: new Date() });
        }
        return { message: 'updated' };
    }
    async updateStock(body = {}) {
        const id = body.id !== undefined && body.id !== '' ? Number(body.id) : null;
        if (this.useMongo() && id) {
            const data = { updated_at: new Date() };
            if (body.stock_type !== undefined)
                data.stock_type = String(body.stock_type);
            const stock = body.current_stock ?? body.item_stock ?? body.stock;
            if (stock !== undefined && stock !== '')
                data.item_stock = Number(stock);
            await this.mongo.updateOne('foods', { mysql_id: id }, data);
        }
        return { message: 'stock updated' };
    }
    async productStore(req, body = {}, files = {}) {
        if (!this.useMongo())
            return { message: 'product created' };
        const b = body ?? {};
        const restaurant = await this.mongo.findOne('restaurants', { mysql_vendor_id: Number(req.actor.id) });
        if (!restaurant)
            return { errors: [{ code: 'restaurant', message: 'restaurant not found' }] };
        const { name: trName, description: trDesc, translations } = this.parseProductTranslations(b.translations);
        const nextId = await this.mongo.nextMysqlId('foods');
        const imageName = await this.saveUploaded(files?.image?.[0], 'product') ?? 'default.png';
        const metaImage = await this.saveUploaded(files?.meta_image?.[0], 'product');
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
            maximum_cart_quantity: b.maximum_cart_quantity !== undefined && b.maximum_cart_quantity !== ''
                ? Number(b.maximum_cart_quantity) : null,
            is_halal: !!Number(b.is_halal ?? 0),
            tags: this.parseJsonish(b.tags),
            tag_ids: this.parseJsonish(b.tag_ids),
            sell_count: 0,
            avg_rating: 0,
            rating_count: 0,
            addon_ids: this.parseJsonish(b.addon_ids),
            variations: this.parseJsonish(b.variations),
            choice_options: this.parseJsonish(b.choice_options),
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
        const imageName = await this.saveUploaded(files?.image?.[0], 'product');
        const metaImage = await this.saveUploaded(files?.meta_image?.[0], 'product');
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
    async productDelete(body = {}, idQ) {
        const id = body.id !== undefined && body.id !== '' ? Number(body.id) : (idQ ? Number(idQ) : null);
        if (this.useMongo() && id) {
            await this.mongo.deleteOne('foods', { mysql_id: id });
        }
        return { message: 'product deleted' };
    }
    async productReviews(req, productIdStr, restaurantIdStr, search) {
        if (!this.useMongo()) {
            const pid = parseInt(productIdStr ?? '', 10);
            if (!Number.isFinite(pid))
                return [];
            const rows = await this.prisma.reviews.findMany({ where: { food_id: BigInt(pid) }, orderBy: { id: 'desc' }, take: 50 });
            return rows.map((r) => ({ id: Number(r.id), food_id: Number(r.food_id), user_id: Number(r.user_id), comment: r.comment, rating: r.rating, reply: r.reply }));
        }
        const productId = parseInt(productIdStr ?? '', 10);
        let restaurantId = parseInt(restaurantIdStr ?? '', 10);
        if (!Number.isFinite(restaurantId) && !Number.isFinite(productId)) {
            const rest = await this.vendorRestaurant(req).catch(() => null);
            if (rest)
                restaurantId = Number(rest.mysql_id);
        }
        let filter;
        if (Number.isFinite(productId)) {
            filter = { $or: [{ mysql_food_id: productId }, { food_id: productId }] };
        }
        else if (Number.isFinite(restaurantId)) {
            const foods = await this.mongo.findMany('foods', { mysql_restaurant_id: restaurantId });
            const foodIds = foods.map((f) => Number(f.mysql_id)).filter((n) => n > 0);
            const or = [{ mysql_restaurant_id: restaurantId }, { restaurant_id: restaurantId }];
            if (foodIds.length)
                or.push({ mysql_food_id: { $in: foodIds } }, { food_id: { $in: foodIds } });
            filter = { $or: or };
        }
        else {
            return [];
        }
        const rows = await this.mongo.findMany('reviews', filter, { sort: { mysql_id: -1 }, limit: 100 });
        if (rows.length === 0)
            return [];
        const foodIds = Array.from(new Set(rows.map((r) => Number(r.mysql_food_id ?? r.food_id ?? 0)).filter((n) => n > 0)));
        const userIds = Array.from(new Set(rows.map((r) => Number(r.mysql_user_id ?? r.user_id ?? 0)).filter((n) => n > 0)));
        const [foods, users] = await Promise.all([
            foodIds.length ? this.mongo.findMany('foods', { mysql_id: { $in: foodIds } }) : Promise.resolve([]),
            userIds.length ? this.mongo.findMany('users', { mysql_id: { $in: userIds } }) : Promise.resolve([]),
        ]);
        const foodMap = new Map(foods.map((f) => [Number(f.mysql_id), f]));
        const userMap = new Map(users.map((u) => [Number(u.mysql_id), u]));
        let shaped = rows.map((r) => {
            const fid = Number(r.mysql_food_id ?? r.food_id ?? 0);
            const uid = Number(r.mysql_user_id ?? r.user_id ?? 0);
            const food = foodMap.get(fid);
            const user = userMap.get(uid);
            const customerName = user ? `${user.f_name ?? ''} ${user.l_name ?? ''}`.trim() || null : null;
            return {
                id: Number(r.mysql_id),
                food_id: fid || null,
                user_id: uid || null,
                order_id: r.mysql_order_id ?? r.order_id ?? null,
                comment: r.comment ?? null,
                rating: r.rating ?? null,
                reply: r.reply ?? null,
                food_name: food?.name ?? null,
                food_image_full_url: (0, storage_url_1.storageFullUrl)('product', food?.image ?? null),
                customer_name: customerName,
                customer_phone: user?.phone ?? null,
                customer: user ? {
                    id: uid,
                    f_name: user.f_name ?? null,
                    l_name: user.l_name ?? null,
                    phone: user.phone ?? null,
                    image_full_url: (0, storage_url_1.storageFullUrl)('profile', user.image ?? null),
                } : null,
                created_at: r.created_at ?? null,
                updated_at: r.updated_at ?? null,
            };
        });
        const q = (search ?? '').trim().toLowerCase();
        if (q && q !== 'null') {
            shaped = shaped.filter((s) => String(s.order_id ?? '').includes(q) || (s.food_name ?? '').toLowerCase().includes(q));
        }
        return shaped;
    }
    async productReply(body = {}) {
        const id = body.id !== undefined && body.id !== '' ? Number(body.id) : null;
        if (this.useMongo() && id && body.reply !== undefined) {
            await this.mongo.updateOne('reviews', { mysql_id: id }, { reply: String(body.reply), updated_at: new Date() });
        }
        return { message: 'reply saved' };
    }
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
    async childCategoriesByPath(idStr) {
        const id = parseInt(idStr ?? '0', 10);
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('categories', { parent_id: id, status: true });
            return rows.map((r) => ({ id: Number(r.mysql_id), name: r.name ?? null, image: r.image ?? null, status: r.status ?? null }));
        }
        return this.prisma.categories.findMany({ where: { parent_id: id, status: true } }).then((rows) => rows.map((r) => ({ id: Number(r.id), name: r.name, image: r.image, status: r.status })));
    }
    async categoryProducts(req, categoryIdStr, limitStr, offsetStr) {
        const limit = parseInt(limitStr ?? '25', 10);
        const offset = parseInt(offsetStr ?? '1', 10);
        const categoryId = parseInt(categoryIdStr ?? '0', 10);
        if (!this.useMongo())
            return { total_size: 0, limit, offset, products: [] };
        const restaurant = await this.vendorRestaurant(req);
        if (!restaurant)
            return { total_size: 0, limit, offset, products: [] };
        const filter = { mysql_restaurant_id: Number(restaurant.mysql_id) };
        if (categoryId)
            filter.mysql_category_id = categoryId;
        const [rows, total] = await Promise.all([
            this.mongo.findMany('foods', filter, { sort: { mysql_id: -1 }, limit, skip: Math.max(0, (offset - 1) * limit) }),
            this.mongo.count('foods', filter),
        ]);
        return {
            total_size: total,
            limit,
            offset,
            products: rows.map((r) => {
                const food = r;
                return {
                    ...(food.legacy ?? {}),
                    ...food,
                    id: Number(food.mysql_id),
                    price: toNum(food.price),
                    tax: toNum(food.tax),
                    discount: toNum(food.discount),
                    restaurant_id: food.mysql_restaurant_id ? Number(food.mysql_restaurant_id) : 0,
                    category_id: food.mysql_category_id ? Number(food.mysql_category_id) : null,
                    rating_count: Number(food.rating_count ?? 0),
                    avg_rating: Number(food.avg_rating ?? 0),
                    rating: food.rating ?? [],
                    image: food.image ?? 'default.png',
                    image_full_url: this.buildStorageUrl('product', food.image ?? null),
                    stock_type: food.stock_type ?? 'unlimited',
                    item_stock: Number(food.item_stock ?? 0),
                    status: food.status ?? true,
                };
            }),
        };
    }
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
    async addonStore(req, body = {}) {
        if (!this.useMongo())
            return { message: 'addon created' };
        const restaurant = await this.vendorRestaurant(req);
        if (!restaurant)
            return { errors: [{ code: 'restaurant', message: 'restaurant not found' }] };
        if (!body.name || String(body.name).trim() === '') {
            return { errors: [{ code: 'name', message: 'addon name is required' }] };
        }
        const categoryId = body.addon_category_id ?? body.category_id;
        const stock = body.addon_stock ?? body.stock;
        const nextId = await this.mongo.nextMysqlId('add_ons');
        const now = new Date();
        await this.mongo.insertOne('add_ons', {
            mysql_id: nextId,
            mysql_restaurant_id: Number(restaurant.mysql_id),
            restaurant_id: Number(restaurant.mysql_id),
            mysql_addon_category_id: categoryId !== undefined && categoryId !== '' ? Number(categoryId) : null,
            addon_category_id: categoryId !== undefined && categoryId !== '' ? Number(categoryId) : null,
            name: String(body.name),
            price: Number(body.price ?? 0),
            tax: Number(body.tax ?? 0),
            stock_type: String(body.stock_type ?? 'unlimited'),
            addon_stock: Number(stock ?? 0),
            sell_count: 0,
            status: true,
            created_at: now,
            updated_at: now,
        });
        return { message: 'addon created', id: nextId };
    }
    addonUpdatePut(body = {}) {
        return this.addonUpdate(body);
    }
    async addonUpdate(body = {}) {
        if (!this.useMongo())
            return { message: 'addon updated' };
        const id = body.id !== undefined && body.id !== '' ? Number(body.id) : null;
        if (!id)
            return { errors: [{ code: 'id', message: 'addon id required' }] };
        const data = {};
        if (body.name !== undefined)
            data.name = String(body.name);
        if (body.price !== undefined && body.price !== '')
            data.price = Number(body.price);
        if (body.tax !== undefined && body.tax !== '')
            data.tax = Number(body.tax);
        if (body.stock_type !== undefined)
            data.stock_type = String(body.stock_type);
        if (body.addon_stock !== undefined && body.addon_stock !== '')
            data.addon_stock = Number(body.addon_stock);
        if (body.addon_category_id !== undefined && body.addon_category_id !== '')
            data.mysql_addon_category_id = Number(body.addon_category_id);
        if (Object.keys(data).length === 0)
            return { message: 'nothing to update' };
        data.updated_at = new Date();
        await this.mongo.updateOne('add_ons', { mysql_id: id }, data);
        return { message: 'addon updated' };
    }
    addonDeletePost(body = {}, idQ) {
        return this.addonDelete(body, idQ);
    }
    async addonDelete(body = {}, idQ) {
        const id = body.id !== undefined && body.id !== '' ? Number(body.id) : (idQ ? Number(idQ) : null);
        if (this.useMongo() && id)
            await this.mongo.deleteOne('add_ons', { mysql_id: id });
        return { message: 'addon deleted' };
    }
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
    async dmPreview(idStr) {
        const id = parseInt(idStr ?? '', 10);
        if (!this.useMongo() || !Number.isFinite(id))
            return null;
        const dm = await this.mongo.findByMysqlId('delivery_men', id);
        if (!dm)
            return null;
        return {
            id: Number(dm.mysql_id),
            f_name: dm.f_name ?? null,
            l_name: dm.l_name ?? null,
            phone: dm.phone ?? null,
            status: dm.status ?? null,
            application_status: dm.application_status ?? null,
        };
    }
    async dmStore(req, body = {}, files = {}) {
        if (!this.useMongo())
            return { message: 'delivery man created' };
        const restaurant = await this.vendorRestaurant(req);
        if (!restaurant)
            return { errors: [{ code: 'restaurant', message: 'restaurant not found' }] };
        if (!body.f_name || !body.phone) {
            return { errors: [{ code: 'input', message: 'first name and phone are required' }] };
        }
        const dup = await this.mongo.findOne('delivery_men', { phone: String(body.phone) });
        if (dup)
            return { errors: [{ code: 'phone', message: 'phone already in use' }] };
        const nextId = await this.mongo.nextMysqlId('delivery_men');
        const imageName = await this.saveUploaded(files?.image?.[0], 'delivery-man') ?? 'def.png';
        const now = new Date();
        const zoneId = restaurant.mysql_zone_id ?? restaurant.zone_id ?? 1;
        await this.mongo.insertOne('delivery_men', {
            mysql_id: nextId,
            f_name: String(body.f_name),
            l_name: String(body.l_name ?? ''),
            email: body.email ? String(body.email) : null,
            phone: String(body.phone),
            identity_number: body.identity_number ? String(body.identity_number) : null,
            identity_type: body.identity_type ? String(body.identity_type) : null,
            password: await this.hashPassword(String(body.password ?? '12345678')),
            image: imageName,
            mysql_zone_id: Number(zoneId),
            mysql_restaurant_id: Number(restaurant.mysql_id),
            restaurant_id: Number(restaurant.mysql_id),
            type: 'restaurant_wise',
            earning: false,
            application_status: 'approved',
            status: true,
            active: 0,
            created_at: now,
            updated_at: now,
        });
        return { message: 'delivery man created', id: nextId };
    }
    async dmUpdate(body = {}, files = {}) {
        if (!this.useMongo())
            return { message: 'updated' };
        const id = body.id !== undefined && body.id !== '' ? Number(body.id) : null;
        if (!id)
            return { errors: [{ code: 'id', message: 'delivery man id required' }] };
        const data = {};
        for (const k of ['f_name', 'l_name', 'email', 'phone', 'identity_number', 'identity_type']) {
            if (body[k] !== undefined)
                data[k] = String(body[k]);
        }
        if (body.password !== undefined && String(body.password).length > 1) {
            data.password = await this.hashPassword(String(body.password));
        }
        const imageName = await this.saveUploaded(files?.image?.[0], 'delivery-man');
        if (imageName)
            data.image = imageName;
        if (Object.keys(data).length === 0)
            return { message: 'nothing to update' };
        data.updated_at = new Date();
        await this.mongo.updateOne('delivery_men', { mysql_id: id }, data);
        return { message: 'updated' };
    }
    async dmDelete(body = {}, idQ) {
        const id = body.id !== undefined && body.id !== '' ? Number(body.id) : (idQ ? Number(idQ) : null);
        if (this.useMongo() && id)
            await this.mongo.deleteOne('delivery_men', { mysql_id: id });
        return { message: 'deleted' };
    }
    async dmStatus(body = {}) {
        const id = body.id !== undefined && body.id !== '' ? Number(body.id) : null;
        if (this.useMongo() && id) {
            await this.mongo.updateOne('delivery_men', { mysql_id: id }, { status: !!Number(body.status ?? 0), updated_at: new Date() });
        }
        return { message: 'status updated' };
    }
    async dmAssign(body = {}) {
        if (!this.useMongo())
            return { message: 'assigned' };
        const orderId = body.order_id !== undefined && body.order_id !== '' ? Number(body.order_id) : null;
        const dmId = body.delivery_man_id !== undefined && body.delivery_man_id !== '' ? Number(body.delivery_man_id) : null;
        if (orderId && dmId) {
            await this.mongo.updateOne('orders', { mysql_id: orderId }, {
                mysql_delivery_man_id: dmId,
                delivery_man_id: dmId,
                updated_at: new Date(),
            });
        }
        return { message: 'assigned' };
    }
    shapeCoupon(r) {
        return {
            id: Number(r.mysql_id),
            title: r.title ?? null,
            code: r.code ?? null,
            coupon_type: r.coupon_type ?? 'restaurant_wise',
            discount: toNum(r.discount),
            discount_type: r.discount_type ?? 'amount',
            min_purchase: toNum(r.min_purchase),
            max_discount: toNum(r.max_discount),
            start_date: r.start_date ?? null,
            expire_date: r.expire_date ?? null,
            limit: r.limit ?? null,
            status: r.status ?? true,
            total_uses: r.total_uses ? Number(r.total_uses) : 0,
            restaurant_id: r.mysql_restaurant_id ?? r.restaurant_id ?? null,
        };
    }
    async vendorCouponList(req) {
        if (!this.useMongo())
            return [];
        const vendorId = Number(req.actor.id);
        const restaurant = await this.vendorRestaurant(req);
        const restaurantIds = restaurant
            ? (await this.mongo.findMany('restaurants', { mysql_vendor_id: vendorId }))
                .map((r) => Number(r.mysql_id))
            : [];
        const or = [{ mysql_vendor_id: vendorId }];
        if (restaurantIds.length > 0)
            or.push({ mysql_restaurant_id: { $in: restaurantIds } });
        const rows = await this.mongo.findMany('coupons', { $or: or }, { sort: { mysql_id: -1 } });
        return rows.map((r) => ({
            ...this.shapeCoupon(r),
            data: r.data ?? null,
            customer_id: r.customer_id ?? ['all'],
            restaurant_name: restaurant?.name ?? null,
        }));
    }
    async vendorCouponStore(req, body = {}) {
        if (!this.useMongo())
            return { message: 'coupon created' };
        const restaurant = await this.vendorRestaurant(req);
        if (!restaurant)
            return { errors: [{ code: 'restaurant', message: 'restaurant not found' }] };
        let title = body.title ? String(body.title) : '';
        if (!title && body.translations !== undefined) {
            try {
                const arr = typeof body.translations === 'string' ? JSON.parse(body.translations) : body.translations;
                if (Array.isArray(arr)) {
                    const en = arr.find((t) => t && t.key === 'title' && (t.locale === 'en' || !t.locale) && t.value);
                    const any = arr.find((t) => t && t.key === 'title' && t.value);
                    title = String((en?.value ?? any?.value) ?? '');
                }
            }
            catch { }
        }
        if (!title || !body.code) {
            return { errors: [{ code: 'input', message: 'title and code are required' }] };
        }
        const dup = await this.mongo.findOne('coupons', { code: String(body.code) });
        if (dup)
            return { errors: [{ code: 'code', message: 'coupon code already exists' }] };
        const nextId = await this.mongo.nextMysqlId('coupons');
        const now = new Date();
        await this.mongo.insertOne('coupons', {
            mysql_id: nextId,
            title,
            code: String(body.code),
            coupon_type: body.coupon_type ? String(body.coupon_type) : 'default',
            mysql_restaurant_id: Number(restaurant.mysql_id),
            restaurant_id: Number(restaurant.mysql_id),
            mysql_vendor_id: Number(req.actor.id),
            discount: Number(body.discount ?? 0),
            discount_type: String(body.discount_type ?? 'amount'),
            min_purchase: Number(body.min_purchase ?? 0),
            max_discount: Number(body.max_discount ?? 0),
            start_date: body.start_date ? new Date(String(body.start_date)) : null,
            expire_date: body.expire_date ? new Date(String(body.expire_date)) : (body.end_date ? new Date(String(body.end_date)) : null),
            limit: body.limit !== undefined && body.limit !== '' ? Number(body.limit) : null,
            status: true,
            created_by: 'vendor',
            total_uses: 0,
            created_at: now,
            updated_at: now,
        });
        return { message: 'coupon created', id: nextId };
    }
    vendorCouponUpdatePut(body = {}) {
        return this.vendorCouponUpdate(body);
    }
    async vendorCouponUpdate(body = {}) {
        if (!this.useMongo())
            return { message: 'coupon updated' };
        const id = body.id !== undefined && body.id !== '' ? Number(body.id) : null;
        if (!id)
            return { errors: [{ code: 'id', message: 'coupon id required' }] };
        const data = {};
        if (body.title !== undefined)
            data.title = String(body.title);
        if (body.discount !== undefined && body.discount !== '')
            data.discount = Number(body.discount);
        if (body.discount_type !== undefined)
            data.discount_type = String(body.discount_type);
        if (body.min_purchase !== undefined && body.min_purchase !== '')
            data.min_purchase = Number(body.min_purchase);
        if (body.max_discount !== undefined && body.max_discount !== '')
            data.max_discount = Number(body.max_discount);
        if (body.start_date !== undefined && body.start_date !== '')
            data.start_date = new Date(String(body.start_date));
        const expiry = body.expire_date ?? body.end_date;
        if (expiry !== undefined && expiry !== '')
            data.expire_date = new Date(String(expiry));
        if (body.limit !== undefined && body.limit !== '')
            data.limit = Number(body.limit);
        if (Object.keys(data).length === 0)
            return { message: 'nothing to update' };
        data.updated_at = new Date();
        await this.mongo.updateOne('coupons', { mysql_id: id }, data);
        return { message: 'coupon updated' };
    }
    async vendorCouponStatus(body = {}) {
        const id = body.id !== undefined && body.id !== '' ? Number(body.id) : null;
        if (this.useMongo() && id) {
            await this.mongo.updateOne('coupons', { mysql_id: id }, { status: !!Number(body.status ?? 0), updated_at: new Date() });
        }
        return { message: 'status updated' };
    }
    vendorCouponDeletePost(body = {}, idQ) {
        return this.vendorCouponDelete(body, idQ);
    }
    async vendorCouponDelete(body = {}, idQ) {
        const id = body.id !== undefined && body.id !== '' ? Number(body.id) : (idQ ? Number(idQ) : null);
        if (this.useMongo() && id)
            await this.mongo.deleteOne('coupons', { mysql_id: id });
        return { message: 'coupon deleted' };
    }
    async vendorCouponView(idStr) {
        const id = parseInt(idStr ?? '', 10);
        if (!this.useMongo() || !Number.isFinite(id))
            return {};
        const c = await this.mongo.findByMysqlId('coupons', id);
        return c ? this.shapeCoupon(c) : {};
    }
    async walletPaymentList(req, offsetQ, limitQ) {
        if (!this.useMongo())
            return { total_size: 0, limit: 10, offset: 1, transactions: [] };
        const vendorId = Number(req.actor.id);
        const restaurants = await this.mongo.findMany('restaurants', { mysql_vendor_id: vendorId });
        const restaurantIds = restaurants.map((r) => Number(r.mysql_id));
        if (restaurantIds.length === 0)
            return { total_size: 0, limit: 10, offset: 1, transactions: [] };
        const commissionMap = new Map(restaurants.map((r) => [Number(r.mysql_id), Number(r.comission ?? 0) || 10]));
        const limit = parseInt(limitQ ?? '25', 10) || 25;
        const offset = parseInt(offsetQ ?? '1', 10) || 1;
        const orders = await this.mongo.findMany('orders', { mysql_restaurant_id: { $in: restaurantIds }, order_status: 'delivered' }, { sort: { mysql_id: -1 } });
        const round2 = (n) => Math.round(n * 100) / 100;
        let running = 0;
        const all = orders.map((o) => {
            const amount = toNum(o.order_amount);
            const tax = toNum(o.total_tax_amount), delivery = toNum(o.delivery_charge);
            const coupon = toNum(o.coupon_discount_amount), restDisc = toNum(o.restaurant_discount_amount), extra = toNum(o.additional_charge);
            let item = amount + coupon + restDisc - tax - delivery - extra;
            if (item <= 0)
                item = Math.max(0, amount - tax - delivery) || amount;
            const rate = commissionMap.get(Number(o.mysql_restaurant_id)) ?? 10;
            const earn = round2(item - (item * rate) / 100);
            running = round2(running + earn);
            const created = (o.created_at ?? o.delivered ?? null);
            const method = String(o.payment_method ?? 'cash_on_delivery');
            return {
                id: Number(o.mysql_id),
                from_type: 'order',
                from_id: Number(o.mysql_id),
                current_balance: running,
                amount: earn,
                method,
                ref: `#${Number(o.mysql_id)}`,
                created_at: created,
                updated_at: created,
                type: 'credit',
                created_by: 'order',
                payment_method: method,
                status: 'success',
                payment_time: created,
            };
        });
        const page = all.slice(Math.max(0, (offset - 1) * limit), Math.max(0, (offset - 1) * limit) + limit);
        return { total_size: all.length, limit, offset, transactions: page };
    }
    collectedCash() { return { message: 'recorded' }; }
    walletAdjustment() { return { message: 'recorded' }; }
    async activeWithdrawalMethods() {
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
    getWithdrawMethods() { return this.activeWithdrawalMethods(); }
    async withdrawMethods(req) {
        if (!this.useMongo())
            return { total_size: 0, limit: 10, offset: 1, methods: [] };
        const vendorId = Number(req.actor.id);
        const rows = await this.mongo.findMany('withdraw_methods', { mysql_vendor_id: vendorId }, { sort: { mysql_id: -1 } });
        return {
            total_size: rows.length,
            limit: 10,
            offset: 1,
            methods: rows.map((r) => ({
                id: Number(r.mysql_id),
                restaurant_id: r.mysql_restaurant_id ?? null,
                delivery_man_id: null,
                withdrawal_method_id: r.mysql_withdrawal_method_id ?? r.withdrawal_method_id ?? null,
                method_name: r.method_name ?? null,
                method_fields: Array.isArray(r.method_fields) ? r.method_fields : [],
                is_default: r.is_default ?? 0,
                created_at: r.created_at ?? null,
                updated_at: r.updated_at ?? null,
            })),
        };
    }
    async withdrawStore(req, body = {}) {
        if (!this.useMongo())
            return { message: 'method added' };
        const vendorId = Number(req.actor.id);
        const restaurant = await this.vendorRestaurant(req).catch(() => null);
        const methodId = Number(body.withdraw_method_id ?? body.withdrawal_method_id ?? 0);
        if (!methodId)
            return { errors: [{ code: 'withdraw_method_id', message: 'select a payment method' }] };
        const def = await this.mongo.findByMysqlId('withdrawal_methods', methodId);
        const fieldDefs = (Array.isArray(def?.method_fields) ? def.method_fields : []);
        const methodFields = fieldDefs.map((f) => ({
            user_input: f.placeholder ?? f.input_name ?? '',
            user_data: body[String(f.input_name)] !== undefined ? String(body[String(f.input_name)]) : '',
        }));
        const existing = await this.mongo.count('withdraw_methods', { mysql_vendor_id: vendorId });
        const nextId = await this.mongo.nextMysqlId('withdraw_methods');
        const now = new Date();
        await this.mongo.insertOne('withdraw_methods', {
            mysql_id: nextId,
            mysql_vendor_id: vendorId,
            mysql_restaurant_id: restaurant ? Number(restaurant.mysql_id) : null,
            mysql_withdrawal_method_id: methodId,
            withdrawal_method_id: methodId,
            method_name: def?.method_name ?? null,
            method_fields: methodFields,
            is_default: existing === 0 ? 1 : 0,
            created_at: now,
            updated_at: now,
        });
        return { message: 'method added', id: nextId };
    }
    async withdrawDefault(req, body = {}) {
        if (!this.useMongo())
            return { message: 'default set' };
        const vendorId = Number(req.actor.id);
        const id = Number(body.id ?? 0);
        if (!id)
            return { errors: [{ code: 'id', message: 'id required' }] };
        const all = await this.mongo.findMany('withdraw_methods', { mysql_vendor_id: vendorId });
        for (const m of all) {
            await this.mongo.updateOne('withdraw_methods', { mysql_id: Number(m.mysql_id) }, { is_default: Number(m.mysql_id) === id ? 1 : 0 });
        }
        return { message: 'default set' };
    }
    async withdrawDelete(req, body = {}) {
        if (!this.useMongo())
            return { message: 'deleted' };
        const vendorId = Number(req.actor.id);
        const id = Number(body.id ?? 0);
        if (!id)
            return { errors: [{ code: 'id', message: 'id required' }] };
        await this.mongo.deleteOne('withdraw_methods', { mysql_id: id, mysql_vendor_id: vendorId });
        return { message: 'deleted' };
    }
    withdrawDeletePost(req, body = {}) {
        return this.withdrawDelete(req, body);
    }
    async getWithdrawList(req) {
        if (!this.useMongo())
            return { data: [], total_size: 0 };
        const filter = { mysql_vendor_id: Number(req.actor.id) };
        const rows = await this.mongo.findMany('withdraw_requests', filter, { sort: { mysql_id: -1 }, limit: 100 });
        const methods = await this.mongo.findMany('withdrawal_methods', {});
        const methodMap = new Map(methods.map((m) => [Number(m.mysql_id), m.method_name ?? null]));
        const statusOf = (a) => {
            if (a === true || a === 1 || a === '1')
                return 'approved';
            if (a === 2 || a === '2')
                return 'denied';
            return 'pending';
        };
        return {
            data: rows.map((r) => {
                const methodId = Number(r.mysql_withdraw_method_id ?? r.withdrawal_method_id ?? r.withdraw_method_id ?? 0);
                const created = (r.created_at ?? null);
                return {
                    id: Number(r.mysql_id),
                    amount: toNum(r.amount),
                    approved: r.approved ?? 0,
                    status: statusOf(r.approved),
                    bank_name: methodMap.get(methodId) ?? 'Bank Transfer',
                    withdraw_method_id: methodId || null,
                    requested_at: created,
                    created_at: created,
                    updated_at: (r.updated_at ?? created),
                };
            }),
            total_size: rows.length,
        };
    }
    async requestWithdraw(req, body = {}) {
        if (!this.useMongo())
            return { message: 'withdraw requested' };
        const amount = Number(body.amount ?? 0);
        if (!Number.isFinite(amount) || amount <= 0) {
            return { errors: [{ code: 'amount', message: 'enter a valid amount' }] };
        }
        const nextId = await this.mongo.nextMysqlId('withdraw_requests');
        const now = new Date();
        await this.mongo.insertOne('withdraw_requests', {
            mysql_id: nextId,
            mysql_vendor_id: Number(req.actor.id),
            vendor_id: Number(req.actor.id),
            amount,
            mysql_withdraw_method_id: body.withdraw_method_id !== undefined && body.withdraw_method_id !== '' ? Number(body.withdraw_method_id) : null,
            approved: 0,
            created_at: now,
            updated_at: now,
        });
        return { message: 'withdraw requested', id: nextId };
    }
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
    async taxReport(req, limitStr, offsetStr) {
        const limit = parseInt(limitStr ?? '25', 10);
        const offset = parseInt(offsetStr ?? '1', 10);
        const restaurant = this.useMongo() ? await this.vendorRestaurant(req) : null;
        const taxableStatuses = ['delivered', 'refund_requested', 'refund_request_canceled'];
        const orders = (await this.vendorOrdersForReports(req)).filter((o) => taxableStatuses.includes(String(o.order_status)));
        let totalOrderAmount = 0;
        let totalTax = 0;
        for (const o of orders) {
            totalOrderAmount += Number(o.order_amount ?? 0);
            totalTax += Number(o.total_tax_amount ?? 0);
        }
        const restaurantDoc = (restaurant ?? {});
        const taxRate = Number(restaurantDoc.tax ?? 0);
        const taxSummary = totalTax > 0
            ? [{ tax_name: 'GST', tax_label: String(taxRate), total_tax: totalTax }]
            : [];
        const ordersOut = orders
            .sort((a, b) => Number(b.mysql_id) - Number(a.mysql_id))
            .slice(Math.max(0, (offset - 1) * limit), Math.max(0, (offset - 1) * limit) + limit)
            .map((o) => ({
            id: Number(o.mysql_id),
            order_amount: Number(o.order_amount ?? 0),
            total_tax_amount: Number(o.total_tax_amount ?? 0),
            order_status: o.order_status ?? null,
            payment_status: o.payment_status ?? null,
            created_at: o.created_at ?? null,
            orderTaxes: [],
        }));
        return {
            total_size: orders.length,
            limit,
            offset,
            taxSummary,
            totalOrders: orders.length,
            totalOrderAmount,
            totalTax,
            orders: ordersOut,
        };
    }
    disbursementReport() { return { data: [], total: 0 }; }
    async expenseReport(req, limitQ, offsetQ, from, to, search) {
        const limit = parseInt(limitQ ?? '10', 10) || 10;
        const offset = parseInt(offsetQ ?? '1', 10) || 1;
        const empty = { total_size: 0, limit, offset: String(offset), expense: [], total: 0 };
        if (!this.useMongo())
            return empty;
        const orders = await this.vendorOrdersForReports(req);
        const delivered = orders
            .filter((o) => o.order_status === 'delivered')
            .sort((a, b) => Number(b.mysql_id ?? 0) - Number(a.mysql_id ?? 0));
        const restIds = Array.from(new Set(delivered.map((o) => Number(o.mysql_restaurant_id ?? 0)).filter((n) => n > 0)));
        const rests = restIds.length ? await this.mongo.findMany('restaurants', { mysql_id: { $in: restIds } }) : [];
        const commissionMap = new Map(rests.map((r) => [Number(r.mysql_id), Number(r.comission ?? 0) || 10]));
        const userIds = Array.from(new Set(delivered.map((o) => Number(o.mysql_user_id ?? 0)).filter((n) => n > 0)));
        const users = userIds.length ? await this.mongo.findMany('users', { mysql_id: { $in: userIds } }) : [];
        const userMap = new Map(users.map((u) => [Number(u.mysql_id), u]));
        const fromT = from && from !== 'null' ? Date.parse(from) : NaN;
        const toT = to && to !== 'null' ? Date.parse(to) + 86_400_000 : NaN;
        const q = (search ?? '').trim().toLowerCase();
        const num = (v) => (v == null ? 0 : Number(v) || 0);
        const r2 = (n) => Math.round(n * 100) / 100;
        const expenses = [];
        let eid = 1, total = 0;
        for (const o of delivered) {
            const oid = Number(o.mysql_id);
            if (q && !String(oid).includes(q))
                continue;
            const ts = o.created_at ? new Date(o.created_at).getTime() : 0;
            if (Number.isFinite(fromT) && ts && ts < fromT)
                continue;
            if (Number.isFinite(toT) && ts && ts > toT)
                continue;
            const orderAmount = num(o.order_amount), tax = num(o.total_tax_amount), delivery = num(o.delivery_charge);
            const coupon = num(o.coupon_discount_amount), restDisc = num(o.restaurant_discount_amount), extra = num(o.additional_charge);
            let item = orderAmount + coupon + restDisc - tax - delivery - extra;
            if (item <= 0)
                item = Math.max(0, orderAmount - tax - delivery) || orderAmount;
            const rate = commissionMap.get(Number(o.mysql_restaurant_id ?? 0)) ?? 10;
            const commission = r2((item * rate) / 100);
            const u = userMap.get(Number(o.mysql_user_id ?? 0));
            const orderObj = {
                id: oid,
                user_id: Number(o.mysql_user_id ?? 0) || null,
                customer: u ? { id: Number(u.mysql_id), f_name: u.f_name ?? null, l_name: u.l_name ?? null, image_full_url: (0, storage_url_1.storageFullUrl)('profile', u.image ?? null) } : null,
            };
            const restId = Number(o.mysql_restaurant_id ?? 0) || null;
            const createdAt = o.created_at ?? null;
            const push = (type, amount, description) => {
                if (amount <= 0)
                    return;
                total += amount;
                expenses.push({
                    id: eid++, type, amount: r2(amount), description,
                    created_at: createdAt, updated_at: o.updated_at ?? createdAt, created_by: 'vendor',
                    restaurant_id: restId, order_id: oid, order: orderObj,
                });
            };
            push('commission', commission, 'Admin commission on order');
            push('coupon_discount', coupon, 'Coupon discount given');
            push('discount_on_product', restDisc, 'Discount on product');
        }
        const page = expenses.slice((offset - 1) * limit, (offset - 1) * limit + limit);
        return { total_size: expenses.length, limit, offset: String(offset), expense: page, total: r2(total) };
    }
    async transactionReport(req, limitQ, offsetQ, from, to) {
        const limit = parseInt(limitQ ?? '10', 10) || 10;
        const offset = parseInt(offsetQ ?? '1', 10) || 1;
        const empty = { total_size: 0, limit, offset: String(offset), on_hold: 0, canceled: 0, completed_transactions: 0, order_transactions: [] };
        if (!this.useMongo())
            return empty;
        const all = (await this.vendorOrdersForReports(req))
            .sort((a, b) => Number(b.mysql_id ?? 0) - Number(a.mysql_id ?? 0));
        const restIds = Array.from(new Set(all.map((o) => Number(o.mysql_restaurant_id ?? 0)).filter((n) => n > 0)));
        const rests = restIds.length ? await this.mongo.findMany('restaurants', { mysql_id: { $in: restIds } }) : [];
        const restMap = new Map(rests.map((r) => [Number(r.mysql_id), r]));
        const userIds = Array.from(new Set(all.map((o) => Number(o.mysql_user_id ?? 0)).filter((n) => n > 0)));
        const users = userIds.length ? await this.mongo.findMany('users', { mysql_id: { $in: userIds } }) : [];
        const userMap = new Map(users.map((u) => [Number(u.mysql_id), u]));
        const fromT = from && from !== 'null' ? Date.parse(from) : NaN;
        const toT = to && to !== 'null' ? Date.parse(to) + 86_400_000 : NaN;
        const num = (v) => (v == null ? 0 : Number(v) || 0);
        const r2 = (n) => Math.round(n * 100) / 100;
        let completed = 0, onHold = 0, canceled = 0;
        const rows = all.filter((o) => {
            const ts = o.created_at ? new Date(o.created_at).getTime() : 0;
            if (Number.isFinite(fromT) && ts && ts < fromT)
                return false;
            if (Number.isFinite(toT) && ts && ts > toT)
                return false;
            return true;
        });
        const txns = rows.map((o) => {
            const rest = restMap.get(Number(o.mysql_restaurant_id ?? 0));
            const u = userMap.get(Number(o.mysql_user_id ?? 0));
            const orderAmount = num(o.order_amount), vat = num(o.total_tax_amount), delivery = num(o.delivery_charge);
            const coupon = num(o.coupon_discount_amount), restDisc = num(o.restaurant_discount_amount), extra = num(o.additional_charge);
            let item = orderAmount + coupon + restDisc - vat - delivery - extra;
            if (item <= 0)
                item = Math.max(0, orderAmount - vat - delivery) || orderAmount;
            const rate = Number(rest?.comission ?? 0) || 10;
            const adminCommission = r2((item * rate) / 100);
            const restaurantNet = r2(item - adminCommission);
            const status = String(o.order_status ?? '');
            const paid = String(o.payment_status ?? '') === 'paid';
            const isCompleted = status === 'delivered' && paid;
            const isCanceled = ['canceled', 'refunded', 'failed'].includes(status);
            if (isCanceled)
                canceled += restaurantNet;
            else if (isCompleted)
                completed += restaurantNet;
            else
                onHold += restaurantNet;
            const cod = String(o.payment_method ?? '') === 'cash_on_delivery';
            return {
                order_id: Number(o.mysql_id),
                restaurant: rest?.name ?? null,
                customer_name: u ? `${u.f_name ?? ''} ${u.l_name ?? ''}`.trim() || null : null,
                total_item_amount: r2(item),
                item_discount: 0,
                coupon_discount: r2(coupon),
                discounted_amount: r2(coupon + restDisc),
                vat: r2(vat),
                delivery_charge: r2(delivery),
                order_amount: r2(orderAmount),
                admin_discount: 0,
                restaurant_discount: r2(restDisc),
                admin_commission: adminCommission,
                additional_charge: r2(extra),
                commission_on_delivery_charge: 0,
                admin_net_income: adminCommission,
                restaurant_net_income: restaurantNet,
                amount_received_by: cod ? 'Restaurant' : 'Admin',
                payment_method: cod ? 'Cash On Delivery' : String(o.payment_method ?? 'Digital Payment'),
                payment_status: isCompleted ? 'Completed' : isCanceled ? 'Canceled' : 'On Hold',
            };
        });
        const page = txns.slice((offset - 1) * limit, (offset - 1) * limit + limit);
        return {
            total_size: txns.length,
            limit,
            offset: String(offset),
            on_hold: r2(onHold),
            canceled: r2(canceled),
            completed_transactions: r2(completed),
            order_transactions: page,
        };
    }
    generateStatement() { return { message: 'not available in demo' }; }
    searchedFood() { return { products: [] }; }
    async vendorNotifications(req) {
        if (this.useMongo()) {
            const restaurantIds = await this.vendorRestaurantIds(req);
            const rows = await this.mongo.findMany('notifications', {
                status: true,
                $or: [
                    ...(restaurantIds.length > 0 ? [{ mysql_restaurant_id: { $in: restaurantIds } }] : []),
                    { mysql_restaurant_id: { $exists: false } },
                    { mysql_restaurant_id: null },
                ],
            }, { sort: { mysql_id: -1 }, limit: 50 });
            return rows.map((r) => ({ id: Number(r.mysql_id), title: r.title ?? null, description: r.description ?? null }));
        }
        const rows = await this.prisma.notifications.findMany({ where: { status: true }, orderBy: { id: 'desc' }, take: 50 });
        return rows.map((r) => ({ id: Number(r.id), title: r.title, description: r.description }));
    }
    async messageList(req, type, offsetQ, limitQ) {
        if (!this.useMongo())
            return { conversation: [], total_size: 0, limit: 10, offset: 1 };
        const vendorId = Number(req.actor.id);
        const limit = parseInt(limitQ ?? '10', 10) || 10;
        const offset = parseInt(offsetQ ?? '1', 10) || 1;
        const cpSlot = String(type ?? '').toLowerCase().includes('deliver') ? 'delivery_man_id' : 'user_id';
        const cpType = cpSlot === 'delivery_man_id' ? 'delivery_man' : 'user';
        const rows = await this.mongo.findMany('conversations', { vendor_id: vendorId, [cpSlot]: { $ne: null } }, { sort: { last_message_at: -1 }, limit: 200 });
        const myProfile = await (0, messaging_helper_1.participantProfile)(this.mongo, 'vendor_id', vendorId, storage_url_1.storageFullUrl);
        const paged = rows.slice((offset - 1) * limit, offset * limit);
        const conversation = await Promise.all(paged.map(async (c) => {
            const cpId = Number(c[cpSlot] ?? 0);
            const receiver = await (0, messaging_helper_1.participantProfile)(this.mongo, cpSlot, cpId, storage_url_1.storageFullUrl);
            return {
                id: Number(c.mysql_id),
                sender_id: vendorId, sender_type: 'vendor', receiver_id: cpId, receiver_type: cpType,
                unread_message_count: Number(c.unread ?? 0), last_message_id: null,
                last_message_time: c.last_message_at ?? c.created_at ?? null,
                created_at: c.created_at ?? null, updated_at: c.last_message_at ?? null,
                sender: myProfile, receiver,
                last_message: { id: null, conversation_id: Number(c.mysql_id), sender_id: vendorId, message: c.last_message ?? '', is_seen: 1, files: [] },
            };
        }));
        return { conversation, total_size: rows.length, limit, offset };
    }
    async messageDetails(req, convId, userId, dmId) {
        if (!this.useMongo())
            return { messages: [] };
        const vendorId = Number(req.actor.id);
        let conversationId = convId ? Number(convId) : undefined;
        if (!conversationId && (userId || dmId)) {
            const cpSlot = dmId ? 'delivery_man_id' : 'user_id';
            const conv = await this.mongo.findOne('conversations', { vendor_id: vendorId, [cpSlot]: Number(dmId ?? userId) });
            if (conv)
                conversationId = Number(conv.mysql_id);
        }
        if (!conversationId)
            return { messages: [] };
        const rows = await this.mongo.findMany('messages', { conversation_id: conversationId }, { sort: { mysql_id: 1 }, limit: 100 });
        return {
            messages: rows.map((m) => ({
                id: Number(m.mysql_id), conversation_id: conversationId,
                sender_type: m.sender_type, sender_id: m.sender_id != null ? Number(m.sender_id) : null,
                message: (m.message ?? m.body ?? ''), body: (m.message ?? m.body ?? ''),
                file_full_url: Array.isArray(m.files) ? m.files.map((f) => (0, storage_url_1.storageFullUrl)('conversation', f)).filter((u) => !!u) : [],
                is_seen: m.is_seen ?? 1, sent_by_me: m.sender_type === 'vendor' && Number(m.sender_id) === vendorId,
                created_at: m.created_at ?? null,
            })),
        };
    }
    messageSearch() { return { conversations: [] }; }
    async messageSend(req, files, rawBody = {}) {
        if (!this.useMongo())
            return { message: 'sent' };
        const vendorId = Number(req.actor.id);
        const body = rawBody ?? {};
        const text = String(body.message ?? body.body ?? '');
        const imageNames = [];
        for (const f of files ?? []) {
            const n = await this.saveUploaded(f, 'conversation');
            if (n)
                imageNames.push(n);
        }
        if (!text.trim() && imageNames.length === 0)
            return { errors: [{ code: 'body', message: 'message body required' }] };
        let convId = body.conversation_id != null && body.conversation_id !== '' ? Number(body.conversation_id) : undefined;
        if (!convId) {
            const cp = await (0, messaging_helper_1.resolveParticipant)(this.mongo, String(body.receiver_type ?? 'user'), Number(body.receiver_id ?? body.user_id ?? 0));
            if (!cp)
                return { errors: [{ code: 'receiver', message: 'receiver_id required' }] };
            convId = await (0, messaging_helper_1.findOrCreateConversation)(this.mongo, { slot: 'vendor_id', id: vendorId }, cp, text);
        }
        const msgId = await this.mongo.nextMysqlId('messages');
        await this.mongo.insertOne('messages', { mysql_id: msgId, conversation_id: convId, sender_type: 'vendor', sender_id: vendorId, message: text, body: text, files: imageNames, created_at: new Date() });
        await this.mongo.updateOne('conversations', { mysql_id: convId }, { last_message: text || (imageNames.length ? 'Photo' : ''), last_message_at: new Date() });
        return { message: 'sent', conversation_id: convId, id: msgId, files: imageNames };
    }
    async basicCampaigns(req) {
        if (!this.useMongo())
            return [];
        const restaurant = await this.vendorRestaurant(req);
        const restId = restaurant ? Number(restaurant.mysql_id) : 0;
        const camps = await this.mongo.findMany('campaigns', { $or: [{ status: true }, { status: 1 }, { status: { $exists: false } }] }, { sort: { mysql_id: -1 } });
        const joins = restId
            ? await this.mongo.findMany('restaurant_campaigns', { restaurant_id: restId })
            : [];
        const joinedSet = new Set(joins.map((j) => Number(j.campaign_id)));
        const fallbackImg = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=700&h=400&fit=crop&q=80';
        return camps.map((c) => {
            const cid = Number(c.mysql_id);
            const stored = c.image ? (0, storage_url_1.storageFullUrl)('campaign', c.image) : null;
            const joined = joinedSet.has(cid);
            return {
                id: cid,
                title: c.title ?? null,
                image_full_url: stored ?? fallbackImg,
                description: c.description ?? null,
                created_at: c.created_at ?? null,
                updated_at: c.updated_at ?? null,
                start_time: c.start_time ?? '00:00:00',
                end_time: c.end_time ?? '23:59:59',
                available_date_starts: c.start_date ?? null,
                available_date_ends: c.end_date ?? null,
                vendor_status: joined ? 'confirmed' : null,
                is_joined: joined,
            };
        });
    }
    async campaignJoin(req, body = {}) {
        if (this.useMongo()) {
            const restaurant = await this.vendorRestaurant(req);
            const cid = Number(body.campaign_id ?? body.id ?? 0);
            if (restaurant && cid) {
                const restId = Number(restaurant.mysql_id);
                const exists = await this.mongo.findOne('restaurant_campaigns', { campaign_id: cid, restaurant_id: restId });
                if (!exists) {
                    const nextId = await this.mongo.nextMysqlId('restaurant_campaigns');
                    await this.mongo.insertOne('restaurant_campaigns', {
                        mysql_id: nextId, campaign_id: cid, restaurant_id: restId, mysql_restaurant_id: restId,
                        status: 'confirmed', created_at: new Date(), updated_at: new Date(),
                    });
                }
            }
        }
        return { message: 'joined' };
    }
    async campaignLeave(req, body = {}) {
        if (this.useMongo()) {
            const restaurant = await this.vendorRestaurant(req);
            const cid = Number(body.campaign_id ?? body.id ?? 0);
            if (restaurant && cid) {
                await this.mongo.deleteOne('restaurant_campaigns', { campaign_id: cid, restaurant_id: Number(restaurant.mysql_id) });
            }
        }
        return { message: 'left' };
    }
    shapeAd(row) {
        const r = row;
        const img = (f) => {
            const s = f && String(f).trim() ? String(f) : '';
            if (!s)
                return null;
            if (/^https?:\/\//i.test(s))
                return s;
            return `${(0, storage_url_1.storageBaseUrl)()}/advertisement/${s}`;
        };
        return {
            id: Number(r.mysql_id),
            restaurant_id: r.mysql_restaurant_id != null ? Number(r.mysql_restaurant_id) : 0,
            add_type: r.add_type ?? 'restaurant_promotion',
            title: r.title ?? null,
            description: r.description ?? null,
            start_date: r.start_date ?? null,
            end_date: r.end_date ?? null,
            pause_note: r.pause_note ?? null,
            cancellation_note: r.cancellation_note ?? null,
            cover_image: r.cover_image ?? null,
            profile_image: r.profile_image ?? null,
            video_attachment: r.video_attachment ?? null,
            priority: Number(r.priority ?? 0),
            is_rating_active: Number(r.is_rating_active ?? 0),
            is_review_active: Number(r.is_review_active ?? 0),
            is_paid: Number(r.is_paid ?? 0),
            is_updated: Number(r.is_updated ?? 0),
            created_by_id: r.mysql_created_by_id != null ? Number(r.mysql_created_by_id) : 0,
            created_by_type: r.created_by_type ?? 'vendor',
            status: r.status ?? 'pending',
            active: Number(r.active ?? 1),
            created_at: r.created_at ?? null,
            updated_at: r.updated_at ?? null,
            cover_image_full_url: img(r.cover_image),
            profile_image_full_url: img(r.profile_image),
            video_attachment_full_url: img(r.video_attachment),
            translations: Array.isArray(r.translations) ? r.translations : [],
            storage: [],
        };
    }
    parseAdTranslations(raw) {
        let translations = [];
        if (typeof raw === 'string') {
            try {
                translations = JSON.parse(raw) ?? [];
            }
            catch {
                translations = [];
            }
        }
        else if (Array.isArray(raw))
            translations = raw;
        const pick = (key) => translations.find((t) => t?.locale === 'en' && t?.key === key)?.value
            ?? translations.find((t) => t?.key === key)?.value ?? null;
        return { title: pick('title'), description: pick('description'), translations };
    }
    async createAdvertisement(req, body, files) {
        if (!this.useMongo())
            return { message: 'ad created' };
        const restaurant = await this.vendorRestaurant(req);
        if (!restaurant)
            return { errors: [{ code: 'restaurant', message: 'restaurant not found' }] };
        const { title, description, translations } = this.parseAdTranslations(body.translations);
        let startDate = null;
        let endDate = null;
        if (typeof body.dates === 'string' && body.dates.includes(' - ')) {
            const [s, e] = body.dates.split(' - ');
            startDate = s.trim() || null;
            endDate = e.trim() || null;
        }
        const cover = await this.saveUploaded(files?.cover_image?.[0], 'advertisement');
        const profile = await this.saveUploaded(files?.profile_image?.[0], 'advertisement');
        const video = await this.saveUploaded(files?.video_attachment?.[0], 'advertisement');
        const nextId = await this.mongo.nextMysqlId('advertisements');
        const now = new Date();
        await this.mongo.insertOne('advertisements', {
            mysql_id: nextId,
            mysql_restaurant_id: Number(restaurant.mysql_id),
            restaurant_id: Number(restaurant.mysql_id),
            add_type: String(body.advertisement_type ?? 'restaurant_promotion'),
            title: title ?? String(body.title ?? 'Advertisement'),
            description: description ?? String(body.description ?? ''),
            translations,
            start_date: startDate,
            end_date: endDate,
            cover_image: cover,
            profile_image: profile,
            video_attachment: video,
            is_rating_active: Number(body.is_rating_active ?? 0),
            is_review_active: Number(body.is_review_active ?? 0),
            is_paid: 0,
            is_updated: 0,
            priority: 0,
            mysql_created_by_id: Number(req.actor.id),
            created_by_type: 'vendor',
            status: 'pending',
            active: 1,
            created_at: now,
            updated_at: now,
        });
        return { message: 'Advertisement created successfully', id: nextId };
    }
    async ads(req, offsetQ, limitQ, adsType) {
        const limit = parseInt(limitQ ?? '10', 10) || 10;
        const offset = parseInt(offsetQ ?? '1', 10) || 1;
        const empty = { total_size: 0, limit, offset, all: 0, running: 0, pending: 0, denied: 0, approved: 0, expired: 0, paused: 0, adds: [] };
        if (!this.useMongo())
            return empty;
        const restaurantIds = await this.vendorRestaurantIds(req);
        if (restaurantIds.length === 0)
            return empty;
        const base = { mysql_restaurant_id: { $in: restaurantIds } };
        const countFor = (s) => this.mongo.count('advertisements', { ...base, status: s });
        const [all, pending, running, approved, denied, expired, paused] = await Promise.all([
            this.mongo.count('advertisements', base),
            countFor('pending'), countFor('running'), countFor('approved'),
            countFor('denied'), countFor('expired'), countFor('paused'),
        ]);
        const filter = adsType && adsType !== 'all' ? { ...base, status: adsType } : base;
        const total = adsType && adsType !== 'all' ? await this.mongo.count('advertisements', filter) : all;
        const rows = await this.mongo.findMany('advertisements', filter, {
            sort: { mysql_id: -1 }, limit, skip: Math.max(0, (offset - 1) * limit),
        });
        return { total_size: total, limit, offset, all, running, pending, denied, approved, expired, paused, adds: rows.map((r) => this.shapeAd(r)) };
    }
    async adDetails(idStr) {
        const id = parseInt(idStr, 10);
        if (!this.useMongo() || !Number.isFinite(id))
            return null;
        const doc = await this.mongo.findByMysqlId('advertisements', id);
        return doc ? this.shapeAd(doc) : null;
    }
    adStore(req, body = {}, files = {}) {
        return this.createAdvertisement(req, body, files);
    }
    adCopy(req, body = {}, files = {}) {
        return this.createAdvertisement(req, body, files);
    }
    async adUpdate(idStr, body = {}, files = {}) {
        const id = parseInt(idStr, 10);
        if (!this.useMongo() || !Number.isFinite(id))
            return { message: 'updated' };
        const data = { updated_at: new Date(), is_updated: 1 };
        if (body.translations !== undefined) {
            const { title, description, translations } = this.parseAdTranslations(body.translations);
            data.translations = translations;
            if (title)
                data.title = title;
            if (description)
                data.description = description;
        }
        if (typeof body.dates === 'string' && body.dates.includes(' - ')) {
            const [s, e] = body.dates.split(' - ');
            data.start_date = s.trim() || null;
            data.end_date = e.trim() || null;
        }
        if (body.advertisement_type !== undefined)
            data.add_type = String(body.advertisement_type);
        if (body.is_rating_active !== undefined)
            data.is_rating_active = Number(body.is_rating_active);
        if (body.is_review_active !== undefined)
            data.is_review_active = Number(body.is_review_active);
        const cover = await this.saveUploaded(files?.cover_image?.[0], 'advertisement');
        const profile = await this.saveUploaded(files?.profile_image?.[0], 'advertisement');
        const video = await this.saveUploaded(files?.video_attachment?.[0], 'advertisement');
        if (cover)
            data.cover_image = cover;
        if (profile)
            data.profile_image = profile;
        if (video)
            data.video_attachment = video;
        await this.mongo.updateOne('advertisements', { mysql_id: id }, data);
        return { message: 'Advertisement updated successfully' };
    }
    async adStatus(body = {}) {
        const id = body.id !== undefined && body.id !== '' ? Number(body.id) : null;
        if (this.useMongo() && id) {
            const data = { updated_at: new Date() };
            if (body.status !== undefined)
                data.status = String(body.status);
            if (body.pause_note !== undefined)
                data.pause_note = String(body.pause_note);
            await this.mongo.updateOne('advertisements', { mysql_id: id }, data);
        }
        return { message: 'status updated' };
    }
    async adDelete(idStr) {
        const id = parseInt(idStr, 10);
        if (this.useMongo() && Number.isFinite(id))
            await this.mongo.deleteOne('advertisements', { mysql_id: id });
        return { message: 'advertisement deleted' };
    }
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
    async setBusinessPlan(req, body = {}) {
        if (!this.useMongo())
            return { message: 'plan updated', redirect_url: null, success: true };
        const restaurant = await this.vendorRestaurant(req).catch(() => null);
        if (!restaurant)
            return { errors: [{ code: 'restaurant', message: 'restaurant not found' }] };
        const plan = String(body.business_plan ?? 'commission');
        const data = {
            restaurant_model: plan === 'subscription' ? 'subscription' : 'commission',
            updated_at: new Date(),
        };
        if (plan === 'subscription' && body.package_id) {
            const pkgId = Number(body.package_id);
            const pkg = await this.mongo.findByMysqlId('subscription_packages', pkgId).catch(() => null);
            const validity = Number(pkg?.validity ?? 30);
            data.subscription_id = pkgId;
            data.subscription_expiry_date = new Date(Date.now() + validity * 24 * 60 * 60 * 1000);
        }
        else {
            data.subscription_id = null;
        }
        await this.mongo.updateOne('restaurants', { mysql_id: Number(restaurant.mysql_id) }, data);
        return { message: 'plan updated successfully', redirect_url: null, success: true };
    }
    async packageView() {
        let packages = [];
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('subscription_packages', { $or: [{ status: true }, { status: 1 }] }, { sort: { mysql_id: -1 } });
            packages = rows.map((r) => ({
                ...r,
                id: Number(r.mysql_id),
                price: Number(r.price ?? 0),
                validity: Number(r.validity ?? 0),
            }));
        }
        if (packages.length === 0) {
            packages = [
                { id: 1, package_name: 'Starter', price: 499, validity: 30, max_order: 100, max_product: 50, pos: 1, mobile_app: 0, self_delivery: 0, reviews: 1, chat: 1 },
                { id: 2, package_name: 'Growth', price: 999, validity: 30, max_order: 500, max_product: 200, pos: 1, mobile_app: 1, self_delivery: 1, reviews: 1, chat: 1 },
                { id: 3, package_name: 'Pro', price: 1999, validity: 30, max_order: 0, max_product: 0, pos: 1, mobile_app: 1, self_delivery: 1, reviews: 1, chat: 1 },
            ];
        }
        return { packages };
    }
    async subscriptionTransactionsList(req, offsetQ, limitQ) {
        if (!this.useMongo())
            return { transactions: [], total_size: 0, limit: 10, offset: 1 };
        const vendorId = Number(req.actor.id);
        const restaurants = await this.mongo.findMany('restaurants', { mysql_vendor_id: vendorId });
        const restIds = restaurants.map((r) => Number(r.mysql_id));
        if (restIds.length === 0)
            return { transactions: [], total_size: 0, limit: 10, offset: 1 };
        const restMap = new Map(restaurants.map((r) => [Number(r.mysql_id), r]));
        const limit = parseInt(limitQ ?? '10', 10) || 10;
        const offset = parseInt(offsetQ ?? '1', 10) || 1;
        const rows = await this.mongo.findMany('subscription_transactions', { restaurant_id: { $in: restIds } }, { sort: { mysql_id: -1 } });
        const pkgIds = Array.from(new Set(rows.map((t) => Number(t.package_id ?? 0)).filter((n) => n > 0)));
        const pkgs = pkgIds.length ? await this.mongo.findMany('subscription_packages', { mysql_id: { $in: pkgIds } }) : [];
        const pkgMap = new Map(pkgs.map((p) => [Number(p.mysql_id), p]));
        const shaped = rows.map((t) => {
            const pkg = pkgMap.get(Number(t.package_id ?? 0));
            const rest = restMap.get(Number(t.restaurant_id ?? 0));
            const feat = (k) => (pkg ? (Number(pkg[k] ?? 0) ? 1 : 0) : 0);
            return {
                id: String(t.transaction_id ?? t.id ?? t.mysql_id),
                package_id: Number(t.package_id ?? 0),
                restaurant_id: Number(t.restaurant_id ?? 0),
                restaurant_subscription_id: Number(t.restaurant_subscription_id ?? 0) || null,
                price: toNum(t.price),
                validity: Number(t.validity ?? pkg?.validity ?? 30),
                payment_method: String(t.payment_method ?? 'wallet'),
                payment_status: String(t.payment_status ?? 'success'),
                reference: t.reference ?? null,
                paid_amount: toNum(t.paid_amount ?? t.price),
                discount: toNum(t.discount),
                package_details: {
                    pos: feat('pos'), review: feat('review'), self_delivery: feat('self_delivery'),
                    chat: feat('chat'), mobile_app: feat('mobile_app'),
                    max_order: pkg?.max_order ?? 'unlimited', max_product: pkg?.max_product ?? 'unlimited',
                },
                created_by: String(t.created_by ?? 'vendor'),
                is_trial: Number(t.is_trial ?? 0) ? 1 : 0,
                transaction_status: 1,
                plan_type: String(t.plan_type ?? 'new_plan'),
                created_at: t.created_at ?? null,
                updated_at: t.updated_at ?? t.created_at ?? null,
                restaurant: rest ? { id: Number(rest.mysql_id), name: rest.name ?? null, logo_full_url: (0, storage_url_1.storageFullUrl)('restaurant', rest.logo ?? null) } : null,
                package: pkg ? {
                    id: Number(pkg.mysql_id), package_name: pkg.package_name ?? 'Plan', price: toNum(pkg.price),
                    validity: Number(pkg.validity ?? 30), max_order: pkg.max_order ?? 'unlimited', max_product: pkg.max_product ?? 'unlimited',
                    pos: feat('pos'), mobile_app: feat('mobile_app'), chat: feat('chat'), review: feat('review'), self_delivery: feat('self_delivery'), status: 1,
                } : null,
            };
        });
        const page = shaped.slice(Math.max(0, (offset - 1) * limit), Math.max(0, (offset - 1) * limit) + limit);
        return { transactions: page, total_size: shaped.length, limit, offset: String(offset) };
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
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
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
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "toggleOpen", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-announcment'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "announce", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-bank-info'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
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
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
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
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('name')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "productSearch", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Get)('product/status'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "productStatusGet", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('product/status'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "productStatus", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Get)('product/recommended'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "productRecommendedGet", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('product/recommended'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "productRecommended", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('product/update-stock'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
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
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "productDelete", null);
__decorate([
    (0, common_1.Get)('product/reviews'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('product_id')),
    __param(2, (0, common_1.Query)('restaurant_id')),
    __param(3, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "productReviews", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('product/reply-update'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
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
    (0, common_1.Get)('categories/childes/:parentId'),
    __param(0, (0, common_1.Param)('parentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "childCategoriesByPath", null);
__decorate([
    (0, common_1.Get)('categories/category-wise-products'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('category_id')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
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
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "addonStore", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Put)('addon/update'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "addonUpdatePut", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('addon/update'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "addonUpdate", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('addon/delete'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "addonDeletePost", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('addon/delete'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
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
    __param(0, (0, common_1.Query)('delivery_man_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "dmPreview", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('delivery-man/store'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileFieldsInterceptor)([
        { name: 'image', maxCount: 1 },
        { name: 'identity_image', maxCount: 5 },
    ], { limits: { fileSize: 5 * 1024 * 1024 } })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "dmStore", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('delivery-man/update'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileFieldsInterceptor)([
        { name: 'image', maxCount: 1 },
    ], { limits: { fileSize: 5 * 1024 * 1024 } })),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "dmUpdate", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('delivery-man/delete'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "dmDelete", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('delivery-man/status'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "dmStatus", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('delivery-man/assign-deliveryman'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "dmAssign", null);
__decorate([
    (0, common_1.Get)('coupon-list'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "vendorCouponList", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('coupon-store'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "vendorCouponStore", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Put)('coupon-update'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "vendorCouponUpdatePut", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('coupon-update'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "vendorCouponUpdate", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('coupon-status'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "vendorCouponStatus", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('coupon-delete'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "vendorCouponDeletePost", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('coupon-delete'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "vendorCouponDelete", null);
__decorate([
    (0, common_1.Get)('coupon/view-without-translate'),
    __param(0, (0, common_1.Query)('coupon_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "vendorCouponView", null);
__decorate([
    (0, common_1.Get)('wallet-payment-list'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('offset')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
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
    (0, common_1.Get)('get-withdraw-method-list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "getWithdrawMethods", null);
__decorate([
    (0, common_1.Get)('withdraw-method/list'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "withdrawMethods", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('withdraw-method/store'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "withdrawStore", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('withdraw-method/make-default'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "withdrawDefault", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('withdraw-method/delete'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "withdrawDelete", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('withdraw-method/delete'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "withdrawDeletePost", null);
__decorate([
    (0, common_1.Get)('get-withdraw-list'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "getWithdrawList", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('request-withdraw'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
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
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
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
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('offset')),
    __param(3, (0, common_1.Query)('from')),
    __param(4, (0, common_1.Query)('to')),
    __param(5, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "expenseReport", null);
__decorate([
    (0, common_1.Get)('get-transaction-report'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('offset')),
    __param(3, (0, common_1.Query)('from')),
    __param(4, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
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
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "vendorNotifications", null);
__decorate([
    (0, common_1.Get)('message/list'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('type')),
    __param(2, (0, common_1.Query)('offset')),
    __param(3, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "messageList", null);
__decorate([
    (0, common_1.Get)('message/details'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('conversation_id')),
    __param(2, (0, common_1.Query)('user_id')),
    __param(3, (0, common_1.Query)('delivery_man_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
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
    (0, common_1.UseInterceptors)((0, platform_express_1.AnyFilesInterceptor)({ limits: { fileSize: 10 * 1024 * 1024 } })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.UploadedFiles)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "messageSend", null);
__decorate([
    (0, common_1.Get)('get-basic-campaigns'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "basicCampaigns", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('campaign-join'),
    (0, common_1.Put)('campaign-join'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "campaignJoin", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('campaign-leave'),
    (0, common_1.Put)('campaign-leave'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "campaignLeave", null);
__decorate([
    (0, common_1.Get)('advertisement'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('offset')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('ads_type')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "ads", null);
__decorate([
    (0, common_1.Get)('advertisement/details/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "adDetails", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('advertisement/store'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileFieldsInterceptor)([
        { name: 'cover_image', maxCount: 1 },
        { name: 'profile_image', maxCount: 1 },
        { name: 'video_attachment', maxCount: 1 },
    ], { limits: { fileSize: 30 * 1024 * 1024 } })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "adStore", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('advertisement/copy-add-post'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileFieldsInterceptor)([
        { name: 'cover_image', maxCount: 1 },
        { name: 'profile_image', maxCount: 1 },
        { name: 'video_attachment', maxCount: 1 },
    ], { limits: { fileSize: 30 * 1024 * 1024 } })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "adCopy", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('advertisement/update/:id'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileFieldsInterceptor)([
        { name: 'cover_image', maxCount: 1 },
        { name: 'profile_image', maxCount: 1 },
        { name: 'video_attachment', maxCount: 1 },
    ], { limits: { fileSize: 30 * 1024 * 1024 } })),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "adUpdate", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('advertisement/status'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "adStatus", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('advertisement/delete/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "adDelete", null);
__decorate([
    (0, common_1.Get)('business_plan'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "businessPlan", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('business_plan'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "setBusinessPlan", null);
__decorate([
    (0, common_1.Get)('package-view'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "packageView", null);
__decorate([
    (0, common_1.Get)('subscription-transaction'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('offset')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
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
exports.VendorExtrasController = VendorExtrasController = VendorExtrasController_1 = __decorate([
    (0, common_1.Controller)('vendor'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, auth_guard_1.RequireAuth)('vendor'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        mongo_data_service_1.MongoDataService])
], VendorExtrasController);
//# sourceMappingURL=vendor-extras.controller.js.map