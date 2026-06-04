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
exports.CustomerService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const mongo_data_service_1 = require("../mongo/mongo-data.service");
let CustomerService = class CustomerService {
    prisma;
    mongo;
    constructor(prisma, mongo) {
        this.prisma = prisma;
        this.mongo = mongo;
    }
    useMongo() {
        const v = (process.env.USE_MONGO_CUSTOMER ?? '1').toLowerCase();
        return v === '1' || v === 'true' || v === 'yes';
    }
    storageBase() {
        return process.env.STORAGE_BASE_URL ?? 'http://127.0.0.1:3000/storage';
    }
    async info(userId) {
        if (this.useMongo()) {
            const u = await this.mongo.findByMysqlId('users', Number(userId));
            if (!u)
                throw new common_1.NotFoundException({ errors: [{ code: 'user', message: 'not_found' }] });
            const legacy = (u.legacy ?? {});
            const num = (v) => {
                if (v === null || v === undefined)
                    return 0;
                if (typeof v === 'number')
                    return v;
                if (typeof v === 'string')
                    return Number(v) || 0;
                if (typeof v === 'object' && v !== null && 'toNumber' in v && typeof v.toNumber === 'function') {
                    return v.toNumber();
                }
                return Number(v) || 0;
            };
            return {
                id: Number(u.mysql_id),
                f_name: u.f_name ?? null,
                l_name: u.l_name ?? null,
                phone: u.phone ?? null,
                email: u.email ?? null,
                image: u.image ?? null,
                image_full_url: u.image ? `${this.storageBase()}/profile/${u.image}` : null,
                is_phone_verified: u.is_phone_verified ? 1 : 0,
                is_email_verified: u.is_email_verified ? 1 : 0,
                email_verified_at: legacy.email_verified_at ?? null,
                auth_token: legacy.auth_token ?? null,
                created_at: legacy.created_at ?? null,
                updated_at: legacy.updated_at ?? null,
                status: u.status ? 1 : 0,
                order_count: num(legacy.order_count),
                login_medium: legacy.login_medium ?? null,
                wallet_balance: num(legacy.wallet_balance),
                loyalty_point: num(legacy.loyalty_point),
                ref_code: u.ref_code ?? null,
                current_language_key: legacy.current_language_key ?? null,
                userinfo: null,
                member_since_days: 0,
                is_valid_for_discount: false,
                discount_amount: 0,
                discount_amount_type: '',
                validity: '',
            };
        }
        const u = await this.prisma.users.findUnique({ where: { id: userId } });
        if (!u)
            throw new common_1.NotFoundException({ errors: [{ code: 'user', message: 'not_found' }] });
        return {
            id: u.id,
            f_name: u.f_name,
            l_name: u.l_name,
            phone: u.phone,
            email: u.email,
            image: u.image,
            image_full_url: u.image ? `${this.storageBase()}/profile/${u.image}` : null,
            is_phone_verified: u.is_phone_verified ? 1 : 0,
            is_email_verified: u.is_email_verified ? 1 : 0,
            email_verified_at: u.email_verified_at,
            auth_token: u.auth_token,
            created_at: u.created_at,
            updated_at: u.updated_at,
            status: u.status ? 1 : 0,
            order_count: u.order_count,
            login_medium: u.login_medium,
            wallet_balance: Number(u.wallet_balance ?? 0),
            loyalty_point: Number(u.loyalty_point ?? 0),
            ref_code: u.ref_code,
            current_language_key: u.current_language_key,
            userinfo: null,
            member_since_days: 0,
            is_valid_for_discount: false,
            discount_amount: 0,
            discount_amount_type: '',
            validity: '',
        };
    }
    async listAddresses(userId) {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('customer_addresses', { user_id: Number(userId) }, { sort: { mysql_id: -1 } });
            return {
                total_size: rows.length,
                limit: 10,
                offset: 1,
                addresses: rows.map((a) => ({
                    id: Number(a.mysql_id),
                    address_type: a.address_type ?? null,
                    contact_person_number: a.contact_person_number ?? null,
                    contact_person_name: a.contact_person_name ?? null,
                    address: a.address ?? null,
                    latitude: a.latitude ?? null,
                    longitude: a.longitude ?? null,
                    user_id: a.user_id ?? null,
                    zone_id: a.zone_id ?? null,
                    floor: a.floor ?? null,
                    road: a.road ?? null,
                    house: a.house ?? null,
                    is_default: a.is_default ? 1 : 0,
                })),
            };
        }
        const rows = await this.prisma.customer_addresses.findMany({
            where: { user_id: userId },
            orderBy: { id: 'desc' },
        });
        return {
            total_size: rows.length,
            limit: 10,
            offset: 1,
            addresses: rows.map((a) => ({
                id: a.id,
                address_type: a.address_type,
                contact_person_number: a.contact_person_number,
                contact_person_name: a.contact_person_name,
                address: a.address,
                latitude: a.latitude,
                longitude: a.longitude,
                user_id: a.user_id,
                zone_id: a.zone_id,
                floor: a.floor,
                road: a.road,
                house: a.house,
                is_default: a.is_default ? 1 : 0,
            })),
        };
    }
    async addAddress(userId, body) {
        if (this.useMongo()) {
            const nextId = await this.mongo.nextMysqlId('customer_addresses');
            const now = new Date();
            const doc = {
                mysql_id: nextId,
                user_id: Number(userId),
                address_type: body.address_type ?? 'home',
                contact_person_number: body.contact_person_number ?? '',
                contact_person_name: body.contact_person_name ?? null,
                address: body.address ?? null,
                latitude: body.latitude ?? null,
                longitude: body.longitude ?? null,
                zone_id: body.zone_id ? Number(body.zone_id) : null,
                floor: body.floor ?? null,
                road: body.road ?? null,
                house: body.house ?? null,
                is_default: false,
                created_at: now,
                updated_at: now,
            };
            await this.mongo.insertOne('customer_addresses', doc);
            return { message: 'successfully added!', address_id: nextId };
        }
        const created = await this.prisma.customer_addresses.create({
            data: {
                address_type: body.address_type ?? 'home',
                contact_person_number: body.contact_person_number ?? '',
                contact_person_name: body.contact_person_name,
                address: body.address,
                latitude: body.latitude,
                longitude: body.longitude,
                user_id: userId,
                zone_id: body.zone_id ? BigInt(body.zone_id) : undefined,
                floor: body.floor,
                road: body.road,
                house: body.house,
                is_default: false,
            },
        });
        return { message: 'successfully added!', address_id: created.id };
    }
    async getCart(identity) {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('carts', { user_id: Number(identity.id), is_guest: identity.guest }, { sort: { mysql_id: 1 } });
            const itemIds = rows
                .map((r) => (r.item_id !== null && r.item_id !== undefined ? Number(r.item_id) : null))
                .filter((v) => v !== null);
            const foods = itemIds.length
                ? await this.mongo.findMany('foods', { mysql_id: { $in: itemIds } })
                : [];
            const foodById = new Map(foods.map((f) => [Number(f.mysql_id), f]));
            return rows.map((c) => this.serializeMongoCartRow(c, foodById.get(Number(c.item_id ?? 0)) ?? null));
        }
        const rows = await this.prisma.carts.findMany({
            where: { user_id: identity.id, is_guest: identity.guest },
            orderBy: { id: 'asc' },
        });
        const itemIds = rows.map((r) => r.item_id);
        const foods = itemIds.length
            ? await this.prisma.food.findMany({ where: { id: { in: itemIds } } })
            : [];
        const foodById = new Map(foods.map((f) => [f.id, f]));
        return rows.map((c) => this.serializeCartRow(c, foodById.get(c.item_id) ?? null));
    }
    serializeMongoCartRow(c, f) {
        const arr = (x) => (Array.isArray(x) ? x : []);
        const toIso = (d) => {
            if (!d)
                return null;
            if (d instanceof Date)
                return d.toISOString();
            try {
                return new Date(d).toISOString();
            }
            catch {
                return null;
            }
        };
        return {
            id: Number(c.mysql_id),
            user_id: Number(c.user_id ?? 0),
            item_id: Number(c.item_id ?? 0),
            is_guest: !!c.is_guest,
            item_type: c.item_type ?? 'App\\Models\\Food',
            price: Number(c.price ?? 0),
            quantity: Number(c.quantity ?? 0),
            variations: arr(this.safeParse(typeof c.variations === 'string' ? c.variations : JSON.stringify(c.variations ?? []))),
            variation_options: arr(this.safeParse(typeof c.variation_options === 'string' ? c.variation_options : JSON.stringify(c.variation_options ?? []))),
            add_on_ids: arr(this.safeParse(typeof c.add_on_ids === 'string' ? c.add_on_ids : JSON.stringify(c.add_on_ids ?? []))),
            add_on_qtys: arr(this.safeParse(typeof c.add_on_qtys === 'string' ? c.add_on_qtys : JSON.stringify(c.add_on_qtys ?? []))),
            created_at: toIso(c.created_at ?? null),
            updated_at: toIso(c.updated_at ?? null),
            item: f
                ? {
                    id: Number(f.mysql_id),
                    name: f.name ?? null,
                    description: f.description ?? null,
                    image: f.image ?? null,
                    image_full_url: f.image ? `${this.storageBase()}/product/${f.image}` : null,
                    restaurant_id: Number(f.mysql_restaurant_id ?? 0),
                    price: Number(f.price ?? 0),
                    veg: f.veg ? 1 : 0,
                }
                : null,
        };
    }
    serializeCartRow(c, f) {
        const arr = (x) => (Array.isArray(x) ? x : []);
        return {
            id: Number(c.id),
            user_id: Number(c.user_id),
            item_id: Number(c.item_id),
            is_guest: c.is_guest,
            item_type: c.item_type,
            price: Number(c.price),
            quantity: c.quantity,
            variations: arr(this.safeParse(c.variations)),
            variation_options: arr(this.safeParse(c.variation_options)),
            add_on_ids: arr(this.safeParse(c.add_on_ids)),
            add_on_qtys: arr(this.safeParse(c.add_on_qtys)),
            created_at: c.created_at?.toISOString() ?? null,
            updated_at: c.updated_at?.toISOString() ?? null,
            item: f
                ? {
                    id: Number(f.id),
                    name: f.name,
                    description: f.description,
                    image: f.image,
                    image_full_url: f.image ? `${this.storageBase()}/product/${f.image}` : null,
                    restaurant_id: Number(f.restaurant_id),
                    price: Number(f.price),
                    veg: f.veg ? 1 : 0,
                }
                : null,
        };
    }
    safeParse(s) {
        if (!s)
            return [];
        try {
            return JSON.parse(s);
        }
        catch {
            return s;
        }
    }
    async addToCart(identity, body) {
        if (!body.item_id) {
            return { errors: [{ code: 'item_id', message: 'required' }] };
        }
        if (this.useMongo()) {
            const itemIdNum = Number(body.item_id);
            const food = await this.mongo.findByMysqlId('foods', itemIdNum);
            if (!food)
                throw new common_1.NotFoundException({ errors: [{ code: 'item_id', message: 'not_found' }] });
            const existing = await this.mongo.findOne('carts', {
                user_id: Number(identity.id),
                item_id: itemIdNum,
                is_guest: identity.guest,
            });
            if (existing) {
                await this.mongo.updateOne('carts', { mysql_id: existing.mysql_id }, {
                    quantity: Number(existing.quantity ?? 0) + (body.quantity ?? 1),
                    updated_at: new Date(),
                });
            }
            else {
                const nextId = await this.mongo.nextMysqlId('carts');
                const now = new Date();
                await this.mongo.insertOne('carts', {
                    mysql_id: nextId,
                    user_id: Number(identity.id),
                    item_id: itemIdNum,
                    is_guest: identity.guest,
                    item_type: body.model ?? 'App\\Models\\Food',
                    price: body.price ?? Number(food.price ?? 0),
                    quantity: body.quantity ?? 1,
                    variations: JSON.stringify(body.variations ?? []),
                    variation_options: JSON.stringify(body.variation_options ?? []),
                    add_on_ids: JSON.stringify(body.add_on_ids ?? []),
                    add_on_qtys: JSON.stringify(body.add_on_qtys ?? []),
                    created_at: now,
                    updated_at: now,
                });
            }
            return this.getCart(identity);
        }
        const itemId = BigInt(body.item_id);
        const food = await this.prisma.food.findUnique({ where: { id: itemId } });
        if (!food)
            throw new common_1.NotFoundException({ errors: [{ code: 'item_id', message: 'not_found' }] });
        const existing = await this.prisma.carts.findFirst({
            where: { user_id: identity.id, item_id: itemId, is_guest: identity.guest },
        });
        if (existing) {
            await this.prisma.carts.update({
                where: { id: existing.id },
                data: { quantity: existing.quantity + (body.quantity ?? 1) },
            });
        }
        else {
            await this.prisma.carts.create({
                data: {
                    user_id: identity.id,
                    item_id: itemId,
                    is_guest: identity.guest,
                    item_type: body.model ?? 'App\\Models\\Food',
                    price: body.price ?? Number(food.price),
                    quantity: body.quantity ?? 1,
                    variations: JSON.stringify(body.variations ?? []),
                    variation_options: JSON.stringify(body.variation_options ?? []),
                    add_on_ids: JSON.stringify(body.add_on_ids ?? []),
                    add_on_qtys: JSON.stringify(body.add_on_qtys ?? []),
                },
            });
        }
        return this.getCart(identity);
    }
    async updateCart(identity, cartId, quantity) {
        if (this.useMongo()) {
            const c = await this.mongo.findOne('carts', {
                mysql_id: Number(cartId),
                user_id: Number(identity.id),
                is_guest: identity.guest,
            });
            if (!c)
                throw new common_1.NotFoundException({ errors: [{ code: 'cart_id', message: 'not_found' }] });
            await this.mongo.updateOne('carts', { mysql_id: c.mysql_id }, { quantity, updated_at: new Date() });
            return this.getCart(identity);
        }
        const c = await this.prisma.carts.findFirst({
            where: { id: BigInt(cartId), user_id: identity.id, is_guest: identity.guest },
        });
        if (!c)
            throw new common_1.NotFoundException({ errors: [{ code: 'cart_id', message: 'not_found' }] });
        await this.prisma.carts.update({ where: { id: c.id }, data: { quantity } });
        return this.getCart(identity);
    }
    async removeCartItem(identity, cartId) {
        if (this.useMongo()) {
            const c = await this.mongo.findOne('carts', {
                mysql_id: Number(cartId),
                user_id: Number(identity.id),
                is_guest: identity.guest,
            });
            if (!c)
                throw new common_1.NotFoundException({ errors: [{ code: 'cart_id', message: 'not_found' }] });
            await this.mongo.deleteOne('carts', { mysql_id: c.mysql_id });
            return this.getCart(identity);
        }
        const c = await this.prisma.carts.findFirst({
            where: { id: BigInt(cartId), user_id: identity.id, is_guest: identity.guest },
        });
        if (!c)
            throw new common_1.NotFoundException({ errors: [{ code: 'cart_id', message: 'not_found' }] });
        await this.prisma.carts.delete({ where: { id: c.id } });
        return this.getCart(identity);
    }
    async clearCart(identity) {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('carts', {
                user_id: Number(identity.id),
                is_guest: identity.guest,
            });
            for (const r of rows) {
                await this.mongo.deleteOne('carts', { mysql_id: r.mysql_id });
            }
            return this.getCart(identity);
        }
        await this.prisma.carts.deleteMany({
            where: { user_id: identity.id, is_guest: identity.guest },
        });
        return this.getCart(identity);
    }
};
exports.CustomerService = CustomerService;
exports.CustomerService = CustomerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        mongo_data_service_1.MongoDataService])
], CustomerService);
//# sourceMappingURL=customer.service.js.map