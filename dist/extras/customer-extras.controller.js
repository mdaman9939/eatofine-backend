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
exports.CustomerExtrasController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const image_compress_1 = require("../common/image-compress");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const auth_guard_1 = require("../auth/auth.guard");
const prisma_service_1 = require("../prisma/prisma.service");
const mongo_data_service_1 = require("../mongo/mongo-data.service");
const order_lifecycle_service_1 = require("../lifecycle/order-lifecycle.service");
const storage_url_1 = require("../common/storage-url");
const messaging_helper_1 = require("./messaging.helper");
const STORAGE_ROOT = (() => {
    if (process.env.STORAGE_ROOT)
        return process.env.STORAGE_ROOT;
    const fs = require('fs');
    const repoLocal = path.resolve(__dirname, '../../storage/app/public');
    const monorepo = path.resolve(__dirname, '../../../../storage/app/public');
    return fs.existsSync(repoLocal) ? repoLocal : monorepo;
})();
const toNum = (v) => {
    if (v === null || v === undefined)
        return 0;
    if (typeof v === 'number')
        return v;
    if (typeof v === 'string')
        return Number(v) || 0;
    return Number(v) || 0;
};
let CustomerExtrasController = class CustomerExtrasController {
    prisma;
    mongo;
    lifecycle;
    constructor(prisma, mongo, lifecycle) {
        this.prisma = prisma;
        this.mongo = mongo;
        this.lifecycle = lifecycle;
    }
    useMongo() {
        const v = (process.env.USE_MONGO_EXTRAS ?? '1').toLowerCase();
        return v === '1' || v === 'true' || v === 'yes';
    }
    async wishList(req) {
        const userId = Number(req.actor.id);
        const rows = await this.mongo.findMany('wishlists', { user_id: userId });
        const foodIds = rows.map((r) => r.food_id).filter((x) => x != null);
        const restaurantIds = rows.map((r) => r.restaurant_id).filter((x) => x != null);
        const [foods, restaurants, restFoods] = await Promise.all([
            foodIds.length
                ? this.mongo.findMany('foods', { mysql_id: { $in: foodIds } })
                : Promise.resolve([]),
            restaurantIds.length
                ? this.mongo.findMany('restaurants', { mysql_id: { $in: restaurantIds } })
                : Promise.resolve([]),
            restaurantIds.length
                ? this.mongo.findMany('foods', { mysql_restaurant_id: { $in: restaurantIds } }, { limit: 200 })
                : Promise.resolve([]),
        ]);
        const foodsByRest = new Map();
        for (const f of restFoods) {
            const rid = f.mysql_restaurant_id != null ? Number(f.mysql_restaurant_id) : null;
            if (rid == null)
                continue;
            const arr = foodsByRest.get(rid) ?? [];
            arr.push(f);
            foodsByRest.set(rid, arr);
        }
        const vendorIds = Array.from(new Set(restaurants.filter((r) => !r.logo && r.mysql_vendor_id).map((r) => Number(r.mysql_vendor_id))));
        const vendorImgMap = new Map();
        if (vendorIds.length) {
            const vendors = await this.mongo.findMany('vendors', { mysql_id: { $in: vendorIds } });
            for (const v of vendors)
                vendorImgMap.set(Number(v.mysql_id), v.image ?? null);
        }
        return {
            product: foods.map((f) => ({
                ...(f.legacy ?? {}),
                ...f,
                id: Number(f.mysql_id),
                price: toNum(f.price),
                discount: toNum(f.discount),
                tax: toNum(f.tax),
                restaurant_id: f.mysql_restaurant_id != null ? Number(f.mysql_restaurant_id) : null,
                category_id: f.mysql_category_id != null ? Number(f.mysql_category_id) : null,
                image_full_url: (0, storage_url_1.storageFullUrl)('product', f.image ?? null),
            })),
            restaurant: restaurants.map((r) => {
                const rid = Number(r.mysql_id);
                const rFoods = foodsByRest.get(rid) ?? [];
                const vendorImg = r.logo ? null : (vendorImgMap.get(Number(r.mysql_vendor_id ?? 0)) ?? null);
                return {
                    id: rid,
                    name: r.name ?? null,
                    logo: r.logo ?? vendorImg ?? null,
                    logo_full_url: (0, storage_url_1.storageFullUrl)('restaurant', r.logo ?? null) ?? (0, storage_url_1.storageFullUrl)('profile', vendorImg),
                    cover_photo_full_url: (0, storage_url_1.storageFullUrl)('restaurant/cover', r.cover_photo ?? null),
                    address: r.address ?? null,
                    avg_rating: r.avg_rating ?? 0,
                    rating_count: r.rating_count ?? 0,
                    delivery_time: r.delivery_time ?? '30-40',
                    free_delivery: r.free_delivery ? 1 : 0,
                    slug: r.slug ?? null,
                    open: r.open ?? 1,
                    active: r.active !== false,
                    status: r.status === false ? 0 : 1,
                    restaurant_status: r.status === false ? 0 : 1,
                    zone_id: r.mysql_zone_id != null ? Number(r.mysql_zone_id) : null,
                    foods_count: rFoods.length,
                    foods: rFoods.slice(0, 6).map((f) => ({
                        id: Number(f.mysql_id),
                        name: f.name ?? null,
                        image: f.image ?? null,
                        image_full_url: (0, storage_url_1.storageFullUrl)('product', f.image ?? null),
                        price: toNum(f.price),
                        avg_rating: f.avg_rating ?? 0,
                        rating_count: f.rating_count ?? 0,
                    })),
                };
            }),
        };
    }
    async wishAdd(req, body) {
        const userId = Number(req.actor.id);
        if (!body.food_id && !body.restaurant_id) {
            return { message: 'food_id or restaurant_id required' };
        }
        const filter = { user_id: userId };
        if (body.food_id)
            filter.food_id = Number(body.food_id);
        if (body.restaurant_id)
            filter.restaurant_id = Number(body.restaurant_id);
        const existing = await this.mongo.findOne('wishlists', filter);
        if (existing)
            return { message: 'already in wishlist' };
        const id = await this.mongo.nextMysqlId('wishlists');
        await this.mongo.insertOne('wishlists', {
            mysql_id: id,
            user_id: userId,
            food_id: body.food_id ? Number(body.food_id) : null,
            restaurant_id: body.restaurant_id ? Number(body.restaurant_id) : null,
            created_at: new Date(),
        });
        return { message: 'successfully added!' };
    }
    async wishRemove(req, foodId, restaurantId) {
        const userId = Number(req.actor.id);
        const filter = { user_id: userId };
        if (foodId)
            filter.food_id = Number(foodId);
        if (restaurantId)
            filter.restaurant_id = Number(restaurantId);
        if (!('food_id' in filter) && !('restaurant_id' in filter)) {
            return { message: 'nothing to remove' };
        }
        await this.mongo.deleteMany('wishlists', filter);
        return { message: 'successfully removed!' };
    }
    async wishClear(req) {
        await this.mongo.deleteMany('wishlists', { user_id: Number(req.actor.id) });
        return { message: 'cleared' };
    }
    async notifications() {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('notifications', { status: true }, { sort: { mysql_id: -1 }, limit: 50 });
            return rows.map((r) => ({
                id: Number(r.mysql_id),
                title: r.title ?? null,
                description: r.description ?? null,
                image: r.image ?? null,
                created_at: r.created_at ?? null,
            }));
        }
        const rows = await this.prisma.notifications.findMany({
            where: { status: true },
            orderBy: { id: 'desc' },
            take: 50,
        });
        return rows.map((r) => ({
            id: Number(r.id),
            title: r.title,
            description: r.description,
            image: r.image,
            created_at: r.created_at,
        }));
    }
    fcmToken() {
        return { message: 'token-updated' };
    }
    updateZoneGet() {
        return { ok: true };
    }
    updateZonePost() {
        return { ok: true };
    }
    async updateProfile(req, image, body) {
        const fields = body ?? {};
        const data = {};
        if (fields.f_name !== undefined)
            data.f_name = fields.f_name;
        if (fields.l_name !== undefined)
            data.l_name = fields.l_name;
        if (fields.email !== undefined)
            data.email = fields.email;
        if (fields.phone !== undefined)
            data.phone = fields.phone;
        if (image && image.buffer && image.buffer.length > 0) {
            const ext = (path.extname(image.originalname) || '.jpg').toLowerCase();
            if (!/^\.(png|jpe?g|webp|gif)$/i.test(ext)) {
                return { errors: [{ code: 'ext', message: 'only png/jpg/jpeg/webp/gif allowed' }] };
            }
            const dir = path.join(STORAGE_ROOT, 'profile');
            try {
                fs.mkdirSync(dir, { recursive: true });
                const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
                fs.writeFileSync(path.join(dir, filename), image.buffer);
                data.image = filename;
            }
            catch (e) {
                const msg = e.message || 'image write failed';
                if (Object.keys(data).length === 0) {
                    return { errors: [{ code: 'image', message: msg }] };
                }
            }
        }
        else if (typeof fields.image === 'string' && fields.image.length > 0) {
            data.image = fields.image;
        }
        if (this.useMongo()) {
            if (Object.keys(data).length) {
                await this.mongo.updateOne('users', { mysql_id: Number(req.actor.id) }, data);
            }
            return { message: 'Profile updated successfully', image: data.image ?? null };
        }
        if (Object.keys(data).length) {
            await this.prisma.users.update({ where: { id: req.actor.id }, data });
        }
        return { message: 'Profile updated successfully', image: data.image ?? null };
    }
    async walletBalance(userId) {
        const w = await this.mongo.findOne('wallets', { mysql_user_id: userId });
        return Number(w?.balance ?? 0);
    }
    async setWalletBalance(userId, balance) {
        const w = await this.mongo.findOne('wallets', { mysql_user_id: userId });
        if (w)
            await this.mongo.updateOne('wallets', { mysql_user_id: userId }, { balance, updated_at: new Date() });
        else {
            const id = await this.mongo.nextMysqlId('wallets');
            await this.mongo.insertOne('wallets', { mysql_id: id, mysql_user_id: userId, balance, created_at: new Date(), updated_at: new Date() });
        }
    }
    async walletTx(req, limitStr, offsetStr) {
        const limit = parseInt(limitStr ?? '25', 10);
        const offset = parseInt(offsetStr ?? '1', 10);
        if (!this.useMongo())
            return { data: [], total_size: 0, limit, offset };
        const userId = Number(req.actor.id);
        const filter = { mysql_user_id: userId };
        const [rows, total] = await Promise.all([
            this.mongo.findMany('wallet_transactions', filter, { sort: { mysql_id: -1 }, limit, skip: Math.max(0, (offset - 1) * limit) }),
            this.mongo.count('wallet_transactions', filter),
        ]);
        return {
            data: rows.map((r) => ({
                id: Number(r.mysql_id), credit: Number(r.credit ?? 0), debit: Number(r.debit ?? 0),
                balance: Number(r.balance ?? 0), transaction_type: r.transaction_type ?? null,
                reference: r.reference ?? null, created_at: r.created_at ?? null,
            })),
            total_size: total, limit, offset,
            balance: await this.walletBalance(userId),
        };
    }
    async walletBonuses() {
        if (!this.useMongo())
            return [];
        const rows = await this.mongo.findMany('wallet_bonuses', { $or: [{ status: true }, { status: 1 }] }, { sort: { mysql_id: -1 } });
        return rows.map((r) => ({ ...r, id: Number(r.mysql_id) }));
    }
    async addFund(req, body = {}) {
        if (!this.useMongo())
            return { message: 'Not available in demo' };
        const userId = Number(req.actor.id);
        const amount = Number(body.amount ?? 0);
        if (!Number.isFinite(amount) || amount <= 0)
            return { errors: [{ code: 'amount', message: 'Enter a valid amount' }] };
        const newBalance = (await this.walletBalance(userId)) + amount;
        await this.setWalletBalance(userId, newBalance);
        const txId = await this.mongo.nextMysqlId('wallet_transactions');
        await this.mongo.insertOne('wallet_transactions', {
            mysql_id: txId, mysql_user_id: userId, credit: amount, debit: 0, balance: newBalance,
            transaction_type: 'add_fund', reference: String(body.payment_method ?? 'payment'), created_at: new Date(),
        });
        return { message: 'Fund added to wallet', balance: newBalance };
    }
    async loyaltyTx(req, limitStr, offsetStr) {
        const limit = parseInt(limitStr ?? '25', 10);
        const offset = parseInt(offsetStr ?? '1', 10);
        if (!this.useMongo())
            return { data: [], total_size: 0, limit, offset };
        const userId = Number(req.actor.id);
        const filter = { mysql_user_id: userId };
        const [rows, total] = await Promise.all([
            this.mongo.findMany('loyalty_point_transactions', filter, { sort: { mysql_id: -1 }, limit, skip: Math.max(0, (offset - 1) * limit) }),
            this.mongo.count('loyalty_point_transactions', filter),
        ]);
        return {
            data: rows.map((r) => ({
                id: Number(r.mysql_id), credit: Number(r.credit ?? 0), debit: Number(r.debit ?? 0),
                balance: Number(r.balance ?? 0), transaction_type: r.transaction_type ?? null, created_at: r.created_at ?? null,
            })),
            total_size: total, limit, offset,
        };
    }
    async pointTransfer(req, body = {}) {
        if (!this.useMongo())
            return { message: 'Not available in demo' };
        const lpStatus = await this.mongo.findOne('business_settings', { key: 'loyalty_point_status' });
        if (lpStatus && lpStatus.value != null && !/^(1|true|yes|on)$/i.test(String(lpStatus.value))) {
            return { errors: [{ code: 'loyalty', message: 'Loyalty points are currently disabled' }] };
        }
        const userId = Number(req.actor.id);
        const points = Number(body.point ?? body.points ?? 0);
        if (!Number.isFinite(points) || points <= 0)
            return { errors: [{ code: 'point', message: 'Enter a valid point amount' }] };
        const last = await this.mongo.findMany('loyalty_point_transactions', { mysql_user_id: userId }, { sort: { mysql_id: -1 }, limit: 1 });
        const loyaltyBalance = Number(last[0]?.balance ?? 0);
        if (points > loyaltyBalance)
            return { errors: [{ code: 'point', message: 'Not enough loyalty points' }] };
        const now = new Date();
        const lpId = await this.mongo.nextMysqlId('loyalty_point_transactions');
        await this.mongo.insertOne('loyalty_point_transactions', {
            mysql_id: lpId, mysql_user_id: userId, credit: 0, debit: points, balance: loyaltyBalance - points,
            transaction_type: 'point_to_wallet', transaction_id: `LP${lpId}`, created_at: now,
        });
        const newBalance = (await this.walletBalance(userId)) + points;
        await this.setWalletBalance(userId, newBalance);
        const wtId = await this.mongo.nextMysqlId('wallet_transactions');
        await this.mongo.insertOne('wallet_transactions', {
            mysql_id: wtId, mysql_user_id: userId, credit: points, debit: 0, balance: newBalance,
            transaction_type: 'loyalty_point', reference: 'point_transfer', created_at: now,
        });
        return { message: 'Points transferred to wallet', wallet_balance: newBalance, loyalty_balance: loyaltyBalance - points };
    }
    async messageList(req, type, offsetQ, limitQ) {
        const userId = Number(req.actor.id);
        const limit = parseInt(limitQ ?? '50', 10) || 50;
        const offset = parseInt(offsetQ ?? '1', 10) || 1;
        const cpSlot = String(type ?? '').toLowerCase().includes('deliver') ? 'delivery_man_id' : 'vendor_id';
        const cpType = cpSlot === 'delivery_man_id' ? 'delivery_man' : 'vendor';
        const rows = await this.mongo.findMany('conversations', { user_id: userId, [cpSlot]: { $ne: null } }, { sort: { last_message_at: -1 }, limit: 200 });
        const myProfile = await (0, messaging_helper_1.participantProfile)(this.mongo, 'user_id', userId, storage_url_1.storageFullUrl);
        const paged = rows.slice((offset - 1) * limit, offset * limit);
        const conversations = await Promise.all(paged.map(async (c) => {
            const cpId = Number(c[cpSlot] ?? 0);
            const receiver = await (0, messaging_helper_1.participantProfile)(this.mongo, cpSlot, cpId, storage_url_1.storageFullUrl);
            return {
                id: Number(c.mysql_id),
                sender_id: userId, sender_type: 'user', receiver_id: cpId, receiver_type: cpType,
                unread_message_count: Number(c.unread ?? 0), last_message_id: null,
                last_message_time: c.last_message_at ?? c.created_at ?? null,
                created_at: c.created_at ?? null, updated_at: c.last_message_at ?? null,
                sender: myProfile, receiver,
                last_message: { id: null, conversation_id: Number(c.mysql_id), sender_id: userId, message: c.last_message ?? '', is_seen: 1, files: [] },
            };
        }));
        return { conversations, total_size: rows.length, limit, offset };
    }
    async messageDetails(req, convId) {
        if (!convId)
            return { messages: [] };
        const rows = await this.mongo.findMany('messages', { conversation_id: Number(convId) }, { sort: { mysql_id: 1 }, limit: 100 });
        return {
            messages: rows.map((m) => ({
                id: Number(m.mysql_id),
                conversation_id: Number(m.conversation_id),
                sender_type: m.sender_type,
                sender_id: Number(m.sender_id),
                message: m.message ?? m.body ?? '',
                body: m.message ?? m.body ?? '',
                file_full_url: Array.isArray(m.files)
                    ? m.files.map((f) => (0, storage_url_1.storageFullUrl)('conversation', f)).filter((u) => !!u)
                    : [],
                is_seen: m.is_seen ?? 1,
                sent_by_me: m.sender_type === 'user' && Number(m.sender_id) === Number(req.actor.id),
                created_at: m.created_at ?? null,
            })),
        };
    }
    async messageGet(req, convId) {
        const d = await this.messageDetails(req, convId);
        return { messages: d.messages, total_size: d.messages.length };
    }
    async messageSearch(req, q) {
        if (!q || !q.trim())
            return { conversations: [] };
        const userId = Number(req.actor.id);
        const rows = await this.mongo.findMany('conversations', {
            user_id: userId,
            counterpart_name: { $regex: q, $options: 'i' },
        }, { limit: 25 });
        return { conversations: rows.map((c) => ({ id: Number(c.mysql_id), name: c.counterpart_name, type: c.counterpart_type })) };
    }
    async messageSend(req, files, rawBody) {
        const userId = Number(req.actor.id);
        const body = rawBody ?? {};
        const text = (body.message ?? body.body ?? '').toString();
        const images = await this.saveChatImages(files);
        if (!text.trim() && images.length === 0) {
            return { message: 'message body required' };
        }
        const counterpartType = body.counterpart_type ?? body.receiver_type ?? null;
        const counterpartIdRaw = body.counterpart_id ?? body.receiver_id ?? null;
        const counterpartId = counterpartIdRaw != null ? Number(counterpartIdRaw) : null;
        let convId = body.conversation_id != null ? Number(body.conversation_id) : undefined;
        if (!convId && counterpartType && counterpartId) {
            const cp = await (0, messaging_helper_1.resolveParticipant)(this.mongo, counterpartType, counterpartId);
            if (cp)
                convId = await (0, messaging_helper_1.findOrCreateConversation)(this.mongo, { slot: 'user_id', id: userId }, cp, text);
        }
        if (!convId)
            return { message: 'conversation_id or counterpart required' };
        const msgId = await this.mongo.nextMysqlId('messages');
        await this.mongo.insertOne('messages', {
            mysql_id: msgId,
            conversation_id: convId,
            sender_type: 'user',
            sender_id: userId,
            message: text,
            body: text,
            files: images,
            created_at: new Date(),
        });
        await this.mongo.updateOne('conversations', { mysql_id: convId }, {
            last_message: text || (images.length ? 'Photo' : ''),
            last_message_at: new Date(),
        });
        return { message: 'sent', conversation_id: convId, id: msgId, files: images };
    }
    async saveChatImages(files) {
        if (!files || files.length === 0)
            return [];
        const saved = [];
        for (const file of files) {
            if (!file?.buffer || file.buffer.length === 0)
                continue;
            const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
            if (!/^\.(png|jpe?g|webp|gif)$/i.test(ext))
                continue;
            const compressed = await (0, image_compress_1.compressImage)(file.buffer).catch(() => null);
            const buffer = compressed ? compressed.buffer : file.buffer;
            const outExt = compressed ? compressed.ext : ext;
            const contentType = compressed ? compressed.contentType : `image/${ext.replace('.', '').replace('jpg', 'jpeg')}`;
            const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${outExt}`;
            const relPath = `conversation/${filename}`;
            try {
                const dir = path.join(STORAGE_ROOT, 'conversation');
                fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(path.join(dir, filename), buffer);
            }
            catch {
            }
            try {
                await this.mongo.insertOne('uploads', {
                    path: relPath,
                    content_type: contentType,
                    data: buffer,
                    size: buffer.length,
                    created_at: new Date(),
                });
            }
            catch {
            }
            saved.push(filename);
        }
        return saved;
    }
    async subscription(req) {
        const userId = Number(req.actor.id);
        const rows = await this.mongo.findMany('subscriptions', {
            $or: [{ user_id: userId }, { mysql_user_id: userId }],
        }, { sort: { mysql_id: -1 }, limit: 50 });
        return {
            data: rows.map((s) => ({
                id: Number(s.mysql_id),
                restaurant_id: s.restaurant_id ?? s.mysql_restaurant_id ?? null,
                plan_name: s.plan_name ?? null,
                frequency: s.frequency ?? null,
                status: s.status ?? 'active',
                created_at: s.created_at ?? null,
            })),
        };
    }
    updateInterest() {
        return { ok: true };
    }
    async suggestedFoods() {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('foods', { status: true }, { sort: { avg_rating: -1 }, limit: 10 });
            return {
                products: rows.map((r) => ({
                    ...(r.legacy ?? {}),
                    ...r,
                    id: Number(r.mysql_id),
                    price: toNum(r.price),
                    discount: toNum(r.discount),
                    tax: toNum(r.tax),
                    restaurant_id: r.mysql_restaurant_id !== null && r.mysql_restaurant_id !== undefined ? Number(r.mysql_restaurant_id) : null,
                    category_id: r.mysql_category_id !== null && r.mysql_category_id !== undefined ? Number(r.mysql_category_id) : null,
                })),
            };
        }
        const rows = await this.prisma.food.findMany({
            where: { status: true },
            orderBy: { avg_rating: 'desc' },
            take: 10,
        });
        return { products: rows.map((r) => ({ ...r, id: Number(r.id), price: Number(r.price), discount: Number(r.discount), tax: Number(r.tax), restaurant_id: Number(r.restaurant_id), category_id: r.category_id ? Number(r.category_id) : null })) };
    }
    orderAgain() {
        return [];
    }
    async runningOrders(req) {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('orders', {
                mysql_user_id: Number(req.actor.id),
                order_status: { $in: ['pending', 'confirmed', 'accepted', 'processing', 'handover', 'picked_up'] },
            }, { sort: { mysql_id: -1 }, limit: 25 });
            const orderIds = rows.map((r) => Number(r.mysql_id));
            const countRows = orderIds.length
                ? await this.mongo.aggregate('order_details', [
                    { $match: { order_id: { $in: orderIds } } },
                    { $group: { _id: '$order_id', count: { $sum: 1 } } },
                ])
                : [];
            const countMap = new Map(countRows.map((c) => [Number(c._id), c.count]));
            const restIds = Array.from(new Set(rows.map((r) => Number(r.mysql_restaurant_id ?? 0)).filter((n) => n > 0)));
            const restaurants = restIds.length
                ? await this.mongo.findMany('restaurants', { mysql_id: { $in: restIds } })
                : [];
            const restMap = new Map(restaurants.map((r) => [Number(r.mysql_id), r]));
            const vendIds = Array.from(new Set(restaurants.filter((r) => !r.logo && r.mysql_vendor_id).map((r) => Number(r.mysql_vendor_id))));
            const vendImg = new Map();
            if (vendIds.length) {
                const vendors = await this.mongo.findMany('vendors', { mysql_id: { $in: vendIds } });
                for (const v of vendors)
                    vendImg.set(Number(v.mysql_id), v.image ?? null);
            }
            const me = await this.mongo.findByMysqlId('users', Number(req.actor.id));
            const myName = me ? `${me.f_name ?? ''} ${me.l_name ?? ''}`.trim() || null : null;
            return rows.map((r) => {
                const itemsField = r.items;
                const embedded = Array.isArray(itemsField) ? itemsField.length : 0;
                const detailsCount = embedded || countMap.get(Number(r.mysql_id)) || 1;
                const rest = restMap.get(Number(r.mysql_restaurant_id ?? 0));
                const vimg = rest && !rest.logo ? (vendImg.get(Number(rest.mysql_vendor_id ?? 0)) ?? null) : null;
                const restaurantPayload = rest ? {
                    id: Number(rest.mysql_id),
                    name: rest.name ?? null,
                    logo: rest.logo ?? vimg ?? null,
                    logo_full_url: (0, storage_url_1.storageFullUrl)('restaurant', rest.logo ?? null) ?? (0, storage_url_1.storageFullUrl)('profile', vimg),
                } : null;
                const rawAddr = r.delivery_address;
                const addrObj = rawAddr && typeof rawAddr === 'object'
                    ? { ...rawAddr }
                    : (typeof rawAddr === 'string' ? { address: rawAddr } : {});
                if (!addrObj.contact_person_name && myName)
                    addrObj.contact_person_name = myName;
                return {
                    ...(r.legacy ?? {}),
                    ...r,
                    id: Number(r.mysql_id),
                    user_id: r.mysql_user_id !== null && r.mysql_user_id !== undefined ? Number(r.mysql_user_id) : null,
                    restaurant_id: r.mysql_restaurant_id !== null && r.mysql_restaurant_id !== undefined ? Number(r.mysql_restaurant_id) : 0,
                    order_amount: toNum(r.order_amount),
                    details_count: detailsCount,
                    restaurant: restaurantPayload,
                    delivery_address: addrObj,
                };
            });
        }
        const rows = await this.prisma.orders.findMany({
            where: {
                user_id: req.actor.id,
                order_status: { in: ['pending', 'confirmed', 'accepted', 'processing', 'handover', 'picked_up'] },
            },
            orderBy: { id: 'desc' },
            take: 25,
        });
        return rows.map((r) => ({ ...r, id: Number(r.id), user_id: r.user_id ? Number(r.user_id) : null, restaurant_id: Number(r.restaurant_id), order_amount: Number(r.order_amount) }));
    }
    async orderSubscriptionList(req) {
        const userId = Number(req.actor.id);
        const orderRows = await this.mongo.findMany('orders', { mysql_user_id: userId, subscription_id: { $ne: null } }, {
            sort: { mysql_id: -1 }, limit: 25,
        });
        return {
            data: orderRows.map((o) => ({
                id: Number(o.mysql_id),
                restaurant_id: o.mysql_restaurant_id ?? null,
                subscription_id: o.subscription_id ?? null,
                order_status: o.order_status ?? 'pending',
                order_amount: toNum(o.order_amount),
                schedule_at: o.schedule_at ?? null,
                created_at: o.created_at_legacy ?? null,
            })),
            total_size: orderRows.length,
            limit: 25,
            offset: 1,
        };
    }
    async orderDetails(req, orderId) {
        const order = await this.mongo.findByMysqlId('orders', Number(orderId));
        const [user, restaurant, deliveryMan, items] = await Promise.all([
            order?.mysql_user_id != null
                ? this.mongo.findByMysqlId('users', Number(order.mysql_user_id))
                : Promise.resolve(null),
            order?.mysql_restaurant_id != null
                ? this.mongo.findByMysqlId('restaurants', Number(order.mysql_restaurant_id))
                : Promise.resolve(null),
            order?.mysql_delivery_man_id != null
                ? this.mongo.findByMysqlId('delivery_men', Number(order.mysql_delivery_man_id))
                : Promise.resolve(null),
            this.mongo.findMany('order_details', {
                $or: [{ order_id: Number(orderId) }, { mysql_order_id: Number(orderId) }],
            }),
        ]);
        const customerName = user ? [user.f_name, user.l_name].filter(Boolean).join(' ').trim() || null : null;
        const restaurantPayload = restaurant ? {
            id: Number(restaurant.mysql_id),
            name: restaurant.name ?? null,
            phone: restaurant.phone ?? null,
            email: restaurant.email ?? null,
            address: restaurant.address ?? null,
            logo: restaurant.logo ?? null,
            latitude: restaurant.latitude ?? null,
            longitude: restaurant.longitude ?? null,
        } : null;
        const dmPayload = deliveryMan ? {
            id: Number(deliveryMan.mysql_id),
            f_name: deliveryMan.f_name ?? null,
            l_name: deliveryMan.l_name ?? null,
            phone: deliveryMan.phone ?? null,
        } : null;
        return items.map((it) => ({
            ...(it.legacy ?? {}),
            ...it,
            id: Number(it.mysql_id),
            food_id: it.mysql_food_id != null ? Number(it.mysql_food_id) : null,
            order_id: it.mysql_order_id != null ? Number(it.mysql_order_id) : null,
            price: toNum(it.price),
            tax_amount: toNum(it.tax_amount),
            total_add_on_price: toNum(it.total_add_on_price),
            item_campaign_id: it.mysql_item_campaign_id != null ? Number(it.mysql_item_campaign_id) : null,
            discount_on_food: it.discount_on_food != null ? toNum(it.discount_on_food) : null,
            customer_name: customerName,
            customer_phone: user?.phone ?? null,
            customer_email: user?.email ?? null,
            delivery_address: order?.delivery_address ?? null,
            restaurant: restaurantPayload,
            delivery_man: dmPayload,
        }));
    }
    async cancelOrder(req, body) {
        const id = body.order_id;
        if (!id)
            return { message: 'order_id required' };
        if (this.useMongo()) {
            const order = await this.mongo.findOne('orders', {
                mysql_id: Number(id),
                mysql_user_id: Number(req.actor.id),
            });
            if (!order)
                return { message: 'order not found' };
            if (!this.lifecycle.canCancel(order, 'customer')) {
                return { message: 'This order can no longer be cancelled.' };
            }
            await this.lifecycle.cancelOrder(Number(order.mysql_id), 'customer_cancelled', 'customer');
            return { message: 'Order canceled' };
        }
        const order = await this.prisma.orders.findFirst({ where: { id: BigInt(id), user_id: req.actor.id } });
        if (!order)
            return { message: 'order not found' };
        await this.prisma.orders.update({
            where: { id: order.id },
            data: {
                order_status: 'canceled',
                canceled: new Date(),
                canceled_by: 'customer',
                cancellation_reason: body.reason ?? null,
            },
        });
        return { message: 'Order canceled' };
    }
    switchPaymentMethod() {
        return { message: 'Payment method updated' };
    }
    async refundReasons() {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('refund_reasons', { status: { $ne: false } }, { sort: { mysql_id: 1 } });
            return { refund_reasons: rows.map((r) => ({ id: Number(r.mysql_id), reason: r.reason ?? null, status: 1 })) };
        }
        const rows = await this.prisma.refund_reasons.findMany({ where: { status: true } });
        return { refund_reasons: rows.map((r) => ({ id: Number(r.id), reason: r.reason, status: 1 })) };
    }
    async refundRequest(req, body = {}) {
        const b = body ?? {};
        const orderId = Number(b.order_id ?? 0);
        if (!orderId)
            return { errors: [{ code: 'order_id', message: 'order_id required' }] };
        if (this.useMongo()) {
            const order = await this.mongo.findOne('orders', {
                mysql_id: orderId,
                mysql_user_id: Number(req.actor.id),
            });
            if (!order)
                return { message: 'order not found' };
            const nextId = await this.mongo.nextMysqlId('refunds');
            const now = new Date();
            await this.mongo.insertOne('refunds', {
                mysql_id: nextId,
                mysql_order_id: order.mysql_id,
                mysql_user_id: Number(req.actor.id),
                order_status: order.order_status ?? null,
                customer_reason: b.customer_reason ?? null,
                customer_note: b.customer_note ?? null,
                refund_amount: toNum(order.order_amount),
                refund_status: 'pending',
                refund_method: 'wallet',
                created_at: now,
                updated_at: now,
            });
            return { message: 'Refund request submitted' };
        }
        const order = await this.prisma.orders.findFirst({ where: { id: BigInt(orderId), user_id: req.actor.id } });
        if (!order)
            return { message: 'order not found' };
        await this.prisma.refunds.create({
            data: {
                order_id: order.id,
                user_id: req.actor.id,
                order_status: order.order_status,
                customer_reason: b.customer_reason ?? null,
                customer_note: b.customer_note ?? null,
                refund_amount: order.order_amount,
                refund_status: 'pending',
                refund_method: 'wallet',
            },
        });
        return { message: 'Refund request submitted' };
    }
    getOrderTax() {
        return { total_tax_amount: 0, tax_amount: 0 };
    }
    sendNotification() {
        return { ok: true };
    }
    sendNotificationById() {
        return { ok: true };
    }
    checkRestaurantValidation() {
        return { message: 'valid' };
    }
    offlinePayment() {
        return { message: 'recorded' };
    }
    offlinePaymentUpdate() {
        return { message: 'recorded' };
    }
    async foodList(idsStr) {
        const ids = (idsStr ?? '').split(',').map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n));
        if (!ids.length)
            return [];
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('foods', { mysql_id: { $in: ids } });
            return rows.map((r) => ({
                ...(r.legacy ?? {}),
                ...r,
                id: Number(r.mysql_id),
                price: toNum(r.price),
                tax: toNum(r.tax),
                discount: toNum(r.discount),
                restaurant_id: r.mysql_restaurant_id !== null && r.mysql_restaurant_id !== undefined ? Number(r.mysql_restaurant_id) : 0,
                category_id: r.mysql_category_id !== null && r.mysql_category_id !== undefined ? Number(r.mysql_category_id) : null,
            }));
        }
        const rows = await this.prisma.food.findMany({ where: { id: { in: ids.map((n) => BigInt(n)) } } });
        return rows.map((r) => ({ ...r, id: Number(r.id), price: Number(r.price), tax: Number(r.tax), discount: Number(r.discount), restaurant_id: Number(r.restaurant_id), category_id: r.category_id ? Number(r.category_id) : null }));
    }
    cartAddMultiple() {
        return { message: 'added' };
    }
    async deleteAddress(req, addressId) {
        if (this.useMongo()) {
            const doc = await this.mongo.findOne('customer_addresses', { mysql_id: Number(addressId) });
            if (doc) {
                const ownerId = (doc.mysql_user_id ?? doc.user_id ?? null);
                if (ownerId !== null && Number(ownerId) === Number(req.actor.id)) {
                    await this.mongo.deleteOne('customer_addresses', { mysql_id: Number(addressId) });
                }
            }
            return { message: 'Address deleted' };
        }
        await this.prisma.customer_addresses.deleteMany({
            where: { id: BigInt(addressId), user_id: req.actor.id },
        });
        return { message: 'Address deleted' };
    }
    async updateAddress(id, req, body) {
        const data = {};
        for (const [k, v] of Object.entries(body)) {
            if (v !== undefined)
                data[k] = v;
        }
        if (this.useMongo()) {
            const doc = await this.mongo.findOne('customer_addresses', { mysql_id: Number(id) });
            if (doc) {
                const ownerId = (doc.mysql_user_id ?? doc.user_id ?? null);
                if (ownerId !== null && Number(ownerId) === Number(req.actor.id)) {
                    await this.mongo.updateOne('customer_addresses', { mysql_id: Number(id) }, { ...data, updated_at: new Date() });
                }
            }
            return { message: 'Address updated' };
        }
        await this.prisma.customer_addresses.updateMany({
            where: { id: BigInt(id), user_id: req.actor.id },
            data,
        });
        return { message: 'Address updated' };
    }
    setDefaultAddress() {
        return { message: 'default set' };
    }
    removeAccount() {
        return { message: 'Not available in demo' };
    }
};
exports.CustomerExtrasController = CustomerExtrasController;
__decorate([
    (0, common_1.Get)('wish-list'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "wishList", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('wish-list/add'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "wishAdd", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('wish-list/remove'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('food_id')),
    __param(2, (0, common_1.Query)('restaurant_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "wishRemove", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('wish-list/clear-all'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "wishClear", null);
__decorate([
    (0, common_1.Get)('notifications'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "notifications", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('cm-firebase-token'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "fcmToken", null);
__decorate([
    (0, common_1.Get)('update-zone'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "updateZoneGet", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-zone'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "updateZonePost", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-profile'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('image', { limits: { fileSize: 5 * 1024 * 1024 } })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.Get)('wallet/transactions'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "walletTx", null);
__decorate([
    (0, common_1.Get)('wallet/bonuses'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "walletBonuses", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('wallet/add-fund'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "addFund", null);
__decorate([
    (0, common_1.Get)('loyalty-point/transactions'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "loyaltyTx", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('loyalty-point/point-transfer'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "pointTransfer", null);
__decorate([
    (0, common_1.Get)('message/list'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('type')),
    __param(2, (0, common_1.Query)('offset')),
    __param(3, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "messageList", null);
__decorate([
    (0, common_1.Get)('message/details'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('conversation_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "messageDetails", null);
__decorate([
    (0, common_1.Get)('message/get'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('conversation_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "messageGet", null);
__decorate([
    (0, common_1.Get)('message/search-list'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "messageSearch", null);
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
], CustomerExtrasController.prototype, "messageSend", null);
__decorate([
    (0, common_1.Get)('subscription'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "subscription", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-interest'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "updateInterest", null);
__decorate([
    (0, common_1.Get)('suggested-foods'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "suggestedFoods", null);
__decorate([
    (0, common_1.Get)('order-again'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "orderAgain", null);
__decorate([
    (0, common_1.Get)('order/running-orders'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "runningOrders", null);
__decorate([
    (0, common_1.Get)('order/order-subscription-list'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "orderSubscriptionList", null);
__decorate([
    (0, common_1.Get)('order/details'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('order_id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "orderDetails", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('order/cancel'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "cancelOrder", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('order/payment-method'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "switchPaymentMethod", null);
__decorate([
    (0, common_1.Get)('order/refund-reasons'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "refundReasons", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('order/refund-request'),
    (0, common_1.UseInterceptors)((0, platform_express_1.AnyFilesInterceptor)({ limits: { fileSize: 10 * 1024 * 1024 } })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "refundRequest", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('order/get-Tax'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "getOrderTax", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('order/send-notification'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "sendNotification", null);
__decorate([
    (0, common_1.Get)('order/send-notification/:id'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "sendNotificationById", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('order/check-restaurant-validation'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "checkRestaurantValidation", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('order/offline-payment'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "offlinePayment", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('order/offline-payment-update'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "offlinePaymentUpdate", null);
__decorate([
    (0, common_1.Get)('food-list'),
    __param(0, (0, common_1.Query)('ids')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "foodList", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('cart/add-multiple'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "cartAddMultiple", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('address/delete'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('address_id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "deleteAddress", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('address/update/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "updateAddress", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('address/set-default'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "setDefaultAddress", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('remove-account'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "removeAccount", null);
exports.CustomerExtrasController = CustomerExtrasController = __decorate([
    (0, common_1.Controller)('customer'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, auth_guard_1.RequireAuth)('customer'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        mongo_data_service_1.MongoDataService,
        order_lifecycle_service_1.OrderLifecycleService])
], CustomerExtrasController);
//# sourceMappingURL=customer-extras.controller.js.map