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
exports.OpsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const mongo_data_service_1 = require("../mongo/mongo-data.service");
const VENDOR_STATUSES = ['accepted', 'confirmed', 'processing', 'handover'];
const DM_STATUSES = ['picked_up', 'delivered'];
let OpsService = class OpsService {
    prisma;
    mongo;
    constructor(prisma, mongo) {
        this.prisma = prisma;
        this.mongo = mongo;
    }
    useMongo() {
        const v = (process.env.USE_MONGO_OPS ?? '1').toLowerCase();
        return v === '1' || v === 'true' || v === 'yes';
    }
    storageBase() {
        return process.env.STORAGE_BASE_URL ?? 'http://127.0.0.1:3000/storage';
    }
    async restaurantForVendor(vendorId) {
        return this.prisma.restaurants.findFirst({ where: { vendor_id: vendorId } });
    }
    async restaurantForVendorMongo(vendorId) {
        return this.mongo.findOne('restaurants', { mysql_vendor_id: Number(vendorId) });
    }
    async loadOrderDetails(orderId) {
        const order = await this.prisma.orders.findUnique({ where: { id: orderId } });
        if (!order)
            return null;
        const details = await this.prisma.order_details.findMany({ where: { order_id: orderId } });
        return { order, details };
    }
    mapOrder(o) {
        return {
            id: o.id,
            user_id: o.user_id,
            order_status: o.order_status,
            payment_status: o.payment_status,
            payment_method: o.payment_method,
            order_amount: Number(o.order_amount),
            delivery_charge: Number(o.delivery_charge),
            total_tax_amount: Number(o.total_tax_amount),
            restaurant_id: o.restaurant_id,
            delivery_man_id: o.delivery_man_id,
            delivery_address_id: o.delivery_address_id,
            delivery_address: o.delivery_address,
            order_type: o.order_type,
            otp: o.otp,
            pending: o.pending,
            accepted: o.accepted,
            confirmed: o.confirmed,
            processing: o.processing,
            handover: o.handover,
            picked_up: o.picked_up,
            delivered: o.delivered,
            canceled: o.canceled,
            created_at: o.created_at,
        };
    }
    mapMongoOrder(o) {
        return {
            id: Number(o.mysql_id),
            user_id: o.mysql_user_id != null ? Number(o.mysql_user_id) : null,
            order_status: o.order_status ?? '',
            payment_status: o.payment_status ?? '',
            payment_method: o.payment_method ?? null,
            order_amount: Number(o.order_amount ?? 0),
            delivery_charge: Number(o.delivery_charge ?? 0),
            total_tax_amount: Number(o.total_tax_amount ?? 0),
            restaurant_id: o.mysql_restaurant_id != null ? Number(o.mysql_restaurant_id) : 0,
            delivery_man_id: o.mysql_delivery_man_id != null ? Number(o.mysql_delivery_man_id) : null,
            delivery_address_id: o.delivery_address_id != null ? Number(o.delivery_address_id) : null,
            delivery_address: o.delivery_address ?? null,
            order_type: o.order_type ?? '',
            otp: o.otp ?? null,
            pending: o.pending ?? null,
            accepted: o.accepted ?? null,
            confirmed: o.confirmed ?? null,
            processing: o.processing ?? null,
            handover: o.handover ?? null,
            picked_up: o.picked_up ?? null,
            delivered: o.delivered ?? null,
            canceled: o.canceled ?? null,
            created_at: o.created_at_legacy ?? o.created_at ?? null,
        };
    }
    async vendorOrders(vendorId, status) {
        if (this.useMongo()) {
            const restaurant = await this.restaurantForVendorMongo(vendorId);
            if (!restaurant)
                throw new common_1.NotFoundException({ errors: [{ code: 'restaurant', message: 'not_found' }] });
            const filter = { mysql_restaurant_id: Number(restaurant.mysql_id) };
            if (status && status !== 'all') {
                if (status === 'ongoing') {
                    filter.order_status = { $in: ['accepted', 'confirmed', 'processing', 'handover', 'picked_up'] };
                }
                else {
                    filter.order_status = status;
                }
            }
            const orders = await this.mongo.findMany('orders', filter, { sort: { mysql_id: -1 } });
            return {
                total_size: orders.length,
                limit: 20,
                offset: 1,
                orders: orders.map((o) => this.mapMongoOrder(o)),
            };
        }
        const restaurant = await this.restaurantForVendor(vendorId);
        if (!restaurant)
            throw new common_1.NotFoundException({ errors: [{ code: 'restaurant', message: 'not_found' }] });
        const where = {
            restaurant_id: restaurant.id,
        };
        if (status && status !== 'all') {
            if (status === 'ongoing')
                where.order_status = { in: ['accepted', 'confirmed', 'processing', 'handover', 'picked_up'] };
            else
                where.order_status = status;
        }
        const orders = await this.prisma.orders.findMany({ where, orderBy: { id: 'desc' } });
        return {
            total_size: orders.length,
            limit: 20,
            offset: 1,
            orders: orders.map((o) => this.mapOrder(o)),
        };
    }
    async vendorOrderDetail(vendorId, orderId) {
        if (this.useMongo()) {
            const restaurant = await this.restaurantForVendorMongo(vendorId);
            if (!restaurant)
                throw new common_1.NotFoundException({ errors: [{ code: 'restaurant', message: 'not_found' }] });
            const order = await this.mongo.findByMysqlId('orders', orderId);
            if (!order || Number(order.mysql_restaurant_id) !== Number(restaurant.mysql_id)) {
                throw new common_1.NotFoundException({ errors: [{ code: 'order_id', message: 'not_found' }] });
            }
            const details = await this.mongo.findMany('order_details', { order_id: Number(order.mysql_id) }, { sort: { mysql_id: 1 } });
            const customer = order.mysql_user_id
                ? await this.mongo.findByMysqlId('users', Number(order.mysql_user_id))
                : null;
            return {
                ...this.mapMongoOrder(order),
                details: details.map((d) => ({
                    id: Number(d.mysql_id),
                    food_id: d.food_id != null ? Number(d.food_id) : null,
                    order_id: Number(order.mysql_id),
                    price: Number(d.price ?? 0),
                    quantity: Number(d.quantity ?? 0),
                    tax_amount: Number(d.tax_amount ?? 0),
                    food_details: d.food_details ? this.tryParse(d.food_details) : null,
                })),
                customer: customer
                    ? {
                        id: Number(customer.mysql_id),
                        f_name: customer.f_name ?? null,
                        l_name: customer.l_name ?? null,
                        phone: customer.phone ?? null,
                        email: customer.email ?? null,
                    }
                    : null,
            };
        }
        const restaurant = await this.restaurantForVendor(vendorId);
        if (!restaurant)
            throw new common_1.NotFoundException({ errors: [{ code: 'restaurant', message: 'not_found' }] });
        const res = await this.loadOrderDetails(BigInt(orderId));
        if (!res || res.order.restaurant_id !== restaurant.id) {
            throw new common_1.NotFoundException({ errors: [{ code: 'order_id', message: 'not_found' }] });
        }
        const customer = res.order.user_id
            ? await this.prisma.users.findUnique({ where: { id: res.order.user_id } })
            : null;
        return {
            ...this.mapOrder(res.order),
            details: res.details.map((d) => ({
                id: d.id,
                food_id: d.food_id,
                order_id: d.order_id,
                price: Number(d.price),
                quantity: d.quantity,
                tax_amount: Number(d.tax_amount),
                food_details: d.food_details ? JSON.parse(d.food_details) : null,
            })),
            customer: customer
                ? {
                    id: customer.id,
                    f_name: customer.f_name,
                    l_name: customer.l_name,
                    phone: customer.phone,
                    email: customer.email,
                }
                : null,
        };
    }
    async vendorUpdateStatus(vendorId, orderId, newStatus) {
        if (!VENDOR_STATUSES.includes(newStatus)) {
            throw new common_1.BadRequestException({
                errors: [{ code: 'order_status', message: `must be one of ${VENDOR_STATUSES.join(', ')}` }],
            });
        }
        if (this.useMongo()) {
            const restaurant = await this.restaurantForVendorMongo(vendorId);
            if (!restaurant)
                throw new common_1.NotFoundException({ errors: [{ code: 'restaurant', message: 'not_found' }] });
            const o = await this.mongo.findByMysqlId('orders', orderId);
            if (!o || Number(o.mysql_restaurant_id) !== Number(restaurant.mysql_id)) {
                throw new common_1.NotFoundException({ errors: [{ code: 'order_id', message: 'not_found' }] });
            }
            const data = { order_status: newStatus };
            data[newStatus] = new Date();
            if (newStatus === 'confirmed') {
                data.payment_status = o.payment_method === 'cash_on_delivery' ? 'unpaid' : 'paid';
            }
            await this.mongo.updateOne('orders', { mysql_id: Number(o.mysql_id) }, data);
            return { message: 'order_status_updated', order_status: newStatus };
        }
        const restaurant = await this.restaurantForVendor(vendorId);
        if (!restaurant)
            throw new common_1.NotFoundException({ errors: [{ code: 'restaurant', message: 'not_found' }] });
        const o = await this.prisma.orders.findFirst({
            where: { id: BigInt(orderId), restaurant_id: restaurant.id },
        });
        if (!o)
            throw new common_1.NotFoundException({ errors: [{ code: 'order_id', message: 'not_found' }] });
        const data = { order_status: newStatus };
        data[newStatus] = new Date();
        if (newStatus === 'confirmed')
            data.payment_status = o.payment_method === 'cash_on_delivery' ? 'unpaid' : 'paid';
        await this.prisma.orders.update({ where: { id: o.id }, data });
        return { message: 'order_status_updated', order_status: newStatus };
    }
    async vendorAssignDeliveryMan(vendorId, orderId, deliveryManId) {
        if (this.useMongo()) {
            const restaurant = await this.restaurantForVendorMongo(vendorId);
            if (!restaurant)
                throw new common_1.NotFoundException({ errors: [{ code: 'restaurant', message: 'not_found' }] });
            const o = await this.mongo.findByMysqlId('orders', orderId);
            if (!o || Number(o.mysql_restaurant_id) !== Number(restaurant.mysql_id)) {
                throw new common_1.NotFoundException({ errors: [{ code: 'order_id', message: 'not_found' }] });
            }
            const dm = await this.mongo.findByMysqlId('delivery_men', deliveryManId);
            if (!dm)
                throw new common_1.NotFoundException({ errors: [{ code: 'delivery_man_id', message: 'not_found' }] });
            const data = { mysql_delivery_man_id: Number(deliveryManId) };
            await this.mongo.updateOne('orders', { mysql_id: Number(o.mysql_id) }, data);
            return { message: 'delivery_man_assigned', order_id: Number(o.mysql_id), delivery_man_id: deliveryManId };
        }
        const restaurant = await this.restaurantForVendor(vendorId);
        if (!restaurant)
            throw new common_1.NotFoundException({ errors: [{ code: 'restaurant', message: 'not_found' }] });
        const o = await this.prisma.orders.findFirst({
            where: { id: BigInt(orderId), restaurant_id: restaurant.id },
        });
        if (!o)
            throw new common_1.NotFoundException({ errors: [{ code: 'order_id', message: 'not_found' }] });
        const dm = await this.prisma.delivery_men.findUnique({ where: { id: BigInt(deliveryManId) } });
        if (!dm)
            throw new common_1.NotFoundException({ errors: [{ code: 'delivery_man_id', message: 'not_found' }] });
        await this.prisma.orders.update({
            where: { id: o.id },
            data: { delivery_man_id: BigInt(deliveryManId), order_status: o.order_status === 'handover' ? 'handover' : o.order_status },
        });
        return { message: 'delivery_man_assigned', order_id: Number(o.id), delivery_man_id: deliveryManId };
    }
    async vendorAllDeliveryMen(vendorId) {
        if (this.useMongo()) {
            const restaurant = await this.restaurantForVendorMongo(vendorId);
            if (!restaurant)
                throw new common_1.NotFoundException({ errors: [{ code: 'restaurant', message: 'not_found' }] });
            const filter = { application_status: 'approved' };
            if (restaurant.mysql_zone_id != null) {
                filter.mysql_zone_id = Number(restaurant.mysql_zone_id);
            }
            const dms = await this.mongo.findMany('delivery_men', filter);
            return dms.map((d) => ({
                id: Number(d.mysql_id),
                f_name: d.f_name ?? null,
                l_name: d.l_name ?? null,
                phone: d.phone ?? null,
                email: d.email ?? null,
                image: d.image ?? null,
                image_full_url: d.image ? `${this.storageBase()}/delivery-man/${d.image}` : null,
                status: d.status ? 1 : 0,
                current_orders: 0,
            }));
        }
        const restaurant = await this.restaurantForVendor(vendorId);
        if (!restaurant)
            throw new common_1.NotFoundException({ errors: [{ code: 'restaurant', message: 'not_found' }] });
        const dms = await this.prisma.delivery_men.findMany({
            where: { OR: [{ zone_id: restaurant.zone_id }, { restaurant_id: restaurant.id }], application_status: 'approved' },
        });
        return dms.map((d) => ({
            id: d.id,
            f_name: d.f_name,
            l_name: d.l_name,
            phone: d.phone,
            email: d.email,
            image: d.image,
            image_full_url: d.image ? `${this.storageBase()}/delivery-man/${d.image}` : null,
            status: d.status ? 1 : 0,
            current_orders: d.current_orders,
        }));
    }
    async dmCurrentOrders(dmId) {
        if (this.useMongo()) {
            const orders = await this.mongo.findMany('orders', {
                mysql_delivery_man_id: Number(dmId),
                order_status: { $in: ['accepted', 'confirmed', 'processing', 'handover', 'picked_up'] },
            }, { sort: { mysql_id: -1 } });
            return {
                total_size: orders.length,
                limit: 50,
                offset: 1,
                orders: orders.map((o) => this.mapMongoOrder(o)),
            };
        }
        const orders = await this.prisma.orders.findMany({
            where: {
                delivery_man_id: dmId,
                order_status: { in: ['accepted', 'confirmed', 'processing', 'handover', 'picked_up'] },
            },
            orderBy: { id: 'desc' },
        });
        return { total_size: orders.length, limit: 50, offset: 1, orders: orders.map((o) => this.mapOrder(o)) };
    }
    async dmLatestOrders(dmId) {
        if (this.useMongo()) {
            const dm = await this.mongo.findByMysqlId('delivery_men', Number(dmId));
            const filter = {
                $or: [{ mysql_delivery_man_id: null }, { mysql_delivery_man_id: { $exists: false } }],
                order_status: 'handover',
            };
            if (dm?.mysql_zone_id != null) {
                filter.mysql_zone_id = Number(dm.mysql_zone_id);
            }
            const orders = await this.mongo.findMany('orders', filter, { sort: { mysql_id: -1 } });
            return {
                total_size: orders.length,
                limit: 50,
                offset: 1,
                orders: orders.map((o) => this.mapMongoOrder(o)),
            };
        }
        const dm = await this.prisma.delivery_men.findUnique({ where: { id: dmId } });
        const orders = await this.prisma.orders.findMany({
            where: {
                delivery_man_id: null,
                zone_id: dm?.zone_id ?? undefined,
                order_status: 'handover',
            },
            orderBy: { id: 'desc' },
        });
        return { total_size: orders.length, limit: 50, offset: 1, orders: orders.map((o) => this.mapOrder(o)) };
    }
    async dmOrderDetail(dmId, orderId) {
        if (this.useMongo()) {
            const order = await this.mongo.findByMysqlId('orders', orderId);
            const assigned = order?.mysql_delivery_man_id != null ? Number(order.mysql_delivery_man_id) : null;
            if (!order || (assigned !== null && assigned !== Number(dmId))) {
                throw new common_1.NotFoundException({ errors: [{ code: 'order_id', message: 'not_found' }] });
            }
            const details = await this.mongo.findMany('order_details', { order_id: Number(order.mysql_id) }, { sort: { mysql_id: 1 } });
            return {
                ...this.mapMongoOrder(order),
                details: details.map((d) => ({
                    id: Number(d.mysql_id),
                    food_id: d.food_id != null ? Number(d.food_id) : null,
                    price: Number(d.price ?? 0),
                    quantity: Number(d.quantity ?? 0),
                    food_details: d.food_details ? this.tryParse(d.food_details) : null,
                })),
            };
        }
        const res = await this.loadOrderDetails(BigInt(orderId));
        if (!res || (res.order.delivery_man_id !== dmId && res.order.delivery_man_id !== null)) {
            throw new common_1.NotFoundException({ errors: [{ code: 'order_id', message: 'not_found' }] });
        }
        return {
            ...this.mapOrder(res.order),
            details: res.details.map((d) => ({
                id: d.id,
                food_id: d.food_id,
                price: Number(d.price),
                quantity: d.quantity,
                food_details: d.food_details ? JSON.parse(d.food_details) : null,
            })),
        };
    }
    async dmUpdateStatus(dmId, orderId, newStatus) {
        if (!DM_STATUSES.includes(newStatus)) {
            throw new common_1.BadRequestException({
                errors: [{ code: 'order_status', message: `must be one of ${DM_STATUSES.join(', ')}` }],
            });
        }
        if (this.useMongo()) {
            const o = await this.mongo.findByMysqlId('orders', orderId);
            if (!o || Number(o.mysql_delivery_man_id) !== Number(dmId)) {
                throw new common_1.NotFoundException({ errors: [{ code: 'order_id', message: 'not_found' }] });
            }
            const data = { order_status: newStatus };
            data[newStatus] = new Date();
            if (newStatus === 'delivered' && o.payment_method === 'cash_on_delivery') {
                data.payment_status = 'paid';
            }
            await this.mongo.updateOne('orders', { mysql_id: Number(o.mysql_id) }, data);
            return { message: 'order_status_updated', order_status: newStatus };
        }
        const o = await this.prisma.orders.findFirst({ where: { id: BigInt(orderId), delivery_man_id: dmId } });
        if (!o)
            throw new common_1.NotFoundException({ errors: [{ code: 'order_id', message: 'not_found' }] });
        const data = { order_status: newStatus };
        data[newStatus] = new Date();
        if (newStatus === 'delivered' && o.payment_method === 'cash_on_delivery') {
            data.payment_status = 'paid';
        }
        await this.prisma.orders.update({ where: { id: o.id }, data });
        return { message: 'order_status_updated', order_status: newStatus };
    }
    tryParse(s) {
        try {
            return JSON.parse(s);
        }
        catch {
            return null;
        }
    }
};
exports.OpsService = OpsService;
exports.OpsService = OpsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        mongo_data_service_1.MongoDataService])
], OpsService);
//# sourceMappingURL=ops.service.js.map