import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';
import { SettlementService } from '../settlement/settlement.service';
import { toNum } from '../common/decimal';
import { OrderLifecycleService } from '../lifecycle/order-lifecycle.service';
import { CANCEL_REASONS, type CancelReason } from '../lifecycle/order-lifecycle.constants';
import { storageFullUrl } from '../common/storage-url';

/** Shared shape for the admin food create + update endpoints. */
export interface FoodWriteBody {
  name?: string;
  description?: string;
  price?: number;
  restaurant_id?: number;
  category_id?: number;
  sub_category_id?: number | null;
  discount?: number;
  discount_type?: string;
  tax?: number;
  tax_type?: string;
  veg?: boolean | string | number;
  is_halal?: boolean;
  recommended?: boolean;
  stock_type?: string;
  item_stock?: number;
  maximum_cart_quantity?: number | null;
  available_time_starts?: string;
  available_time_ends?: string;
  addon_ids?: number[] | string;
  variations?: unknown[];
  image?: string;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_image?: string | null;
  // Per-locale translations: [{ locale, key:'name', value }].
  translations?: Array<{ locale?: string; key?: string; value?: string }>;
  // Per-locale description translations: [{ locale, key:'description', value }].
  description_translations?: Array<{ locale?: string; key?: string; value?: string }>;
}

/** Coerce the veg/non-veg value (boolean, or "1"/"0" from a select) to bool. */
function vegToBool(v: boolean | string | number | undefined | null, fallback = true): boolean {
  if (v === undefined || v === null) return fallback;
  return !(v === '0' || v === 0 || v === false || v === 'false' || v === 'non_veg');
}

const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'accepted',
  'processing',
  'handover',
  'picked_up',
  'delivered',
  'canceled',
  'failed',
  'refund_requested',
  'refunded',
  // POS (Take Away / Dine In) lifecycle states. These are additive — the
  // existing customer-app / delivery flow is unchanged. Take Away ends at
  // `completed` via `ready_for_pickup`; Dine In via `served`. They carry no
  // delivery semantics, so no DM/notification logic is triggered for them.
  'created',
  'ready_for_pickup',
  'out_for_delivery',
  'served',
  'completed',
  'auto_cancelled',
] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

const TIMESTAMP_COLUMN: Partial<Record<OrderStatus, string>> = {
  pending: 'pending',
  accepted: 'accepted',
  confirmed: 'confirmed',
  processing: 'processing',
  handover: 'handover',
  picked_up: 'picked_up',
  delivered: 'delivered',
  canceled: 'canceled',
  failed: 'failed',
  refund_requested: 'refund_requested',
  refunded: 'refunded',
};

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mongo: MongoDataService,
    private readonly settlement: SettlementService,
    private readonly lifecycle: OrderLifecycleService,
  ) {}

  /** Feature flag — when "1", admin reads route to MongoDB instead of MySQL. */
  private useMongo(): boolean {
    const v = (process.env.USE_MONGO_ADMIN ?? '1').toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }

  // ── Self / profile ────────────────────────────────────────────────────

  async getMe(adminId: bigint) {
    if (this.useMongo()) {
      const a = await this.mongo.findByMysqlId<{
        mysql_id: number; f_name: string | null; l_name: string | null;
        email: string; phone: string | null; image: string | null;
        role_id: number | null; zone_id: number | null;
        created_at?: Date; updated_at?: Date;
      }>('admins', Number(adminId));
      if (!a) throw new NotFoundException({ errors: [{ code: 'admin', message: 'not_found' }] });
      return {
        id: Number(a.mysql_id),
        f_name: a.f_name,
        l_name: a.l_name,
        email: a.email,
        phone: a.phone,
        image: a.image,
        role_id: a.role_id ?? null,
        zone_id: a.zone_id ?? null,
        created_at: a.created_at ?? null,
        updated_at: a.updated_at ?? null,
      };
    }
    const a = await this.prisma.admins.findUnique({ where: { id: adminId } });
    if (!a) throw new NotFoundException({ errors: [{ code: 'admin', message: 'not_found' }] });
    return {
      id: Number(a.id),
      f_name: a.f_name,
      l_name: a.l_name,
      email: a.email,
      phone: a.phone,
      image: a.image,
      role_id: a.role_id ? Number(a.role_id) : null,
      zone_id: a.zone_id ? Number(a.zone_id) : null,
      created_at: a.created_at,
      updated_at: a.updated_at,
    };
  }

  async updateMe(adminId: bigint, body: { f_name?: string; l_name?: string; email?: string; phone?: string; image?: string }) {
    const data: Record<string, unknown> = {};
    if (body.f_name !== undefined) data.f_name = body.f_name.trim();
    if (body.l_name !== undefined) data.l_name = body.l_name.trim();
    if (body.email !== undefined) {
      const email = body.email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new BadRequestException({ errors: [{ code: 'email', message: 'invalid email' }] });
      data.email = email;
    }
    if (body.phone !== undefined) data.phone = body.phone.trim();
    if (body.image !== undefined) data.image = body.image;
    if (Object.keys(data).length === 0) throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields' }] });
    data.updated_at = new Date();
    if (this.useMongo()) {
      const a = await this.mongo.findByMysqlId<{ mysql_id: number }>('admins', Number(adminId));
      if (!a) throw new NotFoundException({ errors: [{ code: 'admin', message: 'not_found' }] });
      await this.mongo.updateOne('admins', { mysql_id: Number(adminId) }, data);
      return this.getMe(adminId);
    }
    await this.prisma.admins.update({ where: { id: adminId }, data });
    return this.getMe(adminId);
  }

  async changeMyPassword(adminId: bigint, body: { current_password: string; new_password: string }) {
    if (!body.current_password || !body.new_password) {
      throw new BadRequestException({ errors: [{ code: 'body', message: 'current_password and new_password required' }] });
    }
    if (body.new_password.length < 6) {
      throw new BadRequestException({ errors: [{ code: 'new_password', message: 'must be at least 6 characters' }] });
    }
    if (this.useMongo()) {
      const a = await this.mongo.findByMysqlId<{ mysql_id: number; password?: string | null }>('admins', Number(adminId));
      if (!a) throw new NotFoundException({ errors: [{ code: 'admin', message: 'not_found' }] });
      if (!a.password) throw new BadRequestException({ errors: [{ code: 'password', message: 'no password on record' }] });
      const phpStyleMongo = a.password.replace(/^\$2y\$/, '$2b$');
      const okMongo = await bcrypt.compare(body.current_password, phpStyleMongo);
      if (!okMongo) throw new BadRequestException({ errors: [{ code: 'current_password', message: 'incorrect current password' }] });
      const newHashMongo = (await bcrypt.hash(body.new_password, 10)).replace(/^\$2b\$/, '$2y$');
      await this.mongo.updateOne('admins', { mysql_id: Number(adminId) }, { password: newHashMongo, updated_at: new Date() });
      return { ok: true };
    }
    const a = await this.prisma.admins.findUnique({ where: { id: adminId } });
    if (!a) throw new NotFoundException({ errors: [{ code: 'admin', message: 'not_found' }] });
    const current = (a as unknown as { password: string | null }).password;
    if (!current) throw new BadRequestException({ errors: [{ code: 'password', message: 'no password on record' }] });
    const phpStyle = current.replace(/^\$2y\$/, '$2b$');
    const ok = await bcrypt.compare(body.current_password, phpStyle);
    if (!ok) throw new BadRequestException({ errors: [{ code: 'current_password', message: 'incorrect current password' }] });
    const newHash = (await bcrypt.hash(body.new_password, 10)).replace(/^\$2b\$/, '$2y$');
    await this.prisma.admins.update({ where: { id: adminId }, data: { password: newHash, updated_at: new Date() } as never });
    return { ok: true };
  }

  // ── Dashboard ─────────────────────────────────────────────────────────

  async dashboardStats() {
    if (this.useMongo()) {
      // MongoDB version — same shape as Prisma version, sourced from collections
      const [
        totalOrders,
        pendingOrders,
        deliveredOrders,
        canceledOrders,
        refundedOrders,
        failedOrders,
        processingOrders,
        pickedUpOrders,
        scheduledOrders,
        totalRestaurants,
        activeRestaurants,
        totalUsers,
        totalDeliveryMen,
        totalVendors,
        totalFood,
        revenueAgg,
      ] = await Promise.all([
        this.mongo.count('orders'),
        this.mongo.count('orders', { order_status: 'pending' }),
        this.mongo.count('orders', { order_status: 'delivered' }),
        this.mongo.count('orders', { order_status: 'canceled' }),
        this.mongo.count('orders', { order_status: 'refunded' }),
        this.mongo.count('orders', { order_status: 'failed' }),
        this.mongo.count('orders', { order_status: 'processing' }),
        this.mongo.count('orders', { order_status: 'picked_up' }),
        this.mongo.count('orders', { order_status: 'scheduled' }),
        this.mongo.count('restaurants'),
        this.mongo.count('restaurants', { status: true }),
        this.mongo.count('users'),
        this.mongo.count('delivery_men'),
        this.mongo.count('vendors'),
        this.mongo.count('foods'),
        this.mongo.aggregate<{ _id: null; total: number }>('orders', [
          { $match: { order_status: 'delivered', payment_status: 'paid' } },
          { $group: { _id: null, total: { $sum: '$order_amount' } } },
        ]),
      ]);
      return {
        orders: {
          total: totalOrders,
          pending: pendingOrders,
          delivered: deliveredOrders,
          canceled: canceledOrders,
          refunded: refundedOrders,
          payment_failed: failedOrders,
          processing: processingOrders,
          picked_up: pickedUpOrders,
          scheduled: scheduledOrders,
        },
        restaurants: { total: totalRestaurants, active: activeRestaurants },
        users: { total: totalUsers },
        delivery_men: { total: totalDeliveryMen },
        vendors: { total: totalVendors },
        food: { total: totalFood },
        revenue: { total: Number(revenueAgg[0]?.total ?? 0) },
      };
    }

    const [
      totalOrders,
      pendingOrders,
      deliveredOrders,
      canceledOrders,
      refundedOrders,
      failedOrders,
      processingOrders,
      pickedUpOrders,
      scheduledOrders,
      totalRestaurants,
      activeRestaurants,
      totalUsers,
      totalDeliveryMen,
      totalVendors,
      totalFood,
      revenueRow,
    ] = await Promise.all([
      this.prisma.orders.count(),
      this.prisma.orders.count({ where: { order_status: 'pending' } }),
      this.prisma.orders.count({ where: { order_status: 'delivered' } }),
      this.prisma.orders.count({ where: { order_status: 'canceled' } }),
      this.prisma.orders.count({ where: { order_status: 'refunded' } }),
      this.prisma.orders.count({ where: { order_status: 'failed' } }),
      this.prisma.orders.count({ where: { order_status: 'processing' } }),
      this.prisma.orders.count({ where: { order_status: 'picked_up' } }),
      this.prisma.orders.count({ where: { order_status: 'scheduled' } }),
      this.prisma.restaurants.count(),
      this.prisma.restaurants.count({ where: { status: true } }),
      this.prisma.users.count(),
      this.prisma.delivery_men.count(),
      this.prisma.vendors.count(),
      this.prisma.food.count(),
      this.prisma.orders.aggregate({
        where: { order_status: 'delivered', payment_status: 'paid' },
        _sum: { order_amount: true },
      }),
    ]);

    return {
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        delivered: deliveredOrders,
        canceled: canceledOrders,
        refunded: refundedOrders,
        payment_failed: failedOrders,
        processing: processingOrders,
        picked_up: pickedUpOrders,
        scheduled: scheduledOrders,
      },
      restaurants: { total: totalRestaurants, active: activeRestaurants },
      users: { total: totalUsers },
      delivery_men: { total: totalDeliveryMen },
      vendors: { total: totalVendors },
      food: { total: totalFood },
      revenue: { total: Number(revenueRow._sum.order_amount ?? 0) },
    };
  }

  // ── Orders ────────────────────────────────────────────────────────────

  async listOrders(limit = 50, offset = 0, status?: string, q?: string, orderType?: string) {
    if (this.useMongo()) {
      const filter: Record<string, unknown> = {};
      if (status) filter.order_status = status;
      if (orderType) filter.order_type = orderType;
      if (q && /^\d+$/.test(q)) filter.mysql_id = Number(q);

      const [rows, total] = await Promise.all([
        this.mongo.findMany<{
          mysql_id: number; mysql_user_id?: number; mysql_restaurant_id?: number;
          order_amount?: number; payment_status?: string; order_status?: string;
          payment_method?: string; order_type?: string;
          delivery_charge?: number; total_tax_amount?: number;
          created_at_legacy?: Date;
        }>('orders', filter, { sort: { mysql_id: -1 }, limit, skip: offset }),
        this.mongo.count('orders', filter),
      ]);

      const userIds = Array.from(new Set(rows.map((r) => r.mysql_user_id).filter((x): x is number => !!x)));
      const restaurantIds = Array.from(new Set(rows.map((r) => r.mysql_restaurant_id).filter((x): x is number => !!x)));
      const [users, restaurants] = await Promise.all([
        userIds.length
          ? this.mongo.findMany<{ mysql_id: number; f_name: string | null; l_name: string | null; email: string | null; phone: string | null }>(
              'users', { mysql_id: { $in: userIds } },
              { projection: { mysql_id: 1, f_name: 1, l_name: 1, email: 1, phone: 1 } as Record<string, 0 | 1> },
            )
          : Promise.resolve([]),
        restaurantIds.length
          ? this.mongo.findMany<{ mysql_id: number; name: string | null }>(
              'restaurants', { mysql_id: { $in: restaurantIds } },
              { projection: { mysql_id: 1, name: 1 } as Record<string, 0 | 1> },
            )
          : Promise.resolve([]),
      ]);
      const userById = new Map(users.map((u) => [u.mysql_id, u]));
      const restaurantById = new Map(restaurants.map((r) => [r.mysql_id, r]));
      return {
        total, limit, offset,
        orders: rows.map((r) => ({
          id: r.mysql_id,
          user: r.mysql_user_id ? (userById.get(r.mysql_user_id) ? { id: r.mysql_user_id, ...userById.get(r.mysql_user_id) } : null) : null,
          restaurant: r.mysql_restaurant_id ? (restaurantById.get(r.mysql_restaurant_id) ? { id: r.mysql_restaurant_id, name: restaurantById.get(r.mysql_restaurant_id)?.name } : null) : null,
          order_amount: Number(r.order_amount ?? 0),
          payment_status: r.payment_status,
          order_status: r.order_status,
          payment_method: r.payment_method,
          order_type: r.order_type,
          delivery_charge: Number(r.delivery_charge ?? 0),
          total_tax_amount: Number(r.total_tax_amount ?? 0),
          created_at: r.created_at_legacy,
        })),
      };
    }
    const where: Record<string, unknown> = {};
    if (status) where.order_status = status;
    if (orderType) where.order_type = orderType;
    if (q && /^\d+$/.test(q)) where.id = BigInt(q);

    const [rows, total] = await Promise.all([
      this.prisma.orders.findMany({
        where,
        orderBy: { id: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          user_id: true,
          restaurant_id: true,
          order_amount: true,
          payment_status: true,
          order_status: true,
          payment_method: true,
          order_type: true,
          delivery_charge: true,
          total_tax_amount: true,
          created_at: true,
        },
      }),
      this.prisma.orders.count({ where }),
    ]);

    const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter((x): x is bigint => x !== null)));
    const restaurantIds = Array.from(new Set(rows.map((r) => r.restaurant_id)));
    const [users, restaurants] = await Promise.all([
      userIds.length
        ? this.prisma.users.findMany({
            where: { id: { in: userIds } },
            select: { id: true, f_name: true, l_name: true, email: true, phone: true },
          })
        : Promise.resolve([]),
      restaurantIds.length
        ? this.prisma.restaurants.findMany({
            where: { id: { in: restaurantIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);
    const userById = new Map(users.map((u) => [String(u.id), u]));
    const restaurantById = new Map(restaurants.map((r) => [String(r.id), r]));

    return {
      total,
      limit,
      offset,
      orders: rows.map((r) => ({
        id: Number(r.id),
        user: r.user_id ? userById.get(String(r.user_id)) ?? null : null,
        restaurant: restaurantById.get(String(r.restaurant_id)) ?? null,
        order_amount: Number(r.order_amount),
        payment_status: r.payment_status,
        order_status: r.order_status,
        payment_method: r.payment_method,
        order_type: r.order_type,
        delivery_charge: Number(r.delivery_charge),
        total_tax_amount: Number(r.total_tax_amount),
        created_at: r.created_at,
      })),
    };
  }

  async getOrder(id: number) {
    if (this.useMongo()) {
      const order = await this.mongo.findByMysqlId<{
        mysql_id: number; mysql_user_id?: number; mysql_restaurant_id?: number; mysql_delivery_man_id?: number;
        order_amount?: number; coupon_discount_amount?: number; total_tax_amount?: number;
        delivery_charge?: number; restaurant_discount_amount?: number; admin_discount_amount?: number;
        additional_charge?: number; extra_packaging_amount?: number;
        payment_status?: string; order_status?: string; payment_method?: string; order_type?: string;
        table_number?: string | null;
        coupon_code?: string | null; order_note?: string | null; delivery_address?: string | null;
        cancellation_reason?: string | null; canceled_by?: string | null;
        cancel_reason?: string | null; refund_status?: string | null;
        contact_person_name?: string | null; contact_person_number?: string | null;
        pending?: Date | null; accepted?: Date | null; confirmed?: Date | null;
        processing?: Date | null; handover?: Date | null; picked_up?: Date | null;
        delivered?: Date | null; canceled?: Date | null; failed?: Date | null;
        created_at_legacy?: Date; created_at?: Date;
      }>('orders', id);
      if (!order) throw new NotFoundException({ errors: [{ code: 'order', message: 'Order not found' }] });
      const [user, restaurant, deliveryMan, items] = await Promise.all([
        order.mysql_user_id
          ? this.mongo.findByMysqlId<{ mysql_id: number; f_name: string | null; l_name: string | null; email: string | null; phone: string | null }>('users', order.mysql_user_id)
          : Promise.resolve(null),
        order.mysql_restaurant_id
          ? this.mongo.findByMysqlId<{ mysql_id: number; name: string | null; phone: string | null; email: string | null; address: string | null; logo: string | null; comission?: number }>('restaurants', order.mysql_restaurant_id)
          : Promise.resolve(null),
        order.mysql_delivery_man_id
          ? this.mongo.findByMysqlId<{ mysql_id: number; f_name: string | null; l_name: string | null; phone: string | null }>('delivery_men', order.mysql_delivery_man_id)
          : Promise.resolve(null),
        this.mongo.findMany<{
          mysql_id: number; order_id?: number; food_id?: number | null;
          price?: number; quantity?: number; tax_amount?: number; total_add_on_price?: number;
          variant?: string | null; food_details?: string | null;
        }>('order_details', { order_id: order.mysql_id }, { sort: { mysql_id: 1 } }),
      ]);

      // ── Money distribution (who keeps what) ──────────────────────────────
      // Mirrors the Pay-Per-Order settlement: Eatofine keeps commission on the
      // restaurant's food + platform/additional fees; the restaurant gets the
      // residual; tax goes to government; delivery to the delivery man. The four
      // legs sum exactly to what the customer paid — no money is lost.
      const r2e = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
      const customerPayment = r2e(Number(order.order_amount ?? 0));
      const taxAmt = r2e(Number(order.total_tax_amount ?? 0));
      const deliveryAmt = r2e(Number(order.delivery_charge ?? 0));
      const platformFee = r2e(Number(order.additional_charge ?? 0));

      // ── Discount ownership (who funds the discount) ──────────────────────
      // The order already carries the authoritative split (placeOrder resolves
      // the coupon's owner at checkout): restaurant-funded → restaurant bears it;
      // admin-funded → Eatofine bears it (promo expense).
      const adminDiscount = r2e(Number(order.admin_discount_amount ?? 0));
      const restaurantDiscount = r2e(Number(order.restaurant_discount_amount ?? 0));

      const foodAmount = r2e(items.reduce((s, it) => s + Number(it.price ?? 0) * Number(it.quantity ?? 0) + Number(it.total_add_on_price ?? 0), 0));
      const commissionPct = Math.max(0, Number(restaurant?.comission ?? 0));
      // Commission is charged on the food net of the RESTAURANT's own discount.
      const adminCommission = r2e(Math.max(0, foodAmount - restaurantDiscount) * (commissionPct / 100));
      const hasDm = order.mysql_delivery_man_id != null && Number(order.mysql_delivery_man_id) > 0;
      const deliverymanEarning = hasDm ? deliveryAmt : 0;
      const platformRevenue = r2e(adminCommission + platformFee + (hasDm ? 0 : deliveryAmt));
      // Residual — adding admin-funded discount back so the restaurant is paid in
      // full when ADMIN funds the discount (admin bears it, not the restaurant).
      const restaurantEarning = r2e(customerPayment + adminDiscount - platformRevenue - deliverymanEarning - taxAmt);
      const eatofineEarning = r2e(platformRevenue - adminDiscount); // admin net after promo expense
      const earnings = {
        customer_payment: customerPayment,
        food_amount: foodAmount,
        commission_pct: commissionPct,
        eatofine_commission: adminCommission,
        eatofine_platform_fee: platformFee,
        admin_discount: adminDiscount,
        restaurant_discount: restaurantDiscount,
        eatofine_earning: eatofineEarning,
        restaurant_earning: restaurantEarning,
        deliveryman_earning: deliverymanEarning,
        tax_amount: taxAmt,
      };

      return {
        earnings,
        order: {
          id: order.mysql_id,
          order_amount: Number(order.order_amount ?? 0),
          coupon_discount_amount: Number(order.coupon_discount_amount ?? 0),
          total_tax_amount: Number(order.total_tax_amount ?? 0),
          delivery_charge: Number(order.delivery_charge ?? 0),
          restaurant_discount_amount: Number(order.restaurant_discount_amount ?? 0),
          payment_status: order.payment_status,
          order_status: order.order_status,
          payment_method: order.payment_method,
          order_type: order.order_type,
          table_number: order.table_number ?? null,
          coupon_code: order.coupon_code ?? null,
          order_note: order.order_note ?? null,
          delivery_address: order.delivery_address ?? null,
          cancellation_reason: order.cancellation_reason ?? null,
          cancel_reason: order.cancel_reason ?? order.cancellation_reason ?? null,
          refund_status: order.refund_status ?? 'not_required',
          canceled_by: order.canceled_by ?? null,
          timeline: {
            pending: order.pending ?? null,
            accepted: order.accepted ?? null,
            confirmed: order.confirmed ?? null,
            processing: order.processing ?? null,
            handover: order.handover ?? null,
            picked_up: order.picked_up ?? null,
            delivered: order.delivered ?? null,
            canceled: order.canceled ?? null,
            failed: order.failed ?? null,
          },
          created_at: order.created_at_legacy ?? order.created_at ?? null,
        },
        user: user
          ? { id: user.mysql_id, f_name: user.f_name, l_name: user.l_name, email: user.email, phone: user.phone }
          // POS / walk-in orders have no user account — fall back to the
          // contact name/number captured at the counter.
          : (order.contact_person_name || order.contact_person_number)
            ? { id: 0, f_name: order.contact_person_name ?? 'Customer', l_name: '', email: null, phone: order.contact_person_number ?? null }
            : null,
        restaurant: restaurant
          ? {
              id: restaurant.mysql_id,
              name: restaurant.name,
              phone: restaurant.phone,
              email: restaurant.email,
              address: restaurant.address,
              logo: restaurant.logo,
            }
          : null,
        delivery_man: deliveryMan
          ? {
              id: deliveryMan.mysql_id,
              f_name: deliveryMan.f_name,
              l_name: deliveryMan.l_name,
              phone: deliveryMan.phone,
            }
          : null,
        items: items.map((it) => ({
          id: it.mysql_id,
          food_id: it.food_id ? Number(it.food_id) : null,
          price: Number(it.price ?? 0),
          quantity: it.quantity ?? 0,
          tax_amount: Number(it.tax_amount ?? 0),
          total_add_on_price: Number(it.total_add_on_price ?? 0),
          variant: it.variant ?? null,
          food_details: parseJsonField(it.food_details ?? null),
        })),
      };
    }
    const order = await this.prisma.orders.findUnique({ where: { id: BigInt(id) } });
    if (!order) throw new NotFoundException({ errors: [{ code: 'order', message: 'Order not found' }] });
    const [user, restaurant, deliveryMan, items] = await Promise.all([
      order.user_id ? this.prisma.users.findUnique({ where: { id: order.user_id } }) : null,
      this.prisma.restaurants.findUnique({ where: { id: order.restaurant_id } }),
      order.delivery_man_id
        ? this.prisma.delivery_men.findUnique({ where: { id: order.delivery_man_id } })
        : null,
      this.prisma.order_details.findMany({ where: { order_id: order.id }, orderBy: { id: 'asc' } }),
    ]);
    return {
      order: {
        id: Number(order.id),
        order_amount: Number(order.order_amount),
        coupon_discount_amount: Number(order.coupon_discount_amount),
        total_tax_amount: Number(order.total_tax_amount),
        delivery_charge: Number(order.delivery_charge),
        restaurant_discount_amount: Number(order.restaurant_discount_amount),
        payment_status: order.payment_status,
        order_status: order.order_status,
        payment_method: order.payment_method,
        order_type: order.order_type,
        coupon_code: order.coupon_code,
        order_note: order.order_note,
        delivery_address: order.delivery_address,
        cancellation_reason: order.cancellation_reason,
        canceled_by: order.canceled_by,
        timeline: {
          pending: order.pending,
          accepted: order.accepted,
          confirmed: order.confirmed,
          processing: order.processing,
          handover: order.handover,
          picked_up: order.picked_up,
          delivered: order.delivered,
          canceled: order.canceled,
          failed: order.failed,
        },
        created_at: order.created_at,
      },
      user: user
        ? { id: Number(user.id), f_name: user.f_name, l_name: user.l_name, email: user.email, phone: user.phone }
        : null,
      restaurant: restaurant
        ? {
            id: Number(restaurant.id),
            name: restaurant.name,
            phone: restaurant.phone,
            email: restaurant.email,
            address: restaurant.address,
            logo: restaurant.logo,
          }
        : null,
      delivery_man: deliveryMan
        ? {
            id: Number(deliveryMan.id),
            f_name: deliveryMan.f_name,
            l_name: deliveryMan.l_name,
            phone: deliveryMan.phone,
          }
        : null,
      items: items.map((it) => ({
        id: Number(it.id),
        food_id: it.food_id ? Number(it.food_id) : null,
        price: Number(it.price),
        quantity: it.quantity,
        tax_amount: Number(it.tax_amount),
        total_add_on_price: Number(it.total_add_on_price),
        variant: it.variant,
        food_details: parseJsonField(it.food_details),
      })),
    };
  }

  async updateOrderStatus(id: number, status: string, reason?: string) {
    if (!ORDER_STATUSES.includes(status as OrderStatus)) {
      throw new BadRequestException({
        errors: [{ code: 'status', message: `status must be one of ${ORDER_STATUSES.join(',')}` }],
      });
    }
    if (this.useMongo()) {
      const order = await this.mongo.findByMysqlId<{ mysql_id: number; payment_method?: string; order_status?: string; order_type?: string }>('orders', id);
      if (!order) throw new NotFoundException({ errors: [{ code: 'order', message: 'Order not found' }] });

      // Cancellation → the lifecycle engine (sets cancel_reason + refund_status,
      // logs, notifies). Admin can cancel from any active state.
      if (status === 'canceled' || status === 'auto_cancelled') {
        const cancelReason: CancelReason = CANCEL_REASONS.includes(reason as CancelReason) ? (reason as CancelReason) : 'admin_cancelled';
        await this.lifecycle.cancelOrder(id, cancelReason, 'admin');
        return { ok: true, id, status: cancelReason === 'restaurant_not_responded' ? 'auto_cancelled' : 'canceled' };
      }

      const fromStatus = order.order_status;
      this.lifecycle.assertTransition(order.order_type, fromStatus, status); // no-op unless STRICT enabled
      const data: Record<string, unknown> = { order_status: status };
      const tsCol = TIMESTAMP_COLUMN[status as OrderStatus];
      if (tsCol) data[tsCol] = new Date();
      // Terminal (delivered/completed) marks COD paid + triggers settlement.
      if ((status === 'delivered' || status === 'completed') && order.payment_method === 'cash_on_delivery') {
        data.payment_status = 'paid';
      }
      await this.mongo.updateOne('orders', { mysql_id: id }, data);
      // Audit log + customer notification for the new status (non-fatal).
      await this.lifecycle.recordTransition(id, fromStatus, status, 'admin').catch(() => undefined);
      // Pay-Per-Order settlement runs only on the terminal state, idempotently.
      if (status === 'delivered' || status === 'completed') {
        await this.settlement.settleOrder(id).catch(() => undefined);
      }
      return { ok: true, id, status };
    }
    const order = await this.prisma.orders.findUnique({ where: { id: BigInt(id) } });
    if (!order) throw new NotFoundException({ errors: [{ code: 'order', message: 'Order not found' }] });

    const data: Record<string, unknown> = { order_status: status };
    const tsCol = TIMESTAMP_COLUMN[status as OrderStatus];
    if (tsCol) data[tsCol] = new Date();
    if (status === 'delivered' && order.payment_method === 'cash_on_delivery') {
      data.payment_status = 'paid';
    }
    if (status === 'canceled') {
      data.canceled_by = 'admin';
      if (reason) data.cancellation_reason = reason;
    }
    await this.prisma.orders.update({ where: { id: order.id }, data });
    return { ok: true, id, status };
  }

  // ── Restaurants ───────────────────────────────────────────────────────

  async listRestaurants(limit = 50, offset = 0, q?: string) {
    if (this.useMongo()) {
      const filter = this.buildMongoSearchFilter(q, ['name', 'email', 'phone']);
      const [rows, total] = await Promise.all([
        this.mongo.findMany<{
          mysql_id: number; name: string | null; email: string | null; phone: string | null;
          status?: boolean; active?: boolean; address: string | null; logo: string | null;
          latitude?: number; longitude?: number; mysql_zone_id?: number; mysql_vendor_id?: number;
          comission?: number; minimum_order?: number; restaurant_model?: string;
          order_count?: number; created_at?: Date;
        }>(
          'restaurants', filter,
          { sort: { mysql_id: -1 }, limit, skip: offset },
        ),
        this.mongo.count('restaurants', filter),
      ]);
      return {
        total, limit, offset,
        restaurants: rows.map((r) => ({
          id: r.mysql_id, name: r.name, email: r.email, phone: r.phone,
          status: r.status, active: r.active, address: r.address, logo: r.logo,
          latitude: r.latitude, longitude: r.longitude,
          zone_id: r.mysql_zone_id ?? null, vendor_id: r.mysql_vendor_id ?? 0,
          comission: r.comission ?? null, minimum_order: r.minimum_order ?? 0,
          restaurant_model: r.restaurant_model, order_count: r.order_count ?? 0,
          created_at: r.created_at,
        })),
      };
    }
    const where = q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] } : {};
    const [rows, total] = await Promise.all([
      this.prisma.restaurants.findMany({
        where,
        orderBy: { id: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          active: true,
          address: true,
          logo: true,
          latitude: true,
          longitude: true,
          zone_id: true,
          vendor_id: true,
          comission: true,
          minimum_order: true,
          delivery: true,
          take_away: true,
          restaurant_model: true,
          order_count: true,
          created_at: true,
        },
      }),
      this.prisma.restaurants.count({ where }),
    ]);
    return {
      total,
      limit,
      offset,
      restaurants: rows.map((r) => ({
        ...r,
        id: Number(r.id),
        zone_id: r.zone_id ? Number(r.zone_id) : null,
        vendor_id: Number(r.vendor_id),
        comission: r.comission !== null ? Number(r.comission) : null,
        minimum_order: Number(r.minimum_order),
      })),
    };
  }

  async getRestaurant(id: number) {
    if (this.useMongo()) {
      const r = await this.mongo.findByMysqlId<{
        mysql_id: number; name: string | null; email: string | null; phone: string | null;
        status?: boolean; active?: boolean; address: string | null; logo: string | null;
        latitude?: number; longitude?: number; mysql_zone_id?: number; mysql_vendor_id?: number;
        comission?: number | null; minimum_order?: number; tax?: number; minimum_shipping_charge?: number;
        delivery?: boolean; take_away?: boolean; restaurant_model?: string;
        order_count?: number; created_at?: Date;
      } & Record<string, unknown>>('restaurants', id);
      if (!r) throw new NotFoundException({ errors: [{ code: 'restaurant', message: 'Restaurant not found' }] });
      const vendorId = r.mysql_vendor_id ?? 0;
      const [vendor, foodCount, orderCount, revenueAgg] = await Promise.all([
        vendorId
          ? this.mongo.findByMysqlId<{ mysql_id: number; f_name: string | null; l_name: string | null; email: string | null; phone: string | null }>('vendors', vendorId)
          : Promise.resolve(null),
        this.mongo.count('foods', { mysql_restaurant_id: r.mysql_id }),
        this.mongo.count('orders', { mysql_restaurant_id: r.mysql_id }),
        this.mongo.aggregate<{ _id: null; total: number }>('orders', [
          { $match: { mysql_restaurant_id: r.mysql_id, order_status: 'delivered', payment_status: 'paid' } },
          { $group: { _id: null, total: { $sum: '$order_amount' } } },
        ]),
      ]);
      const rx = r as Record<string, unknown>;
      // Sensible display fallbacks so the admin detail view never shows blanks
      // for partially-filled (e.g. freshly-applied) restaurants.
      const ownerFromContact = (() => {
        const local = String(r.email ?? '').split('@')[0]?.replace(/[._-]+/g, ' ').trim();
        if (local) return local.replace(/\b\w/g, (c) => c.toUpperCase());
        return `${r.name ?? 'Restaurant'} Owner`;
      })();
      return {
        restaurant: {
          ...r,
          id: r.mysql_id,
          zone_id: r.mysql_zone_id ?? 1,
          vendor_id: r.mysql_vendor_id ?? 0,
          comission: r.comission !== null && r.comission !== undefined ? Number(r.comission) : 10,
          minimum_order: Number(r.minimum_order ?? 0),
          tax: Number(r.tax ?? 0),
          minimum_shipping_charge: Number(r.minimum_shipping_charge ?? 0),
          restaurant_model: (rx.restaurant_model as string | null | undefined) || 'commission',
          delivery_time: (rx.delivery_time as string | null | undefined) || '30-40 min',
          latitude: rx.latitude != null && String(rx.latitude) !== '' ? rx.latitude : 12.9716,
          longitude: rx.longitude != null && String(rx.longitude) !== '' ? rx.longitude : 77.5946,
          logo_full_url: storageFullUrl('restaurant', r.logo ?? null),
          cover_photo_full_url: storageFullUrl('restaurant/cover', (rx.cover_photo as string | null | undefined) ?? null),
          // Documents the restaurant uploaded at signup (licence + extras) so
          // the joining-request reviewer can actually see them.
          license_document_full_url: storageFullUrl('restaurant', (rx.license_document as string | null | undefined) ?? null),
          additional_documents_full_urls: Array.isArray(rx.additional_documents)
            ? (rx.additional_documents as string[]).map((f) => storageFullUrl('restaurant', f)).filter(Boolean)
            : [],
        },
        // When no vendor is linked yet, synthesise the owner from the
        // restaurant's own contact so the Owner section is never blank.
        vendor: vendor
          ? {
              id: vendor.mysql_id,
              f_name: vendor.f_name,
              l_name: vendor.l_name,
              email: vendor.email,
              phone: vendor.phone,
            }
          : {
              id: r.mysql_vendor_id ?? r.mysql_id,
              f_name: ownerFromContact,
              l_name: '',
              email: r.email ?? null,
              phone: r.phone ?? null,
            },
        stats: {
          food_count: foodCount,
          order_count: orderCount,
          revenue: Number(revenueAgg[0]?.total ?? 0),
        },
      };
    }
    const r = await this.prisma.restaurants.findUnique({ where: { id: BigInt(id) } });
    if (!r) throw new NotFoundException({ errors: [{ code: 'restaurant', message: 'Restaurant not found' }] });
    const [vendor, foodCount, orderCount, revenue] = await Promise.all([
      this.prisma.vendors.findUnique({ where: { id: r.vendor_id } }),
      this.prisma.food.count({ where: { restaurant_id: r.id } }),
      this.prisma.orders.count({ where: { restaurant_id: r.id } }),
      this.prisma.orders.aggregate({
        where: { restaurant_id: r.id, order_status: 'delivered', payment_status: 'paid' },
        _sum: { order_amount: true },
      }),
    ]);
    return {
      restaurant: {
        ...r,
        id: Number(r.id),
        zone_id: r.zone_id ? Number(r.zone_id) : null,
        vendor_id: Number(r.vendor_id),
        comission: r.comission !== null ? Number(r.comission) : null,
        minimum_order: Number(r.minimum_order),
        tax: Number(r.tax),
        minimum_shipping_charge: Number(r.minimum_shipping_charge),
      },
      vendor: vendor
        ? {
            id: Number(vendor.id),
            f_name: vendor.f_name,
            l_name: vendor.l_name,
            email: vendor.email,
            phone: vendor.phone,
          }
        : null,
      stats: {
        food_count: foodCount,
        order_count: orderCount,
        revenue: Number(revenue._sum.order_amount ?? 0),
      },
    };
  }

  async updateRestaurant(
    id: number,
    body: {
      name?: string; email?: string; phone?: string; address?: string;
      comission?: number; minimum_order?: number; status?: boolean; active?: boolean;
      // Location (mirrors the Laravel admin restaurant form).
      latitude?: string | number; longitude?: string | number;
      // Vendor account password — only applied when a non-empty value is sent,
      // so leaving the field blank keeps the existing password (same rule as
      // Laravel's `strlen($request->password) > 1 ? bcrypt(...) : existing`).
      password?: string;
      // Full edit — everything the Add form captures can also be changed here.
      zone_id?: number; cuisine_ids?: number[] | string; tax?: number;
      minimum_delivery_time?: number; maximum_delivery_time?: number; delivery_time_type?: string;
      logo?: string; cover_photo?: string;
      veg?: boolean; non_veg?: boolean; delivery?: boolean; take_away?: boolean;
      restaurant_model?: string; identity_number?: string; state?: string; license_document?: string;
    },
  ) {
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.email !== undefined) data.email = body.email;
    if (body.phone !== undefined) data.phone = body.phone;
    if (body.address !== undefined) data.address = body.address;
    if (body.comission !== undefined) data.comission = body.comission;
    if (body.minimum_order !== undefined) data.minimum_order = body.minimum_order;
    if (body.status !== undefined) data.status = body.status;
    if (body.active !== undefined) data.active = body.active;
    if (body.zone_id !== undefined) { data.mysql_zone_id = Number(body.zone_id); data.zone_id = Number(body.zone_id); }
    if (body.tax !== undefined) data.tax = Number(body.tax);
    if (body.cuisine_ids !== undefined) {
      data.cuisine_ids = Array.isArray(body.cuisine_ids)
        ? body.cuisine_ids.map(Number).filter(Number.isFinite)
        : String(body.cuisine_ids).split(',').map((s) => Number(s.trim())).filter(Number.isFinite);
    }
    if (body.minimum_delivery_time !== undefined && body.maximum_delivery_time !== undefined) {
      data.delivery_time = `${body.minimum_delivery_time}-${body.maximum_delivery_time}-${body.delivery_time_type ?? 'min'}`;
    }
    if (body.logo !== undefined && body.logo) data.logo = body.logo;
    if (body.cover_photo !== undefined && body.cover_photo) data.cover_photo = body.cover_photo;
    if (body.veg !== undefined) data.veg = !!body.veg;
    if (body.non_veg !== undefined) data.non_veg = !!body.non_veg;
    if (body.delivery !== undefined) data.delivery = !!body.delivery;
    if (body.take_away !== undefined) data.take_away = !!body.take_away;
    if (body.restaurant_model !== undefined) data.restaurant_model = body.restaurant_model;
    if (body.identity_number !== undefined) data.identity_number = body.identity_number;
    if (body.state !== undefined) data.state = body.state;
    if (body.license_document !== undefined && body.license_document) data.license_document = body.license_document;
    // Latitude / longitude are stored as strings (varchar) to match the
    // Laravel schema. Validate ranges so a bad map pin can't be saved.
    if (body.latitude !== undefined && body.latitude !== null && String(body.latitude) !== '') {
      const lat = Number(body.latitude);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        throw new BadRequestException({ errors: [{ code: 'latitude', message: 'Latitude must be between -90 and 90' }] });
      }
      data.latitude = String(body.latitude);
    }
    if (body.longitude !== undefined && body.longitude !== null && String(body.longitude) !== '') {
      const lng = Number(body.longitude);
      if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
        throw new BadRequestException({ errors: [{ code: 'longitude', message: 'Longitude must be between -180 and 180' }] });
      }
      data.longitude = String(body.longitude);
    }

    // A password is only a change when it's actually filled in.
    const wantsPasswordChange = typeof body.password === 'string' && body.password.length > 1;
    let passwordHash: string | null = null;
    if (wantsPasswordChange) {
      // Laravel $2y$ prefix so the existing vendor login flow can verify it.
      passwordHash = (await bcrypt.hash(body.password as string, 10)).replace(/^\$2b\$/, '$2y$');
    }

    if (Object.keys(data).length === 0 && !wantsPasswordChange) {
      throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields to update' }] });
    }

    if (this.useMongo()) {
      const r = await this.mongo.findByMysqlId<{ mysql_id: number; mysql_vendor_id?: number }>('restaurants', id);
      if (!r) throw new NotFoundException({ errors: [{ code: 'restaurant', message: 'Restaurant not found' }] });
      if (Object.keys(data).length > 0) {
        await this.mongo.updateOne('restaurants', { mysql_id: id }, data);
      }
      if (passwordHash && r.mysql_vendor_id) {
        await this.mongo.updateOne('vendors', { mysql_id: r.mysql_vendor_id }, { password: passwordHash });
      }
      return { ok: true, id };
    }

    const r = await this.prisma.restaurants.findUnique({ where: { id: BigInt(id) }, select: { vendor_id: true } });
    if (!r) throw new NotFoundException({ errors: [{ code: 'restaurant', message: 'Restaurant not found' }] });
    if (Object.keys(data).length > 0) {
      await this.prisma.restaurants.update({ where: { id: BigInt(id) }, data });
    }
    if (passwordHash) {
      await this.prisma.vendors.update({ where: { id: r.vendor_id }, data: { password: passwordHash } });
    }
    return { ok: true, id };
  }

  /** Data for the restaurant detail page tabs (Foods / Orders / Reviews /
   *  Wallet / Transactions). Everything is scoped to the one restaurant. */
  async getRestaurantTabs(id: number, limit = 50) {
    const rid = Number(id);
    const empty = { foods: [], orders: [], reviews: [], transactions: [], wallet: { total_earning: 0, commission_paid: 0, delivered_count: 0, total_orders: 0, avg_rating: 0, rating_count: 0 } };
    if (!this.useMongo()) return empty;

    const restaurant = await this.mongo.findByMysqlId<{ mysql_id: number; comission?: number | null }>('restaurants', rid);
    if (!restaurant) throw new NotFoundException({ errors: [{ code: 'restaurant', message: 'Restaurant not found' }] });
    const commissionRate = Number(restaurant.comission ?? 0);

    const [foods, orders, reviews, allOrders] = await Promise.all([
      this.mongo.findMany<Record<string, unknown>>('foods', { mysql_restaurant_id: rid }, { sort: { mysql_id: -1 }, limit }),
      this.mongo.findMany<Record<string, unknown>>('orders', { mysql_restaurant_id: rid }, { sort: { mysql_id: -1 }, limit }),
      this.mongo.findMany<Record<string, unknown>>('reviews', { mysql_restaurant_id: rid }, { sort: { mysql_id: -1 }, limit }),
      this.mongo.findMany<Record<string, unknown>>('orders', { mysql_restaurant_id: rid }),
    ]);

    // Reviewer names for the Reviews tab.
    const userIds = Array.from(new Set(reviews.map((r) => Number(r.mysql_user_id)).filter(Boolean)));
    const users = userIds.length
      ? await this.mongo.findMany<{ mysql_id: number; f_name: string | null; l_name: string | null }>(
          'users', { mysql_id: { $in: userIds } }, { projection: { mysql_id: 1, f_name: 1, l_name: 1 } as Record<string, 0 | 1> })
      : [];
    const userById = new Map(users.map((u) => [u.mysql_id, u]));

    let totalEarning = 0, commissionPaid = 0, deliveredCount = 0, ratingSum = 0;
    for (const o of allOrders) {
      if (o.order_status === 'delivered' && o.payment_status === 'paid') {
        const amt = Number(o.order_amount ?? 0);
        totalEarning += amt;
        commissionPaid += amt * (commissionRate / 100);
        deliveredCount++;
      }
    }
    for (const rv of reviews) ratingSum += Number(rv.rating ?? 0);

    const transactions = allOrders
      .filter((o) => o.payment_status === 'paid')
      .sort((a, b) => Number(b.mysql_id) - Number(a.mysql_id))
      .slice(0, limit)
      .map((o) => {
        const amt = Number(o.order_amount ?? 0);
        return {
          id: Number(o.mysql_id),
          order_amount: amt,
          commission: amt * (commissionRate / 100),
          restaurant_earning: amt - amt * (commissionRate / 100),
          order_status: o.order_status ?? null,
          created_at: o.created_at ?? null,
        };
      });

    return {
      foods: foods.map((f) => ({
        id: Number(f.mysql_id),
        name: f.name ?? null,
        price: Number(f.price ?? 0),
        image: f.image ?? null,
        status: f.status ?? true,
        veg: f.veg ?? null,
      })),
      orders: orders.map((o) => ({
        id: Number(o.mysql_id),
        order_amount: Number(o.order_amount ?? 0),
        order_status: o.order_status ?? null,
        payment_status: o.payment_status ?? null,
        order_type: o.order_type ?? null,
        created_at: o.created_at ?? null,
      })),
      reviews: reviews.map((rv) => {
        const u = userById.get(Number(rv.mysql_user_id));
        return {
          id: Number(rv.mysql_id),
          rating: Number(rv.rating ?? 0),
          comment: rv.comment ?? null,
          reply: rv.reply ?? null,
          food_id: rv.mysql_food_id ? Number(rv.mysql_food_id) : null,
          customer: u ? `${u.f_name ?? ''} ${u.l_name ?? ''}`.trim() || null : null,
        };
      }),
      transactions,
      wallet: {
        total_earning: totalEarning,
        commission_paid: commissionPaid,
        restaurant_earning: totalEarning - commissionPaid,
        delivered_count: deliveredCount,
        total_orders: allOrders.length,
        avg_rating: reviews.length ? ratingSum / reviews.length : 0,
        rating_count: reviews.length,
      },
    };
  }

  // ── Users / Vendors / Delivery men ─────────────────────────────────────

  async listUsers(limit = 50, offset = 0, q?: string) {
    if (this.useMongo()) {
      const filter = this.buildMongoSearchFilter(q, ['f_name', 'l_name', 'email', 'phone']);
      const [rows, total] = await Promise.all([
        this.mongo.findMany<{ mysql_id: number; f_name: string | null; l_name: string | null; email: string | null; phone: string | null; status?: boolean; created_at?: Date }>(
          'users', filter,
          { sort: { mysql_id: -1 }, limit, skip: offset,
            projection: { mysql_id: 1, f_name: 1, l_name: 1, email: 1, phone: 1, status: 1, created_at: 1 } as Record<string, 0 | 1> },
        ),
        this.mongo.count('users', filter),
      ]);
      return { total, limit, offset, users: rows.map((r) => ({
        id: r.mysql_id, f_name: r.f_name, l_name: r.l_name, email: r.email,
        phone: r.phone, status: r.status, created_at: r.created_at,
      })) };
    }
    const where = q
      ? { OR: [{ f_name: { contains: q } }, { l_name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] }
      : {};
    const [rows, total] = await Promise.all([
      this.prisma.users.findMany({
        where,
        orderBy: { id: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          f_name: true,
          l_name: true,
          email: true,
          phone: true,
          status: true,
          created_at: true,
        },
      }),
      this.prisma.users.count({ where }),
    ]);
    return { total, limit, offset, users: rows.map((r) => ({ ...r, id: Number(r.id) })) };
  }

  /** Build a MongoDB filter that mirrors Prisma's `OR + contains` search. */
  private buildMongoSearchFilter(q: string | undefined, fields: string[]): Record<string, unknown> {
    if (!q?.trim()) return {};
    const regex = { $regex: q.trim(), $options: 'i' };
    return { $or: fields.map((f) => ({ [f]: regex })) };
  }

  async getUser(id: number) {
    if (this.useMongo()) {
      const u = await this.mongo.findByMysqlId<{
        mysql_id: number; f_name: string | null; l_name: string | null;
        email: string | null; phone: string | null; status?: boolean;
        is_phone_verified?: boolean; is_email_verified?: boolean;
        login_medium?: string | null; created_at?: Date;
      }>('users', id);
      if (!u) throw new NotFoundException({ errors: [{ code: 'user', message: 'User not found' }] });
      const [orderCount, spendAgg, allOrders, addresses, walletDoc] = await Promise.all([
        this.mongo.count('orders', { mysql_user_id: u.mysql_id }),
        this.mongo.aggregate<{ _id: null; total: number }>('orders', [
          { $match: { mysql_user_id: u.mysql_id, payment_status: 'paid' } },
          { $group: { _id: null, total: { $sum: '$order_amount' } } },
        ]),
        this.mongo.findMany<Record<string, unknown>>('orders', { mysql_user_id: u.mysql_id }, { sort: { mysql_id: -1 }, limit: 200 }),
        this.mongo.findMany<Record<string, unknown>>('customer_addresses', { mysql_user_id: u.mysql_id }, { limit: 20 }),
        this.mongo.findOne<{ balance?: number }>('wallets', { mysql_user_id: u.mysql_id }),
      ]);

      // Order status breakdown for the customer profile (delivered / ongoing /
      // canceled / refunded), matching the Laravel customer detail page.
      const breakdown = { delivered: 0, ongoing: 0, canceled: 0, refunded: 0 };
      for (const o of allOrders) {
        const s = String(o.order_status ?? '');
        if (s === 'delivered') breakdown.delivered++;
        else if (s === 'canceled') breakdown.canceled++;
        else if (s === 'refunded' || s === 'refund_requested') breakdown.refunded++;
        else breakdown.ongoing++;
      }

      return {
        user: {
          id: u.mysql_id,
          f_name: u.f_name,
          l_name: u.l_name,
          email: u.email,
          phone: u.phone,
          status: u.status,
          is_phone_verified: u.is_phone_verified,
          is_email_verified: u.is_email_verified,
          login_medium: u.login_medium,
          created_at: u.created_at,
        },
        stats: {
          order_count: orderCount,
          total_spend: Number(spendAgg[0]?.total ?? 0),
          wallet_balance: Number(walletDoc?.balance ?? 0),
          avg_order_value: orderCount > 0 ? Number(spendAgg[0]?.total ?? 0) / orderCount : 0,
          breakdown,
        },
        addresses: addresses.map((a) => ({
          id: Number(a.mysql_id),
          address_type: a.address_type ?? null,
          address: a.address ?? null,
          contact_person_name: a.contact_person_name ?? null,
          contact_person_number: a.contact_person_number ?? null,
        })),
        recent_orders: allOrders.slice(0, 15).map((o) => ({
          id: Number(o.mysql_id),
          order_amount: Number(o.order_amount ?? 0),
          order_status: o.order_status ?? null,
          payment_status: o.payment_status ?? null,
          created_at: o.created_at ?? null,
        })),
      };
    }
    const u = await this.prisma.users.findUnique({ where: { id: BigInt(id) } });
    if (!u) throw new NotFoundException({ errors: [{ code: 'user', message: 'User not found' }] });
    const [orderCount, totalSpend] = await Promise.all([
      this.prisma.orders.count({ where: { user_id: u.id } }),
      this.prisma.orders.aggregate({
        where: { user_id: u.id, payment_status: 'paid' },
        _sum: { order_amount: true },
      }),
    ]);
    return {
      user: {
        id: Number(u.id),
        f_name: u.f_name,
        l_name: u.l_name,
        email: u.email,
        phone: u.phone,
        status: u.status,
        is_phone_verified: u.is_phone_verified,
        is_email_verified: u.is_email_verified,
        login_medium: u.login_medium,
        created_at: u.created_at,
      },
      stats: {
        order_count: orderCount,
        total_spend: Number(totalSpend._sum.order_amount ?? 0),
      },
    };
  }

  async updateUserStatus(id: number, status: boolean) {
    if (this.useMongo()) {
      const u = await this.mongo.findByMysqlId<{ mysql_id: number }>('users', id);
      if (!u) throw new NotFoundException({ errors: [{ code: 'user', message: 'User not found' }] });
      await this.mongo.updateOne('users', { mysql_id: id }, { status });
      return { ok: true, id, status };
    }
    const u = await this.prisma.users.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!u) throw new NotFoundException({ errors: [{ code: 'user', message: 'User not found' }] });
    await this.prisma.users.update({ where: { id: u.id }, data: { status } });
    return { ok: true, id, status };
  }

  async listVendors(limit = 50, offset = 0, q?: string) {
    if (this.useMongo()) {
      const filter = this.buildMongoSearchFilter(q, ['f_name', 'l_name', 'email', 'phone']);
      const [rows, total] = await Promise.all([
        this.mongo.findMany<{ mysql_id: number; f_name: string | null; l_name: string | null; email: string | null; phone: string | null; status?: boolean; image: string | null; created_at?: Date }>(
          'vendors', filter,
          { sort: { mysql_id: -1 }, limit, skip: offset,
            projection: { mysql_id: 1, f_name: 1, l_name: 1, email: 1, phone: 1, status: 1, image: 1, created_at: 1 } as Record<string, 0 | 1> },
        ),
        this.mongo.count('vendors', filter),
      ]);
      return { total, limit, offset, vendors: rows.map((r) => ({
        id: r.mysql_id, f_name: r.f_name, l_name: r.l_name, email: r.email,
        phone: r.phone, status: r.status, image: r.image, created_at: r.created_at,
      })) };
    }
    const where = q
      ? { OR: [{ f_name: { contains: q } }, { l_name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] }
      : {};
    const [rows, total] = await Promise.all([
      this.prisma.vendors.findMany({
        where,
        orderBy: { id: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          f_name: true,
          l_name: true,
          email: true,
          phone: true,
          status: true,
          image: true,
          created_at: true,
        },
      }),
      this.prisma.vendors.count({ where }),
    ]);
    return { total, limit, offset, vendors: rows.map((r) => ({ ...r, id: Number(r.id) })) };
  }

  async updateVendorStatus(id: number, status: boolean) {
    if (this.useMongo()) {
      const v = await this.mongo.findByMysqlId<{ mysql_id: number }>('vendors', id);
      if (!v) throw new NotFoundException({ errors: [{ code: 'vendor', message: 'Vendor not found' }] });
      await this.mongo.updateOne('vendors', { mysql_id: id }, { status });
      return { ok: true, id, status };
    }
    const v = await this.prisma.vendors.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!v) throw new NotFoundException({ errors: [{ code: 'vendor', message: 'Vendor not found' }] });
    await this.prisma.vendors.update({ where: { id: v.id }, data: { status } });
    return { ok: true, id, status };
  }

  async listDeliveryMen(limit = 50, offset = 0, q?: string) {
    if (this.useMongo()) {
      const filter = this.buildMongoSearchFilter(q, ['f_name', 'l_name', 'email', 'phone']);
      const [rows, total] = await Promise.all([
        this.mongo.findMany<{ mysql_id: number; f_name: string | null; l_name: string | null; email: string | null; phone: string | null; status?: boolean; application_status: string | null; image: string | null; mysql_zone_id?: number; created_at?: Date }>(
          'delivery_men', filter,
          { sort: { mysql_id: -1 }, limit, skip: offset },
        ),
        this.mongo.count('delivery_men', filter),
      ]);
      return {
        total, limit, offset,
        delivery_men: rows.map((r) => ({
          id: r.mysql_id, f_name: r.f_name, l_name: r.l_name, email: r.email,
          phone: r.phone, status: r.status, application_status: r.application_status,
          image: r.image, zone_id: r.mysql_zone_id ?? null, created_at: r.created_at,
        })),
      };
    }
    const where = q
      ? { OR: [{ f_name: { contains: q } }, { l_name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] }
      : {};
    const [rows, total] = await Promise.all([
      this.prisma.delivery_men.findMany({
        where,
        orderBy: { id: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          f_name: true,
          l_name: true,
          email: true,
          phone: true,
          status: true,
          application_status: true,
          image: true,
          zone_id: true,
          created_at: true,
        },
      }),
      this.prisma.delivery_men.count({ where }),
    ]);
    return {
      total,
      limit,
      offset,
      delivery_men: rows.map((r) => ({
        ...r,
        id: Number(r.id),
        zone_id: r.zone_id ? Number(r.zone_id) : null,
      })),
    };
  }

  /** Full delivery-man record for the admin edit page. */
  async getDeliveryMan(id: number) {
    if (!this.useMongo()) throw new BadRequestException({ errors: [{ code: 'config', message: 'Mongo required' }] });
    const d = await this.mongo.findByMysqlId<Record<string, unknown>>('delivery_men', Number(id));
    if (!d) throw new NotFoundException({ errors: [{ code: 'delivery_man', message: 'Delivery man not found' }] });
    return {
      delivery_man: {
        ...d,
        id: Number(d.mysql_id),
        zone_id: d.mysql_zone_id ?? d.zone_id ?? null,
        vehicle_id: d.vehicle_id ?? null,
        shift_id: d.shift_id ?? null,
        dob: d.dob ?? null,
        image_full_url: storageFullUrl('delivery-man', (d.image as string | null | undefined) ?? null),
        license_image_full_url: storageFullUrl('delivery-man', (d.license_image as string | null | undefined) ?? null),
        identity_image_full_urls: Array.isArray(d.identity_image)
          ? (d.identity_image as string[]).map((f) => storageFullUrl('delivery-man', f)).filter(Boolean)
          : [],
      },
    };
  }

  /** Edit an existing delivery man (StackFood's edit pencil). Only the fields
   *  actually sent are changed; a blank password keeps the existing one. */
  async updateDeliveryMan(id: number, body: {
    f_name?: string; l_name?: string; email?: string; phone?: string; password?: string;
    zone_id?: number; vehicle_id?: number; dm_type?: string; shift_id?: number | null;
    age?: number; dob?: string; identity_type?: string; identity_number?: string;
    image?: string; license_image?: string; status?: boolean;
  }) {
    if (!this.useMongo()) throw new BadRequestException({ errors: [{ code: 'config', message: 'Mongo required' }] });
    const d = await this.mongo.findByMysqlId<{ mysql_id: number }>('delivery_men', Number(id));
    if (!d) throw new NotFoundException({ errors: [{ code: 'delivery_man', message: 'Delivery man not found' }] });
    const data: Record<string, unknown> = {};
    if (body.f_name !== undefined) data.f_name = body.f_name;
    if (body.l_name !== undefined) data.l_name = body.l_name;
    if (body.email !== undefined) data.email = body.email;
    if (body.phone !== undefined) data.phone = body.phone;
    if (body.zone_id !== undefined) data.mysql_zone_id = Number(body.zone_id);
    if (body.vehicle_id !== undefined) data.vehicle_id = Number(body.vehicle_id);
    if (body.dm_type !== undefined) { data.type = body.dm_type; data.earning = body.dm_type === 'freelancer'; }
    if (body.shift_id !== undefined) data.shift_id = body.shift_id ? Number(body.shift_id) : null;
    if (body.age !== undefined) data.age = body.age !== null ? Number(body.age) : null;
    if (body.dob !== undefined) data.dob = body.dob ? new Date(body.dob) : null;
    if (body.identity_type !== undefined) data.identity_type = body.identity_type;
    if (body.identity_number !== undefined) data.identity_number = body.identity_number;
    if (body.image !== undefined && body.image) data.image = body.image;
    if (body.license_image !== undefined && body.license_image) data.license_image = body.license_image;
    if (body.status !== undefined) data.status = body.status;
    if (typeof body.password === 'string' && body.password.length > 1) {
      const bcrypt = await import('bcrypt');
      data.password = (await bcrypt.hash(body.password, 10)).replace(/^\$2b\$/, '$2y$');
    }
    if (Object.keys(data).length === 0) throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields to update' }] });
    data.updated_at = new Date();
    await this.mongo.updateOne('delivery_men', { mysql_id: Number(id) }, data);
    return { ok: true, id };
  }

  async updateDeliveryManStatus(id: number, status: boolean) {
    if (this.useMongo()) {
      const d = await this.mongo.findByMysqlId<{ mysql_id: number }>('delivery_men', id);
      if (!d) throw new NotFoundException({ errors: [{ code: 'delivery_man', message: 'Delivery man not found' }] });
      await this.mongo.updateOne('delivery_men', { mysql_id: id }, { status });
      return { ok: true, id, status };
    }
    const d = await this.prisma.delivery_men.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!d) throw new NotFoundException({ errors: [{ code: 'delivery_man', message: 'Delivery man not found' }] });
    await this.prisma.delivery_men.update({ where: { id: d.id }, data: { status } });
    return { ok: true, id, status };
  }

  /** Remove a delivery man. Mirrors Laravel's DeliveryManController::delete. */
  async deleteDeliveryMan(id: number) {
    if (this.useMongo()) {
      const d = await this.mongo.findByMysqlId<{ mysql_id: number }>('delivery_men', id);
      if (!d) throw new NotFoundException({ errors: [{ code: 'delivery_man', message: 'Delivery man not found' }] });
      await this.mongo.deleteOne('delivery_men', { mysql_id: id });
      return { ok: true, id };
    }
    const d = await this.prisma.delivery_men.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!d) throw new NotFoundException({ errors: [{ code: 'delivery_man', message: 'Delivery man not found' }] });
    await this.prisma.delivery_men.delete({ where: { id: d.id } });
    return { ok: true, id };
  }

  async approveDeliveryMan(id: number, approval: 'approved' | 'denied') {
    if (this.useMongo()) {
      const d = await this.mongo.findByMysqlId<{ mysql_id: number }>('delivery_men', id);
      if (!d) throw new NotFoundException({ errors: [{ code: 'delivery_man', message: 'Delivery man not found' }] });
      await this.mongo.updateOne('delivery_men', { mysql_id: id }, { application_status: approval });
      return { ok: true, id, application_status: approval };
    }
    const d = await this.prisma.delivery_men.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!d) throw new NotFoundException({ errors: [{ code: 'delivery_man', message: 'Delivery man not found' }] });
    await this.prisma.delivery_men.update({
      where: { id: d.id },
      data: { application_status: approval },
    });
    return { ok: true, id, application_status: approval };
  }

  // ── Food ──────────────────────────────────────────────────────────────

  async listFood(limit = 50, offset = 0, q?: string, restaurantId?: number) {
    if (this.useMongo()) {
      const filter: Record<string, unknown> = {};
      if (restaurantId) filter.mysql_restaurant_id = restaurantId;
      if (q?.trim()) filter.name = { $regex: q.trim(), $options: 'i' };
      const [rows, total] = await Promise.all([
        this.mongo.findMany<{
          mysql_id: number; name: string | null; image: string | null;
          price?: number; discount?: number; discount_type?: string;
          veg?: boolean; status?: boolean;
          mysql_restaurant_id?: number; mysql_category_id?: number;
          avg_rating?: number; order_count?: number; recommended?: boolean;
          item_stock?: number; stock_type?: string;
        }>('foods', filter, { sort: { mysql_id: -1 }, limit, skip: offset }),
        this.mongo.count('foods', filter),
      ]);
      // Also fetch restaurant names to embed (admin panel expects `restaurant.name`)
      const restaurantIds = Array.from(new Set(rows.map((r) => r.mysql_restaurant_id).filter((x): x is number => !!x)));
      const restaurants = restaurantIds.length
        ? await this.mongo.findMany<{ mysql_id: number; name: string | null }>(
            'restaurants',
            { mysql_id: { $in: restaurantIds } },
            { projection: { mysql_id: 1, name: 1 } as Record<string, 0 | 1> },
          )
        : [];
      const restMap = new Map(restaurants.map((r) => [r.mysql_id, r.name]));
      return {
        total, limit, offset,
        food: rows.map((r) => ({
          id: r.mysql_id, name: r.name, image: r.image,
          price: Number(r.price ?? 0), discount: Number(r.discount ?? 0),
          discount_type: r.discount_type, veg: !!r.veg, status: !!r.status,
          restaurant_id: r.mysql_restaurant_id ?? 0,
          category_id: r.mysql_category_id ?? 0,
          avg_rating: Number(r.avg_rating ?? 0),
          order_count: r.order_count ?? 0,
          recommended: !!r.recommended,
          item_stock: r.item_stock ?? 0,
          stock_type: r.stock_type,
          restaurant: { id: r.mysql_restaurant_id, name: restMap.get(r.mysql_restaurant_id ?? 0) ?? null },
        })),
      };
    }
    const where: Record<string, unknown> = {};
    if (restaurantId) where.restaurant_id = BigInt(restaurantId);
    if (q) (where as { name: unknown }).name = { contains: q };
    const [rows, total] = await Promise.all([
      this.prisma.food.findMany({
        where,
        orderBy: { id: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          name: true,
          image: true,
          price: true,
          discount: true,
          discount_type: true,
          veg: true,
          status: true,
          restaurant_id: true,
          category_id: true,
          avg_rating: true,
          order_count: true,
          recommended: true,
          item_stock: true,
          stock_type: true,
        },
      }),
      this.prisma.food.count({ where }),
    ]);
    const restaurantIds = Array.from(new Set(rows.map((r) => r.restaurant_id)));
    const restaurants = restaurantIds.length
      ? await this.prisma.restaurants.findMany({
          where: { id: { in: restaurantIds } },
          select: { id: true, name: true },
        })
      : [];
    const restaurantById = new Map(restaurants.map((r) => [String(r.id), r]));
    return {
      total,
      limit,
      offset,
      food: rows.map((r) => ({
        ...r,
        id: Number(r.id),
        restaurant_id: Number(r.restaurant_id),
        restaurant: restaurantById.get(String(r.restaurant_id)) ?? null,
        category_id: r.category_id ? Number(r.category_id) : null,
        price: Number(r.price),
        discount: Number(r.discount),
      })),
    };
  }

  async getFood(id: number) {
    if (this.useMongo()) {
      const doc = await this.mongo.findByMysqlId<Record<string, unknown>>('foods', id);
      if (!doc) throw new NotFoundException({ errors: [{ code: 'food', message: 'Food not found' }] });
      const restId = Number(doc.mysql_restaurant_id ?? 0);
      const restaurant = restId
        ? await this.mongo.findByMysqlId<{ mysql_id: number; name: string | null }>('restaurants', restId)
        : null;
      return {
        food: {
          ...doc,
          id: Number(doc.mysql_id),
          restaurant_id: restId,
          category_id: doc.mysql_category_id ? Number(doc.mysql_category_id) : null,
          sub_category_id: doc.mysql_sub_category_id ? Number(doc.mysql_sub_category_id) : null,
          price: Number(doc.price ?? 0),
          tax: Number(doc.tax ?? 0),
          discount: Number(doc.discount ?? 0),
          variations: Array.isArray(doc.variations) ? doc.variations : [],
          add_ons: Array.isArray(doc.add_ons) ? doc.add_ons : Array.isArray(doc.addon_ids) ? doc.addon_ids : [],
          addon_ids: Array.isArray(doc.addon_ids) ? doc.addon_ids : [],
          translations: Array.isArray(doc.translations) ? doc.translations : [],
          image_full_url: storageFullUrl('product', (doc.image as string | null | undefined) ?? null),
          request_status: (doc.request_status as string | undefined) ?? 'approved',
          rejection_reason: (doc.rejection_reason as string | null | undefined) ?? null,
        },
        restaurant: restaurant ? { id: Number(restaurant.mysql_id), name: restaurant.name } : null,
      };
    }
    const f = await this.prisma.food.findUnique({ where: { id: BigInt(id) } });
    if (!f) throw new NotFoundException({ errors: [{ code: 'food', message: 'Food not found' }] });
    const restaurant = await this.prisma.restaurants.findUnique({
      where: { id: f.restaurant_id },
      select: { id: true, name: true },
    });
    return {
      food: {
        ...f,
        id: Number(f.id),
        restaurant_id: Number(f.restaurant_id),
        category_id: f.category_id ? Number(f.category_id) : null,
        price: Number(f.price),
        tax: Number(f.tax),
        discount: Number(f.discount),
        variations: parseJsonField(f.variations),
        add_ons: parseJsonField(f.add_ons),
        attributes: parseJsonField(f.attributes),
        choice_options: parseJsonField(f.choice_options),
      },
      restaurant: restaurant ? { id: Number(restaurant.id), name: restaurant.name } : null,
    };
  }

  /** New food items a restaurant added that await admin approval. */
  async listPendingFood() {
    if (!this.useMongo()) return { total: 0, items: [] };
    const rows = await this.mongo.findMany<{
      mysql_id: number; name?: string | null; image?: string | null; price?: number;
      veg?: boolean; mysql_restaurant_id?: number; mysql_category_id?: number; created_at?: Date | null;
    }>('foods', { request_status: 'pending' }, { sort: { mysql_id: -1 }, limit: 200 });
    const restIds = Array.from(new Set(rows.map((r) => r.mysql_restaurant_id).filter((x): x is number => !!x)));
    const rests = restIds.length
      ? await this.mongo.findMany<{ mysql_id: number; name: string | null }>('restaurants', { mysql_id: { $in: restIds } }, { projection: { mysql_id: 1, name: 1 } as Record<string, 0 | 1> })
      : [];
    const restMap = new Map(rests.map((r) => [r.mysql_id, r.name]));
    return {
      total: rows.length,
      items: rows.map((r) => ({
        id: r.mysql_id,
        name: r.name ?? '—',
        price: Number(r.price ?? 0),
        veg: !!r.veg,
        image_full_url: storageFullUrl('product', r.image ?? null),
        restaurant_id: r.mysql_restaurant_id ?? null,
        restaurant_name: r.mysql_restaurant_id ? (restMap.get(r.mysql_restaurant_id) ?? `Restaurant #${r.mysql_restaurant_id}`) : '—',
        submitted_at: r.created_at ?? null,
        status: 'pending',
      })),
    };
  }

  /** Approve / reject a pending food item. Approve makes it live; reject keeps
   *  it offline and records the admin's remark. */
  async updateFoodApproval(id: number, decision: 'approved' | 'denied', reason?: string) {
    if (!this.useMongo()) throw new BadRequestException({ errors: [{ code: 'config', message: 'Mongo required' }] });
    const f = await this.mongo.findByMysqlId<{ mysql_id: number }>('foods', id);
    if (!f) throw new NotFoundException({ errors: [{ code: 'food', message: 'Food not found' }] });
    await this.mongo.updateOne('foods', { mysql_id: id }, {
      request_status: decision,
      status: decision === 'approved',
      rejection_reason: decision === 'denied' ? (reason ?? null) : null,
      approved_at: decision === 'approved' ? new Date() : null,
      updated_at: new Date(),
    });
    return { ok: true, id, decision };
  }

  async updateFoodStatus(id: number, status: boolean) {
    if (this.useMongo()) {
      const f = await this.mongo.findByMysqlId<{ mysql_id: number }>('foods', id);
      if (!f) throw new NotFoundException({ errors: [{ code: 'food', message: 'Food not found' }] });
      await this.mongo.updateOne('foods', { mysql_id: id }, { status });
      return { ok: true, id, status };
    }
    const f = await this.prisma.food.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!f) throw new NotFoundException({ errors: [{ code: 'food', message: 'Food not found' }] });
    await this.prisma.food.update({ where: { id: f.id }, data: { status } });
    return { ok: true, id, status };
  }

  async updateFoodRecommended(id: number, recommended: boolean) {
    if (this.useMongo()) {
      const f = await this.mongo.findByMysqlId<{ mysql_id: number }>('foods', id);
      if (!f) throw new NotFoundException({ errors: [{ code: 'food', message: 'Food not found' }] });
      await this.mongo.updateOne('foods', { mysql_id: id }, { recommended });
      return { ok: true, id, recommended };
    }
    const f = await this.prisma.food.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!f) throw new NotFoundException({ errors: [{ code: 'food', message: 'Food not found' }] });
    await this.prisma.food.update({ where: { id: f.id }, data: { recommended } });
    return { ok: true, id, recommended };
  }

  /** Delete a food item. Mirrors Laravel's FoodController::delete — also drops
   *  the dish from any cart/wishlist rows so nothing references a ghost food. */
  async deleteFood(id: number) {
    if (this.useMongo()) {
      const f = await this.mongo.findByMysqlId<{ mysql_id: number }>('foods', id);
      if (!f) throw new NotFoundException({ errors: [{ code: 'food', message: 'Food not found' }] });
      await this.mongo.deleteOne('foods', { mysql_id: id });
      // Best-effort cleanup of dependent rows (ignore if collections absent).
      await this.mongo.deleteMany('carts', { mysql_food_id: id }).catch(() => undefined);
      await this.mongo.deleteMany('wishlists', { mysql_food_id: id }).catch(() => undefined);
      return { ok: true, id };
    }
    const f = await this.prisma.food.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!f) throw new NotFoundException({ errors: [{ code: 'food', message: 'Food not found' }] });
    await this.prisma.food.delete({ where: { id: f.id } });
    return { ok: true, id };
  }

  // ── Categories ────────────────────────────────────────────────────────

  async listCategories(parentId?: number) {
    if (this.useMongo()) {
      const filter: Record<string, unknown> = {};
      if (parentId !== undefined) filter.parent_id = parentId;
      const rows = await this.mongo.findMany<{
        mysql_id: number; name: string; image: string | null; parent_id: number;
        position: number; status?: boolean; priority: number;
        slug?: string | null; meta_title?: string | null; meta_description?: string | null;
        meta_image?: string | null; meta_data?: string | null;
        created_at?: Date; updated_at?: Date;
      }>('categories', filter, { sort: { priority: 1, mysql_id: -1 } });
      return {
        categories: rows.map((r) => ({
          id: r.mysql_id,
          name: r.name,
          image: r.image,
          parent_id: r.parent_id,
          position: r.position,
          status: r.status ?? true,
          priority: r.priority,
          slug: r.slug ?? null,
          meta_title: r.meta_title ?? null,
          meta_description: r.meta_description ?? null,
          meta_image: r.meta_image ?? null,
          meta_data: r.meta_data ?? null,
          created_at: r.created_at ?? null,
          updated_at: r.updated_at ?? null,
        })),
      };
    }
    const rows = await this.prisma.categories.findMany({
      where: parentId !== undefined ? { parent_id: parentId } : undefined,
      orderBy: [{ priority: 'asc' }, { id: 'desc' }],
    });
    return { categories: rows.map((r) => ({ ...r, id: Number(r.id) })) };
  }

  /** CSV export of every category (top-level + sub) for backup / editing. */
  async bulkExportCategories() {
    const { categories } = await this.listCategories();
    return {
      total: categories.length,
      rows: categories.map((c) => ({
        id: c.id,
        name: c.name,
        parent_id: c.parent_id ?? 0,
        position: c.position ?? 1,
        priority: c.priority ?? 0,
        status: c.status ? 1 : 0,
      })),
    };
  }

  /** Create many categories from parsed CSV rows. parent_id>0 → sub-category. */
  async bulkImportCategories(rows: Array<Record<string, unknown>>) {
    let created = 0;
    const errors: string[] = [];
    for (const [i, row] of rows.entries()) {
      const name = String(row.name ?? '').trim();
      if (!name) { errors.push(`Row ${i + 1}: name is required`); continue; }
      try {
        await this.createCategory({
          name,
          parent_id: row.parent_id != null && row.parent_id !== '' ? Number(row.parent_id) : 0,
          position: row.position != null && row.position !== '' ? Number(row.position) : 1,
          priority: row.priority != null && row.priority !== '' ? Number(row.priority) : 0,
          translations: [{ locale: 'default', key: 'name', value: name }],
        });
        created++;
      } catch (e) {
        errors.push(`Row ${i + 1}: ${(e as Error).message}`);
      }
    }
    return { ok: true, created, failed: errors.length, errors };
  }

  async createCategory(body: { name: string; parent_id?: number; position?: number; priority?: number; image?: string | null; translations?: Array<{ locale?: string; key?: string; value?: string }> }) {
    if (!body.name) throw new BadRequestException({ errors: [{ code: 'name', message: 'name is required' }] });
    const translations = Array.isArray(body.translations) ? body.translations : [];
    const trName = translations.find((t) => (t.locale === 'en' || t.locale === 'default') && t.key === 'name')?.value;
    if (this.useMongo()) {
      const now = new Date();
      const mysql_id = await this.mongo.nextMysqlId('categories');
      await this.mongo.insertOne('categories', {
        mysql_id,
        name: trName ?? body.name,
        translations,
        parent_id: body.parent_id ?? 0,
        position: body.position ?? 1,
        priority: body.priority ?? 0,
        image: body.image ?? 'def.png',
        status: true,
        created_at: now,
        updated_at: now,
      });
      return { ok: true, id: mysql_id };
    }
    const created = await this.prisma.categories.create({
      data: {
        name: body.name,
        parent_id: body.parent_id ?? 0,
        position: body.position ?? 1,
        priority: body.priority ?? 0,
        image: body.image ?? 'def.png',
      },
    });
    return { ok: true, id: Number(created.id) };
  }

  async updateCategory(id: number, body: { name?: string; status?: boolean; priority?: number; translations?: Array<{ locale?: string; key?: string; value?: string }> }) {
    if (this.useMongo()) {
      const c = await this.mongo.findByMysqlId<{ mysql_id: number }>('categories', id);
      if (!c) throw new NotFoundException({ errors: [{ code: 'category', message: 'Category not found' }] });
      const data: Record<string, unknown> = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.status !== undefined) data.status = body.status;
      if (body.priority !== undefined) data.priority = body.priority;
      if (body.translations !== undefined) {
        const translations = Array.isArray(body.translations) ? body.translations : [];
        data.translations = translations;
        const trName = translations.find((t) => (t.locale === 'en' || t.locale === 'default') && t.key === 'name')?.value;
        if (trName !== undefined) data.name = trName;
      }
      if (Object.keys(data).length === 0) {
        throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields to update' }] });
      }
      data.updated_at = new Date();
      await this.mongo.updateOne('categories', { mysql_id: id }, data);
      return { ok: true, id };
    }
    const c = await this.prisma.categories.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!c) throw new NotFoundException({ errors: [{ code: 'category', message: 'Category not found' }] });
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.status !== undefined) data.status = body.status;
    if (body.priority !== undefined) data.priority = body.priority;
    if (Object.keys(data).length === 0) {
      throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields to update' }] });
    }
    await this.prisma.categories.update({ where: { id: c.id }, data });
    return { ok: true, id };
  }

  async deleteCategory(id: number) {
    if (this.useMongo()) {
      const c = await this.mongo.findByMysqlId<{ mysql_id: number }>('categories', id);
      if (!c) throw new NotFoundException({ errors: [{ code: 'category', message: 'Category not found' }] });
      await this.mongo.deleteOne('categories', { mysql_id: id });
      return { ok: true, id };
    }
    const c = await this.prisma.categories.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!c) throw new NotFoundException({ errors: [{ code: 'category', message: 'Category not found' }] });
    await this.prisma.categories.delete({ where: { id: c.id } });
    return { ok: true, id };
  }

  // ── Cuisines ──────────────────────────────────────────────────────────

  async listCuisines() {
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<{
        mysql_id: number; name: string; image: string | null; status?: boolean;
        slug?: string | null; meta_title?: string | null; meta_description?: string | null;
        meta_image?: string | null; meta_data?: string | null;
        created_at?: Date; updated_at?: Date;
      }>('cuisines', {}, { sort: { mysql_id: -1 } });
      return {
        cuisines: rows.map((r) => ({
          id: r.mysql_id,
          name: r.name,
          image: r.image,
          status: r.status ?? true,
          slug: r.slug ?? null,
          meta_title: r.meta_title ?? null,
          meta_description: r.meta_description ?? null,
          meta_image: r.meta_image ?? null,
          meta_data: r.meta_data ?? null,
          created_at: r.created_at ?? null,
          updated_at: r.updated_at ?? null,
        })),
      };
    }
    const rows = await this.prisma.cuisines.findMany({ orderBy: { id: 'desc' } });
    return { cuisines: rows.map((r) => ({ ...r, id: Number(r.id) })) };
  }

  async createCuisine(body: { name: string; image?: string | null }) {
    if (!body.name) throw new BadRequestException({ errors: [{ code: 'name', message: 'name is required' }] });
    if (this.useMongo()) {
      const now = new Date();
      const mysql_id = await this.mongo.nextMysqlId('cuisines');
      await this.mongo.insertOne('cuisines', {
        mysql_id,
        name: body.name,
        image: body.image ?? null,
        status: true,
        created_at: now,
        updated_at: now,
      });
      return { ok: true, id: mysql_id };
    }
    const created = await this.prisma.cuisines.create({ data: { name: body.name, image: body.image ?? null } });
    return { ok: true, id: Number(created.id) };
  }

  /**
   * Generic partial update for simple admin-managed collections (Edit actions).
   * Whitelists `allowed` fields, coerces *_date → Date and money/number fields →
   * Number, leaves strings/booleans/time-strings as-is, and stamps updated_at.
   */
  async updateRecord(collection: string, id: number, body: Record<string, unknown>, allowed: string[]): Promise<{ ok: true; id: number }> {
    if (!this.useMongo()) throw new BadRequestException({ errors: [{ code: 'config', message: 'Mongo required' }] });
    const isDate = (k: string) => k.endsWith('_date');
    const isNum = (k: string) => /(amount|charge|purchase|discount|limit|coverage_area|priority|position|parent_id|extra)/.test(k);
    const set: Record<string, unknown> = {};
    for (const k of allowed) {
      if (!(k in body) || body[k] === undefined) continue;
      let v = body[k];
      if (isDate(k)) v = v && typeof v === 'string' ? new Date(v) : null;
      else if (isNum(k) && v !== null && v !== '') v = Number(v);
      set[k] = v;
    }
    if (Object.keys(set).length === 0) throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields to update' }] });
    set.updated_at = new Date();
    const exists = await this.mongo.findByMysqlId<{ mysql_id: number }>(collection, id);
    if (!exists) throw new NotFoundException({ errors: [{ code: 'record', message: 'Record not found' }] });
    await this.mongo.updateOne(collection, { mysql_id: Number(id) }, set);
    return { ok: true, id: Number(id) };
  }

  async updateCuisine(id: number, body: { name?: string; status?: boolean }) {
    if (this.useMongo()) {
      const c = await this.mongo.findByMysqlId<{ mysql_id: number }>('cuisines', id);
      if (!c) throw new NotFoundException({ errors: [{ code: 'cuisine', message: 'Cuisine not found' }] });
      const data: Record<string, unknown> = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.status !== undefined) data.status = body.status;
      if (Object.keys(data).length === 0) {
        throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields to update' }] });
      }
      data.updated_at = new Date();
      await this.mongo.updateOne('cuisines', { mysql_id: id }, data);
      return { ok: true, id };
    }
    const c = await this.prisma.cuisines.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!c) throw new NotFoundException({ errors: [{ code: 'cuisine', message: 'Cuisine not found' }] });
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.status !== undefined) data.status = body.status;
    if (Object.keys(data).length === 0) {
      throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields to update' }] });
    }
    await this.prisma.cuisines.update({ where: { id: c.id }, data });
    return { ok: true, id };
  }

  async deleteCuisine(id: number) {
    if (this.useMongo()) {
      const c = await this.mongo.findByMysqlId<{ mysql_id: number }>('cuisines', id);
      if (!c) throw new NotFoundException({ errors: [{ code: 'cuisine', message: 'Cuisine not found' }] });
      await this.mongo.deleteOne('cuisines', { mysql_id: id });
      return { ok: true, id };
    }
    const c = await this.prisma.cuisines.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!c) throw new NotFoundException({ errors: [{ code: 'cuisine', message: 'Cuisine not found' }] });
    await this.prisma.cuisines.delete({ where: { id: c.id } });
    return { ok: true, id };
  }

  // ── Coupons ───────────────────────────────────────────────────────────

  async listCoupons() {
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<{
        mysql_id: number; title: string | null; code: string | null;
        start_date: Date | null; expire_date: Date | null;
        min_purchase?: number | string; max_discount?: number | string; discount?: number | string;
        discount_type?: string; coupon_type?: string; limit?: number | null;
        status?: boolean; created_at?: Date | null; updated_at?: Date | null;
        data?: string | null; total_uses?: number | null;
        created_by?: string | null; customer_id?: string | null; slug?: string | null;
        restaurant_id?: number | null; mysql_restaurant_id?: number | null;
        discount_owner?: string | null; admin_discount_amount?: number | null; restaurant_discount_amount?: number | null;
      }>('coupons', {}, { sort: { mysql_id: -1 } });
      return {
        coupons: rows.map((r) => ({
          id: r.mysql_id,
          title: r.title ?? null,
          code: r.code ?? null,
          start_date: r.start_date ?? null,
          expire_date: r.expire_date ?? null,
          min_purchase: Number(r.min_purchase ?? 0),
          max_discount: Number(r.max_discount ?? 0),
          discount: Number(r.discount ?? 0),
          discount_type: r.discount_type ?? 'percentage',
          coupon_type: r.coupon_type ?? 'default',
          limit: r.limit ?? null,
          status: r.status ?? true,
          created_at: r.created_at ?? null,
          updated_at: r.updated_at ?? null,
          data: r.data ?? null,
          total_uses: r.total_uses ? Number(r.total_uses) : 0,
          created_by: r.created_by ?? null,
          customer_id: r.customer_id ?? null,
          slug: r.slug ?? null,
          restaurant_id: r.mysql_restaurant_id ?? r.restaurant_id ?? null,
          // Who funds this coupon's discount — so admin can check at a glance.
          // Older coupons without the field are treated as admin-funded.
          discount_owner: ['admin', 'restaurant', 'shared'].includes(String(r.discount_owner)) ? r.discount_owner : 'admin',
          admin_discount_amount: Number(r.admin_discount_amount ?? 0),
          restaurant_discount_amount: Number(r.restaurant_discount_amount ?? 0),
          funded_by: ['admin', 'restaurant', 'shared'].includes(String(r.discount_owner)) ? r.discount_owner : 'admin',
        })),
      };
    }
    const rows = await this.prisma.coupons.findMany({ orderBy: { id: 'desc' } });
    return {
      coupons: rows.map((r) => ({
        ...r,
        id: Number(r.id),
        restaurant_id: r.restaurant_id ? Number(r.restaurant_id) : null,
        min_purchase: Number(r.min_purchase),
        max_discount: Number(r.max_discount),
        discount: Number(r.discount),
        total_uses: r.total_uses ? Number(r.total_uses) : 0,
      })),
    };
  }

  async createCoupon(body: {
    title: string;
    code: string;
    discount: number;
    discount_type?: string;
    min_purchase?: number;
    max_discount?: number;
    start_date?: string;
    expire_date?: string;
    limit?: number;
    coupon_type?: string;
    // Discount ownership (who funds the discount) — drives Pay-Per-Order
    // settlement so the funder's books are charged, never the other party's.
    discount_owner?: string; // 'admin' | 'restaurant' | 'shared'
    admin_discount_amount?: number;       // shared split — admin's contribution
    restaurant_discount_amount?: number;  // shared split — restaurant's contribution
    // Targeting constraints (mirrors Laravel coupon scopes).
    restaurant_id?: number | null;
    zone_id?: number | null;
    customer_id?: number | string | null;
  }) {
    if (!body.title || !body.code || typeof body.discount !== 'number') {
      throw new BadRequestException({
        errors: [{ code: 'body', message: 'title, code, discount required' }],
      });
    }
    if (this.useMongo()) {
      const existing = await this.mongo.findOne<{ mysql_id: number }>('coupons', { code: body.code });
      if (existing) {
        throw new BadRequestException({ errors: [{ code: 'code', message: 'coupon code already exists' }] });
      }
      const now = new Date();
      const mysql_id = await this.mongo.nextMysqlId('coupons');
      await this.mongo.insertOne('coupons', {
        mysql_id,
        title: body.title,
        code: body.code,
        discount: body.discount,
        discount_type: body.discount_type ?? 'percentage',
        min_purchase: body.min_purchase ?? 0,
        max_discount: body.max_discount ?? 0,
        start_date: body.start_date ? new Date(body.start_date) : null,
        expire_date: body.expire_date ? new Date(body.expire_date) : null,
        limit: body.limit ?? null,
        coupon_type: body.coupon_type ?? 'default',
        // Ownership — defaults to admin-funded (platform promo) when unspecified.
        discount_owner: ['admin', 'restaurant', 'shared'].includes(String(body.discount_owner)) ? body.discount_owner : 'admin',
        admin_discount_amount: Number(body.admin_discount_amount ?? 0) || 0,
        restaurant_discount_amount: Number(body.restaurant_discount_amount ?? 0) || 0,
        mysql_restaurant_id: body.restaurant_id ? Number(body.restaurant_id) : null,
        restaurant_id: body.restaurant_id ? Number(body.restaurant_id) : null,
        mysql_zone_id: body.zone_id ? Number(body.zone_id) : null,
        customer_id: body.customer_id !== undefined && body.customer_id !== null && body.customer_id !== '' ? String(body.customer_id) : null,
        status: true,
        created_by: 'admin',
        total_uses: 0,
        created_at: now,
        updated_at: now,
      });
      return { ok: true, id: mysql_id };
    }
    const existing = await this.prisma.coupons.findUnique({ where: { code: body.code } });
    if (existing) {
      throw new BadRequestException({ errors: [{ code: 'code', message: 'coupon code already exists' }] });
    }
    const created = await this.prisma.coupons.create({
      data: {
        title: body.title,
        code: body.code,
        discount: body.discount,
        discount_type: body.discount_type ?? 'percentage',
        min_purchase: body.min_purchase ?? 0,
        max_discount: body.max_discount ?? 0,
        start_date: body.start_date ? new Date(body.start_date) : null,
        expire_date: body.expire_date ? new Date(body.expire_date) : null,
        limit: body.limit ?? null,
        coupon_type: body.coupon_type ?? 'default',
        status: true,
        created_by: 'admin',
      },
    });
    return { ok: true, id: Number(created.id) };
  }

  async updateCoupon(id: number, body: {
    title?: string; discount?: number; discount_type?: string;
    min_purchase?: number; max_discount?: number; start_date?: string;
    expire_date?: string; limit?: number; coupon_type?: string;
    restaurant_id?: number | null; zone_id?: number | null; status?: boolean;
  }) {
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.discount !== undefined) data.discount = Number(body.discount);
    if (body.discount_type !== undefined) data.discount_type = body.discount_type;
    if (body.min_purchase !== undefined) data.min_purchase = Number(body.min_purchase);
    if (body.max_discount !== undefined) data.max_discount = Number(body.max_discount);
    if (body.start_date !== undefined) data.start_date = body.start_date ? new Date(body.start_date) : null;
    if (body.expire_date !== undefined) data.expire_date = body.expire_date ? new Date(body.expire_date) : null;
    if (body.limit !== undefined) data.limit = body.limit !== null ? Number(body.limit) : null;
    if (body.coupon_type !== undefined) data.coupon_type = body.coupon_type;
    if (body.restaurant_id !== undefined) {
      data.mysql_restaurant_id = body.restaurant_id ? Number(body.restaurant_id) : null;
      data.restaurant_id = body.restaurant_id ? Number(body.restaurant_id) : null;
    }
    if (body.zone_id !== undefined) data.mysql_zone_id = body.zone_id ? Number(body.zone_id) : null;
    if (body.status !== undefined) data.status = body.status;
    if (Object.keys(data).length === 0) throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields to update' }] });
    if (this.useMongo()) {
      const c = await this.mongo.findByMysqlId<{ mysql_id: number }>('coupons', id);
      if (!c) throw new NotFoundException({ errors: [{ code: 'coupon', message: 'Coupon not found' }] });
      data.updated_at = new Date();
      await this.mongo.updateOne('coupons', { mysql_id: id }, data);
      return { ok: true, id };
    }
    const c = await this.prisma.coupons.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!c) throw new NotFoundException({ errors: [{ code: 'coupon', message: 'Coupon not found' }] });
    await this.prisma.coupons.update({ where: { id: c.id }, data: data as never });
    return { ok: true, id };
  }

  async updateCouponStatus(id: number, status: boolean) {
    if (this.useMongo()) {
      const c = await this.mongo.findByMysqlId<{ mysql_id: number }>('coupons', id);
      if (!c) throw new NotFoundException({ errors: [{ code: 'coupon', message: 'Coupon not found' }] });
      await this.mongo.updateOne('coupons', { mysql_id: id }, { status, updated_at: new Date() });
      return { ok: true, id, status };
    }
    const c = await this.prisma.coupons.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!c) throw new NotFoundException({ errors: [{ code: 'coupon', message: 'Coupon not found' }] });
    await this.prisma.coupons.update({ where: { id: c.id }, data: { status } });
    return { ok: true, id, status };
  }

  async deleteCoupon(id: number) {
    if (this.useMongo()) {
      const c = await this.mongo.findByMysqlId<{ mysql_id: number }>('coupons', id);
      if (!c) throw new NotFoundException({ errors: [{ code: 'coupon', message: 'Coupon not found' }] });
      await this.mongo.deleteOne('coupons', { mysql_id: id });
      return { ok: true, id };
    }
    const c = await this.prisma.coupons.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!c) throw new NotFoundException({ errors: [{ code: 'coupon', message: 'Coupon not found' }] });
    await this.prisma.coupons.delete({ where: { id: c.id } });
    return { ok: true, id };
  }

  // ── Banners ───────────────────────────────────────────────────────────

  async listBanners() {
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<{
        mysql_id: number; title: string; type: string; image: string | null;
        status?: boolean; data: string;
        zone_id?: number; mysql_zone_id?: number;
        created_at?: Date | null; updated_at?: Date | null;
      }>('banners', {}, { sort: { mysql_id: -1 } });
      return {
        banners: rows.map((r) => ({
          id: r.mysql_id,
          title: r.title,
          type: r.type,
          image: r.image,
          status: r.status ?? true,
          data: r.data,
          zone_id: Number(r.mysql_zone_id ?? r.zone_id ?? 0),
          created_at: r.created_at ?? null,
          updated_at: r.updated_at ?? null,
        })),
      };
    }
    const rows = await this.prisma.banners.findMany({ orderBy: { id: 'desc' } });
    return {
      banners: rows.map((r) => ({ ...r, id: Number(r.id), zone_id: Number(r.zone_id) })),
    };
  }

  async createBanner(body: { title: string; type: string; zone_id: number; data?: string; image?: string | null }) {
    if (!body.title || !body.type || !body.zone_id) {
      throw new BadRequestException({
        errors: [{ code: 'body', message: 'title, type, zone_id required' }],
      });
    }
    if (this.useMongo()) {
      const now = new Date();
      const mysql_id = await this.mongo.nextMysqlId('banners');
      await this.mongo.insertOne('banners', {
        mysql_id,
        title: body.title,
        type: body.type,
        zone_id: body.zone_id,
        mysql_zone_id: body.zone_id,
        data: body.data ?? '',
        image: body.image ?? null,
        status: true,
        created_at: now,
        updated_at: now,
      });
      return { ok: true, id: mysql_id };
    }
    const created = await this.prisma.banners.create({
      data: {
        title: body.title,
        type: body.type,
        zone_id: BigInt(body.zone_id),
        data: body.data ?? '',
        image: body.image ?? null,
      },
    });
    return { ok: true, id: Number(created.id) };
  }

  async updateBanner(id: number, body: { title?: string; type?: string; zone_id?: number; data?: string; image?: string | null; status?: boolean }) {
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.type !== undefined) data.type = body.type;
    if (body.zone_id !== undefined) {
      data.zone_id = Number(body.zone_id);
      data.mysql_zone_id = Number(body.zone_id);
    }
    if (body.data !== undefined) data.data = body.data;
    if (body.image !== undefined && body.image) data.image = body.image;
    if (body.status !== undefined) data.status = body.status;
    if (Object.keys(data).length === 0) throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields to update' }] });
    if (this.useMongo()) {
      const b = await this.mongo.findByMysqlId<{ mysql_id: number }>('banners', id);
      if (!b) throw new NotFoundException({ errors: [{ code: 'banner', message: 'Banner not found' }] });
      data.updated_at = new Date();
      await this.mongo.updateOne('banners', { mysql_id: id }, data);
      return { ok: true, id };
    }
    const b = await this.prisma.banners.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!b) throw new NotFoundException({ errors: [{ code: 'banner', message: 'Banner not found' }] });
    const prismaData = { ...data };
    if (prismaData.zone_id !== undefined) prismaData.zone_id = BigInt(Number(body.zone_id));
    delete (prismaData as { mysql_zone_id?: unknown }).mysql_zone_id;
    await this.prisma.banners.update({ where: { id: b.id }, data: prismaData as never });
    return { ok: true, id };
  }

  async updateBannerStatus(id: number, status: boolean) {
    if (this.useMongo()) {
      const b = await this.mongo.findByMysqlId<{ mysql_id: number }>('banners', id);
      if (!b) throw new NotFoundException({ errors: [{ code: 'banner', message: 'Banner not found' }] });
      await this.mongo.updateOne('banners', { mysql_id: id }, { status, updated_at: new Date() });
      return { ok: true, id, status };
    }
    const b = await this.prisma.banners.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!b) throw new NotFoundException({ errors: [{ code: 'banner', message: 'Banner not found' }] });
    await this.prisma.banners.update({ where: { id: b.id }, data: { status } });
    return { ok: true, id, status };
  }

  async deleteBanner(id: number) {
    if (this.useMongo()) {
      const b = await this.mongo.findByMysqlId<{ mysql_id: number }>('banners', id);
      if (!b) throw new NotFoundException({ errors: [{ code: 'banner', message: 'Banner not found' }] });
      await this.mongo.deleteOne('banners', { mysql_id: id });
      return { ok: true, id };
    }
    const b = await this.prisma.banners.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!b) throw new NotFoundException({ errors: [{ code: 'banner', message: 'Banner not found' }] });
    await this.prisma.banners.delete({ where: { id: b.id } });
    return { ok: true, id };
  }

  // ── Zones ─────────────────────────────────────────────────────────────

  async listZones(zoneFor?: string) {
    if (this.useMongo()) {
      // zone_for distinguishes restaurant vs deliveryman zone setups. Legacy
      // zones (no zone_for) are treated as restaurant zones.
      const filter: Record<string, unknown> = {};
      if (zoneFor === 'restaurant') filter.$or = [{ zone_for: 'restaurant' }, { zone_for: { $exists: false } }, { zone_for: null }];
      else if (zoneFor === 'deliveryman') filter.zone_for = 'deliveryman';
      const rows = await this.mongo.findMany<{
        mysql_id: number; name: string; display_name?: string | null;
        status?: boolean; is_default?: boolean; zone_for?: string | null;
        minimum_shipping_charge?: number | null;
        per_km_shipping_charge?: number | null;
        maximum_shipping_charge?: number | null;
        minimum_delivery_time?: number | null;
        max_cod_order_amount?: number | null;
        created_at?: Date | null;
      }>('zones', filter, {
        sort: { mysql_id: -1 },
        projection: {
          mysql_id: 1, name: 1, display_name: 1, status: 1, is_default: 1, zone_for: 1,
          minimum_shipping_charge: 1, per_km_shipping_charge: 1,
          maximum_shipping_charge: 1, minimum_delivery_time: 1,
          max_cod_order_amount: 1, created_at: 1,
        } as Record<string, 0 | 1>,
      });
      const restaurantCounts = await this.mongo.aggregate<{ _id: number | null; count: number }>(
        'restaurants',
        [{ $group: { _id: '$mysql_zone_id', count: { $sum: 1 } } }],
      );
      const countByZone = new Map(restaurantCounts.map((g) => [String(g._id ?? 'null'), g.count]));
      return {
        zones: rows.map((r) => ({
          id: r.mysql_id,
          name: r.name,
          display_name: r.display_name ?? null,
          status: r.status ?? true,
          is_default: r.is_default ?? false,
          zone_for: r.zone_for ?? 'restaurant',
          minimum_shipping_charge: r.minimum_shipping_charge ?? null,
          per_km_shipping_charge: r.per_km_shipping_charge ?? null,
          maximum_shipping_charge: r.maximum_shipping_charge ?? null,
          minimum_delivery_time: r.minimum_delivery_time ?? null,
          max_cod_order_amount: r.max_cod_order_amount ?? null,
          created_at: r.created_at ?? null,
          restaurant_count: countByZone.get(String(r.mysql_id)) ?? 0,
        })),
      };
    }
    const rows = await this.prisma.zones.findMany({
      orderBy: { id: 'desc' },
      select: {
        id: true,
        name: true,
        display_name: true,
        status: true,
        is_default: true,
        minimum_shipping_charge: true,
        per_km_shipping_charge: true,
        maximum_shipping_charge: true,
        minimum_delivery_time: true,
        max_cod_order_amount: true,
        created_at: true,
      },
    });
    const restaurantCounts = await this.prisma.restaurants.groupBy({
      by: ['zone_id'],
      _count: { _all: true },
    });
    const countByZone = new Map(restaurantCounts.map((g) => [g.zone_id ? String(g.zone_id) : 'null', g._count._all]));
    return {
      zones: rows.map((r) => ({
        ...r,
        id: Number(r.id),
        restaurant_count: countByZone.get(String(r.id)) ?? 0,
      })),
    };
  }

  async updateZoneStatus(id: number, status: boolean) {
    if (this.useMongo()) {
      const z = await this.mongo.findByMysqlId<{ mysql_id: number }>('zones', id);
      if (!z) throw new NotFoundException({ errors: [{ code: 'zone', message: 'Zone not found' }] });
      await this.mongo.updateOne('zones', { mysql_id: id }, { status, updated_at: new Date() });
      return { ok: true, id, status };
    }
    const z = await this.prisma.zones.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!z) throw new NotFoundException({ errors: [{ code: 'zone', message: 'Zone not found' }] });
    await this.prisma.zones.update({ where: { id: z.id }, data: { status } });
    return { ok: true, id, status };
  }

  async createZone(body: {
    name?: string;
    display_name?: string;
    minimum_shipping_charge?: number;
    per_km_shipping_charge?: number;
    maximum_shipping_charge?: number;
    minimum_delivery_time?: number;
    max_cod_order_amount?: number;
    is_default?: boolean;
    coordinates?: Array<{ lat: number; lng: number }>;
    zone_for?: string;
  }) {
    if (!body.name || !body.name.trim()) {
      throw new BadRequestException({ errors: [{ code: 'name', message: 'Zone name is required' }] });
    }
    // Coverage polygon drawn on the admin map (≥3 points). Stored verbatim so
    // the geofence matcher can point-in-polygon test a customer's location.
    const coordinates = Array.isArray(body.coordinates)
      ? body.coordinates
          .filter((p) => p && typeof p.lat === 'number' && typeof p.lng === 'number')
          .map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }))
      : [];
    const payload = {
      name: body.name.trim(),
      display_name: body.display_name?.trim() || body.name.trim(),
      coordinates,
      status: true,
      is_default: body.is_default ?? false,
      zone_for: body.zone_for === 'deliveryman' ? 'deliveryman' : 'restaurant',
      minimum_shipping_charge: Number(body.minimum_shipping_charge ?? 0),
      per_km_shipping_charge: Number(body.per_km_shipping_charge ?? 0),
      maximum_shipping_charge: Number(body.maximum_shipping_charge ?? 0),
      minimum_delivery_time: Number(body.minimum_delivery_time ?? 0),
      max_cod_order_amount: Number(body.max_cod_order_amount ?? 0),
    };

    if (this.useMongo()) {
      const nextId = await this.mongo.nextMysqlId('zones');
      const now = new Date();
      await this.mongo.insertOne('zones', {
        ...payload,
        mysql_id: nextId,
        created_at: now,
        updated_at: now,
      });
      return { ok: true, id: nextId, name: payload.name };
    }
    throw new BadRequestException({
      errors: [{ code: 'config', message: 'Zone creation requires USE_MONGO_ADMIN=1 (MySQL path is read-only).' }],
    });
  }

  /** Full zone record (incl. coverage polygon) for the edit form. */
  async getZone(id: number) {
    if (this.useMongo()) {
      const z = await this.mongo.findByMysqlId<Record<string, unknown>>('zones', id);
      if (!z) throw new NotFoundException({ errors: [{ code: 'zone', message: 'Zone not found' }] });
      return {
        zone: {
          id: Number(z.mysql_id),
          name: (z.name as string) ?? null,
          display_name: (z.display_name as string) ?? null,
          coordinates: Array.isArray(z.coordinates) ? z.coordinates : [],
          status: (z.status as boolean) ?? true,
          is_default: (z.is_default as boolean) ?? false,
          zone_for: (z.zone_for as string) ?? 'restaurant',
          minimum_shipping_charge: Number(z.minimum_shipping_charge ?? 0),
          per_km_shipping_charge: Number(z.per_km_shipping_charge ?? 0),
          maximum_shipping_charge: Number(z.maximum_shipping_charge ?? 0),
          minimum_delivery_time: Number(z.minimum_delivery_time ?? 0),
          max_cod_order_amount: Number(z.max_cod_order_amount ?? 0),
        },
      };
    }
    throw new BadRequestException({ errors: [{ code: 'config', message: 'Zone edit requires USE_MONGO_ADMIN=1.' }] });
  }

  /** Edit a zone's name / charges / coverage polygon. Mirrors Laravel's
   *  ZoneController::update — only the fields actually sent are changed. */
  async updateZone(id: number, body: {
    name?: string; display_name?: string;
    minimum_shipping_charge?: number; per_km_shipping_charge?: number;
    maximum_shipping_charge?: number; minimum_delivery_time?: number;
    max_cod_order_amount?: number; is_default?: boolean;
    coordinates?: Array<{ lat: number; lng: number }>; zone_for?: string;
  }) {
    if (!this.useMongo()) throw new BadRequestException({ errors: [{ code: 'config', message: 'Zone edit requires USE_MONGO_ADMIN=1.' }] });
    const z = await this.mongo.findByMysqlId<{ mysql_id: number }>('zones', id);
    if (!z) throw new NotFoundException({ errors: [{ code: 'zone', message: 'Zone not found' }] });

    const data: Record<string, unknown> = {};
    if (body.name !== undefined && body.name.trim()) data.name = body.name.trim();
    if (body.display_name !== undefined) data.display_name = body.display_name.trim() || (data.name as string | undefined);
    if (body.minimum_shipping_charge !== undefined) data.minimum_shipping_charge = Number(body.minimum_shipping_charge);
    if (body.per_km_shipping_charge !== undefined) data.per_km_shipping_charge = Number(body.per_km_shipping_charge);
    if (body.maximum_shipping_charge !== undefined) data.maximum_shipping_charge = Number(body.maximum_shipping_charge);
    if (body.minimum_delivery_time !== undefined) data.minimum_delivery_time = Number(body.minimum_delivery_time);
    if (body.max_cod_order_amount !== undefined) data.max_cod_order_amount = Number(body.max_cod_order_amount);
    if (body.is_default !== undefined) data.is_default = !!body.is_default;
    if (body.zone_for !== undefined) data.zone_for = body.zone_for === 'deliveryman' ? 'deliveryman' : 'restaurant';
    if (Array.isArray(body.coordinates)) {
      data.coordinates = body.coordinates
        .filter((p) => p && typeof p.lat === 'number' && typeof p.lng === 'number')
        .map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }));
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields to update' }] });
    }
    data.updated_at = new Date();
    await this.mongo.updateOne('zones', { mysql_id: id }, data);
    return { ok: true, id };
  }

  // ── Create restaurant / food / delivery-man (admin Add forms) ────────

  async createRestaurant(body: {
    name?: string; email?: string; phone?: string; restaurant_phone?: string; address?: string;
    minimum_order?: number; zone_id?: number; vendor_id?: number;
    delivery?: boolean; take_away?: boolean;
    // Owner / vendor account (mirrors Laravel's VendorController::store —
    // restaurant + vendor are created together, with a login password).
    f_name?: string; l_name?: string; password?: string;
    // Location + logistics + branding.
    latitude?: string | number; longitude?: string | number;
    minimum_delivery_time?: number; maximum_delivery_time?: number;
    delivery_time_type?: string;
    tax?: number; comission?: number;
    logo?: string; cover_photo?: string;
    cuisine_ids?: number[] | string;
    restaurant_model?: string;
    veg?: boolean; non_veg?: boolean;
    documents?: string[];
    // Per-locale name translations: [{ locale, key:'name', value }]
    translations?: Array<{ locale?: string; key?: string; value?: string }>;
    // Per-locale address translations: [{ locale, key:'address', value }]
    address_translations?: Array<{ locale?: string; key?: string; value?: string }>;
    // Additional data (mirrors StackFood's Add Restaurant form).
    identity_number?: string;
    state?: string;
    license_document?: string;
    // Per-category document uploads from the Add Restaurant form arrive as
    // `doc_cat_<categoryId>: filename` keys (configured in Document master).
    [key: string]: unknown;
  }) {
    if (!body.name) throw new BadRequestException({ errors: [{ code: 'name', message: 'Restaurant name is required' }] });
    if (!this.useMongo()) throw new BadRequestException({ errors: [{ code: 'config', message: 'Mongo required' }] });
    const now = new Date();

    // ── Vendor account ────────────────────────────────────────────────
    // If owner details are supplied, create the vendor (with a hashed,
    // Laravel-compatible $2y$ password) and link the restaurant to it. When
    // no owner info is given (e.g. bulk import), fall back to vendor_id.
    let vendorId = body.vendor_id ?? null;
    if (body.f_name || body.password) {
      if (body.email) {
        const dupEmail = await this.mongo.findOne<{ mysql_id: number }>('vendors', { email: body.email });
        if (dupEmail) throw new BadRequestException({ errors: [{ code: 'email', message: 'A vendor with this email already exists' }] });
      }
      if (body.phone) {
        const dupPhone = await this.mongo.findOne<{ mysql_id: number }>('vendors', { phone: body.phone });
        if (dupPhone) throw new BadRequestException({ errors: [{ code: 'phone', message: 'A vendor with this phone already exists' }] });
      }
      const passwordHash = (await bcrypt.hash(body.password ?? '12345678', 10)).replace(/^\$2b\$/, '$2y$');
      vendorId = await this.mongo.nextMysqlId('vendors');
      await this.mongo.insertOne('vendors', {
        mysql_id: vendorId,
        f_name: body.f_name ?? body.name,
        l_name: body.l_name ?? '',
        email: body.email ?? null,
        phone: body.phone ?? null,
        password: passwordHash,
        image: null,
        status: true,
        created_at: now,
        updated_at: now,
      });
    }

    // Normalise cuisine ids (the form sends an array; bulk sends nothing).
    let cuisineIds: number[] = [];
    if (Array.isArray(body.cuisine_ids)) cuisineIds = body.cuisine_ids.map(Number).filter(Number.isFinite);
    else if (typeof body.cuisine_ids === 'string' && body.cuisine_ids.trim()) {
      cuisineIds = body.cuisine_ids.split(',').map((s) => Number(s.trim())).filter(Number.isFinite);
    }

    // Laravel stores delivery_time as "min-max-type" (e.g. "10-30-min").
    const deliveryTime = body.minimum_delivery_time !== undefined && body.maximum_delivery_time !== undefined
      ? `${body.minimum_delivery_time}-${body.maximum_delivery_time}-${body.delivery_time_type ?? 'min'}`
      : null;

    // Multi-language: persist the translations array and prefer the English
    // (or default) value for the canonical name column.
    const nameTranslations = Array.isArray(body.translations) ? body.translations : [];
    const addressTranslations = Array.isArray(body.address_translations) ? body.address_translations : [];
    const translations = [...nameTranslations, ...addressTranslations];
    // Only an explicit English/default translation overrides the canonical
    // field — a Hindi-only entry must not replace the English value.
    const trName = nameTranslations.find((t) => (t.locale === 'en' || t.locale === 'default') && t.key === 'name')?.value;
    const trAddress = addressTranslations.find((t) => (t.locale === 'en' || t.locale === 'default') && t.key === 'address')?.value;

    // Per-category document uploads (Document master): keys look like
    // `doc_cat_<categoryId>: "<filename>"`. Keep the category link AND fold the
    // files into the flat additional_documents list (used by the detail view).
    const categoryDocs = Object.entries(body)
      .filter(([k, v]) => /^doc_cat_\d+$/.test(k) && typeof v === 'string' && v)
      .map(([k, v]) => ({ category_id: Number(k.slice('doc_cat_'.length)), file: v as string }));
    const flatDocs = [
      ...(Array.isArray(body.documents) ? body.documents : []),
      ...categoryDocs.map((d) => d.file),
    ];

    const nextId = await this.mongo.nextMysqlId('restaurants');
    await this.mongo.insertOne('restaurants', {
      mysql_id: nextId,
      name: trName ?? body.name,
      translations,
      additional_documents: flatDocs,
      restaurant_documents: categoryDocs,
      // Additional data — StackFood's id number / state / license document.
      identity_number: body.identity_number ?? null,
      state: body.state ?? null,
      license_document: body.license_document ?? null,
      email: body.email ?? null,
      // Restaurant's own contact number (falls back to the owner's phone).
      phone: body.restaurant_phone ?? body.phone ?? null,
      address: trAddress ?? body.address ?? null,
      latitude: body.latitude !== undefined && String(body.latitude) !== '' ? String(body.latitude) : null,
      longitude: body.longitude !== undefined && String(body.longitude) !== '' ? String(body.longitude) : null,
      minimum_order: Number(body.minimum_order ?? 100),
      tax: Number(body.tax ?? 0),
      comission: body.comission !== undefined ? Number(body.comission) : null,
      delivery_time: deliveryTime,
      restaurant_model: body.restaurant_model ?? null,
      mysql_zone_id: body.zone_id ?? 1,
      zone_id: body.zone_id ?? 1,
      mysql_vendor_id: vendorId,
      cuisine_ids: cuisineIds,
      delivery: body.delivery ?? true,
      take_away: body.take_away ?? true,
      veg: body.veg ?? true,
      non_veg: body.non_veg ?? true,
      status: true,
      active: false,
      approval_status: 'approved',
      logo: body.logo ?? null,
      cover_photo: body.cover_photo ?? null,
      created_at: now,
      updated_at: now,
    });
    return { ok: true, id: nextId, name: body.name, vendor_id: vendorId };
  }

  async createDeliveryMan(body: {
    f_name?: string; l_name?: string; email?: string; phone?: string;
    password?: string; zone_id?: number; vehicle_id?: number;
    // Extended fields (mirrors StackFood's Add Delivery Man form).
    image?: string; dm_type?: string; shift_id?: number | null;
    age?: number; dob?: string;
    identity_type?: string; identity_number?: string;
    identity_image?: string[] | string; license_image?: string;
  }) {
    if (!body.f_name || !body.phone) {
      throw new BadRequestException({ errors: [{ code: 'input', message: 'First name + phone required' }] });
    }
    if (!this.useMongo()) throw new BadRequestException({ errors: [{ code: 'config', message: 'Mongo required' }] });
    // Hash the password using the same scheme the SeedService uses (Laravel
    // $2y$ prefix) so the existing login flow can verify it.
    const bcrypt = await import('bcrypt');
    const rawPw = body.password ?? '12345678';
    const hash = (await bcrypt.hash(rawPw, 10)).replace(/^\$2b\$/, '$2y$');
    const nextId = await this.mongo.nextMysqlId('delivery_men');
    const now = new Date();
    const identityImages = Array.isArray(body.identity_image)
      ? body.identity_image
      : (body.identity_image ? [body.identity_image] : []);
    await this.mongo.insertOne('delivery_men', {
      mysql_id: nextId,
      f_name: body.f_name,
      l_name: body.l_name ?? '',
      email: body.email ?? null,
      phone: body.phone,
      password: hash,
      image: body.image ?? 'def.png',
      mysql_zone_id: body.zone_id ?? 1,
      vehicle_id: body.vehicle_id ?? 1,
      // Delivery man type: freelancer / salary_based / restaurant_wise.
      type: body.dm_type ?? 'freelancer',
      earning: body.dm_type === 'freelancer',
      shift_id: body.shift_id ? Number(body.shift_id) : null,
      // Additional data.
      age: body.age !== undefined && body.age !== null ? Number(body.age) : null,
      dob: body.dob ? new Date(body.dob) : null,
      // Documentation.
      identity_type: body.identity_type ?? null,
      identity_number: body.identity_number ?? null,
      identity_image: identityImages,
      license_image: body.license_image ?? null,
      application_status: 'approved',
      status: true,
      active: 0,
      created_at: now,
      updated_at: now,
    });
    return { ok: true, id: nextId, name: `${body.f_name} ${body.l_name ?? ''}`.trim() };
  }

  async createFood(body: FoodWriteBody) {
    if (!body.name || !body.price || !body.restaurant_id) {
      throw new BadRequestException({ errors: [{ code: 'input', message: 'name, price, and restaurant_id are required' }] });
    }
    if (!this.useMongo()) throw new BadRequestException({ errors: [{ code: 'config', message: 'Mongo required' }] });
    const nextId = await this.mongo.nextMysqlId('foods');
    const now = new Date();
    const addonIds = this.normaliseIdArray(body.addon_ids);
    // Multi-language: persist the translations array (name + description); an
    // explicit English/default entry overrides the canonical column.
    const nameTr = Array.isArray(body.translations) ? body.translations : [];
    const descTr = Array.isArray(body.description_translations) ? body.description_translations : [];
    const translations = [...nameTr, ...descTr];
    const trName = nameTr.find((t) => (t.locale === 'en' || t.locale === 'default') && t.key === 'name')?.value;
    const trDesc = descTr.find((t) => (t.locale === 'en' || t.locale === 'default') && t.key === 'description')?.value;
    await this.mongo.insertOne('foods', {
      mysql_id: nextId,
      name: trName ?? body.name,
      description: trDesc ?? body.description ?? '',
      translations,
      price: Number(body.price),
      tax: Number(body.tax ?? 0),
      tax_type: body.tax_type ?? 'percent',
      discount: Number(body.discount ?? 0),
      discount_type: body.discount_type ?? 'percent',
      mysql_restaurant_id: Number(body.restaurant_id),
      mysql_category_id: Number(body.category_id ?? 1),
      category_id: Number(body.category_id ?? 1),
      mysql_sub_category_id: body.sub_category_id !== undefined && body.sub_category_id !== null ? Number(body.sub_category_id) : null,
      veg: vegToBool(body.veg),
      is_halal: !!body.is_halal,
      recommended: !!body.recommended,
      stock_type: body.stock_type ?? 'unlimited',
      item_stock: Number(body.item_stock ?? 0),
      sell_count: 0,
      maximum_cart_quantity: body.maximum_cart_quantity !== undefined && body.maximum_cart_quantity !== null ? Number(body.maximum_cart_quantity) : null,
      available_time_starts: body.available_time_starts ?? '00:00',
      available_time_ends: body.available_time_ends ?? '23:59',
      addon_ids: addonIds,
      add_ons: addonIds,
      variations: Array.isArray(body.variations) ? body.variations : [],
      avg_rating: 0,
      rating_count: 0,
      meta_title: body.meta_title ?? null,
      meta_description: body.meta_description ?? null,
      meta_image: body.meta_image ?? null,
      status: true,
      // Admin-added foods are auto-approved (vendor-added ones await approval).
      request_status: 'approved',
      image: body.image ?? null,
      created_at: now,
      updated_at: now,
    });
    return { ok: true, id: nextId, name: body.name };
  }

  /** Full edit of a food item from the admin panel — mirrors Laravel's
   *  FoodController::update. Only the fields actually sent are changed. */
  async updateFood(id: number, body: FoodWriteBody) {
    if (!this.useMongo()) throw new BadRequestException({ errors: [{ code: 'config', message: 'Mongo required' }] });
    const existing = await this.mongo.findByMysqlId<{ mysql_id: number }>('foods', id);
    if (!existing) throw new NotFoundException({ errors: [{ code: 'food', message: 'Food not found' }] });

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.price !== undefined) data.price = Number(body.price);
    if (body.tax !== undefined) data.tax = Number(body.tax);
    if (body.tax_type !== undefined) data.tax_type = body.tax_type;
    if (body.discount !== undefined) data.discount = Number(body.discount);
    if (body.discount_type !== undefined) data.discount_type = body.discount_type;
    if (body.restaurant_id !== undefined) data.mysql_restaurant_id = Number(body.restaurant_id);
    if (body.category_id !== undefined) {
      data.mysql_category_id = Number(body.category_id);
      data.category_id = Number(body.category_id);
    }
    if (body.sub_category_id !== undefined) data.mysql_sub_category_id = body.sub_category_id !== null ? Number(body.sub_category_id) : null;
    if (body.veg !== undefined) data.veg = vegToBool(body.veg);
    if (body.is_halal !== undefined) data.is_halal = !!body.is_halal;
    if (body.recommended !== undefined) data.recommended = !!body.recommended;
    if (body.stock_type !== undefined) data.stock_type = body.stock_type;
    if (body.item_stock !== undefined) data.item_stock = Number(body.item_stock);
    if (body.maximum_cart_quantity !== undefined) data.maximum_cart_quantity = body.maximum_cart_quantity !== null ? Number(body.maximum_cart_quantity) : null;
    if (body.available_time_starts !== undefined) data.available_time_starts = body.available_time_starts;
    if (body.available_time_ends !== undefined) data.available_time_ends = body.available_time_ends;
    if (body.addon_ids !== undefined) {
      const ids = this.normaliseIdArray(body.addon_ids);
      data.addon_ids = ids;
      data.add_ons = ids;
    }
    if (body.variations !== undefined) data.variations = Array.isArray(body.variations) ? body.variations : [];
    if (body.image !== undefined && body.image) data.image = body.image;
    if (body.meta_title !== undefined) data.meta_title = body.meta_title;
    if (body.meta_description !== undefined) data.meta_description = body.meta_description;
    if (body.meta_image !== undefined && body.meta_image) data.meta_image = body.meta_image;
    if (body.translations !== undefined || body.description_translations !== undefined) {
      const nameTr = Array.isArray(body.translations) ? body.translations : [];
      const descTr = Array.isArray(body.description_translations) ? body.description_translations : [];
      data.translations = [...nameTr, ...descTr];
      const trName = nameTr.find((t) => (t.locale === 'en' || t.locale === 'default') && t.key === 'name')?.value;
      const trDesc = descTr.find((t) => (t.locale === 'en' || t.locale === 'default') && t.key === 'description')?.value;
      if (trName !== undefined) data.name = trName;
      if (trDesc !== undefined) data.description = trDesc;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields to update' }] });
    }
    data.updated_at = new Date();
    await this.mongo.updateOne('foods', { mysql_id: id }, data);
    return { ok: true, id };
  }

  /** Coerce a number[] / "1,2,3" string into a clean number[]. */
  private normaliseIdArray(input: number[] | string | undefined): number[] {
    if (Array.isArray(input)) return input.map(Number).filter(Number.isFinite);
    if (typeof input === 'string' && input.trim()) {
      return input.split(',').map((s) => Number(s.trim())).filter(Number.isFinite);
    }
    return [];
  }

  /** Place a POS order on behalf of a restaurant (admin walk-in / phone order).
   *  Mirrors Laravel's POSController::placeOrder — creates the order plus its
   *  line items so it shows up in the orders list + detail like any order. */
  async createPosOrder(
    body: {
      restaurant_id?: number;
      items?: Array<{ food_id?: number; name?: string; price?: number; quantity?: number; add_ons?: Array<{ id?: number; name?: string; price?: number }> }>;
      customer_name?: string;
      customer_phone?: string;
      address?: string;
      order_type?: string;
      table_number?: string | number;
      payment_method?: string;
      discount?: number;
      tax_percent?: number;
      delivery_charge?: number;
      additional_charge?: number;
      extra_packaging_amount?: number;
      order_note?: string;
    },
    createdBy?: { kind: string; id: number },
  ) {
    if (!body.restaurant_id) throw new BadRequestException({ errors: [{ code: 'restaurant_id', message: 'restaurant is required' }] });
    const items = (body.items ?? []).filter((i) => i.food_id && (i.quantity ?? 0) > 0);
    if (items.length === 0) throw new BadRequestException({ errors: [{ code: 'items', message: 'add at least one item' }] });
    if (!this.useMongo()) throw new BadRequestException({ errors: [{ code: 'config', message: 'Mongo required' }] });

    // POS supports exactly three order types. Delivery keeps the existing
    // delivery flow (DM is assigned later via the existing dispatch endpoint);
    // Take Away and Dine In never get a delivery man.
    const orderType = body.order_type ?? 'take_away';
    if (!['take_away', 'dine_in', 'delivery'].includes(orderType)) {
      throw new BadRequestException({ errors: [{ code: 'order_type', message: 'order_type must be take_away, dine_in or delivery' }] });
    }
    // Table number is mandatory for Dine In and MUST be null for the others.
    let tableNumber: string | null = null;
    if (orderType === 'dine_in') {
      const tn = body.table_number === undefined || body.table_number === null ? '' : String(body.table_number).trim();
      if (!tn) throw new BadRequestException({ errors: [{ code: 'table_number', message: 'table number is required for dine in' }] });
      tableNumber = tn;
    }

    const restaurant = await this.mongo.findByMysqlId<{ mysql_id: number; tax?: number }>('restaurants', Number(body.restaurant_id));
    if (!restaurant) throw new NotFoundException({ errors: [{ code: 'restaurant', message: 'Restaurant not found' }] });

    // Per-item add-on total (sum of selected add-on prices), applied per unit.
    const addOnSum = (it: { add_ons?: Array<{ price?: number }> }) =>
      (it.add_ons ?? []).reduce((s, a) => s + Math.max(0, Number(a.price ?? 0)), 0);
    const subtotal = items.reduce((s, i) => s + (Number(i.price ?? 0) + addOnSum(i)) * Number(i.quantity ?? 0), 0);
    const discount = Number(body.discount ?? 0);
    const taxPercent = body.tax_percent !== undefined ? Number(body.tax_percent) : Number(restaurant.tax ?? 0);
    const taxable = Math.max(0, subtotal - discount);
    const taxAmount = taxable * (taxPercent / 100);
    const deliveryCharge = Number(body.delivery_charge ?? 0);
    // Platform additional charges + restaurant extra-packaging, as configured.
    const additionalCharge = Math.max(0, Number(body.additional_charge ?? 0));
    const extraPackaging = Math.max(0, Number(body.extra_packaging_amount ?? 0));
    const orderAmount = taxable + taxAmount + deliveryCharge + additionalCharge + extraPackaging;

    const now = new Date();
    const orderId = await this.mongo.nextMysqlId('orders');
    await this.mongo.insertOne('orders', {
      mysql_id: orderId,
      mysql_user_id: null,
      mysql_restaurant_id: Number(body.restaurant_id),
      // No delivery man at creation. For `delivery` orders one is assigned later
      // through the existing dispatch endpoint; Take Away / Dine In never get one.
      mysql_delivery_man_id: null,
      order_amount: orderAmount,
      total_tax_amount: taxAmount,
      restaurant_discount_amount: discount,
      delivery_charge: deliveryCharge,
      additional_charge: additionalCharge,
      extra_packaging_amount: extraPackaging,
      payment_status: 'paid',
      order_status: 'confirmed',
      payment_method: body.payment_method ?? 'cash',
      order_type: orderType,
      table_number: tableNumber, // null for take_away & delivery
      created_by: createdBy?.id ?? null,
      created_by_type: createdBy?.kind ?? null,
      order_note: body.order_note ?? null,
      delivery_address: body.address ?? null,
      contact_person_name: body.customer_name ?? 'Walk-in customer',
      contact_person_number: body.customer_phone ?? null,
      pending: now,
      confirmed: now,
      created_at: now,
      created_at_legacy: now,
      updated_at: now,
    });

    // Line items — getOrder() reads these from `order_details` by order_id.
    for (const it of items) {
      const detailId = await this.mongo.nextMysqlId('order_details');
      await this.mongo.insertOne('order_details', {
        mysql_id: detailId,
        order_id: orderId,
        food_id: Number(it.food_id),
        price: Number(it.price ?? 0),
        quantity: Number(it.quantity ?? 0),
        tax_amount: 0,
        total_add_on_price: Number((addOnSum(it) * Number(it.quantity ?? 0)).toFixed(2)),
        add_ons: (it.add_ons ?? []).map((a) => ({ id: a.id ?? null, name: a.name ?? null, price: Math.max(0, Number(a.price ?? 0)) })),
        food_details: JSON.stringify({ name: it.name ?? null, add_ons: (it.add_ons ?? []).map((a) => a.name).filter(Boolean) }),
        created_at: now,
        updated_at: now,
      });
    }

    return { ok: true, id: orderId, order_amount: orderAmount };
  }

  // ── Bulk import / export ─────────────────────────────────────────────

  async bulkImportRestaurants(rows: Array<Record<string, unknown>>) {
    if (!this.useMongo()) throw new BadRequestException({ errors: [{ code: 'config', message: 'Mongo required' }] });
    let inserted = 0; let failed = 0;
    for (const r of rows) {
      try {
        const name = typeof r.name === 'string' ? r.name : null;
        if (!name) { failed++; continue; }
        await this.createRestaurant({
          name,
          email: typeof r.email === 'string' ? r.email : undefined,
          phone: typeof r.phone === 'string' ? r.phone : undefined,
          address: typeof r.address === 'string' ? r.address : undefined,
          zone_id: typeof r.zone_id === 'number' ? r.zone_id : 1,
          minimum_order: typeof r.minimum_order === 'number' ? r.minimum_order : 100,
        });
        inserted++;
      } catch { failed++; }
    }
    return { ok: true, inserted, failed, total: rows.length };
  }

  async bulkExportRestaurants() {
    if (!this.useMongo()) return { rows: [], total: 0 };
    const rows = await this.mongo.findMany<{
      mysql_id: number; name?: string; email?: string; phone?: string;
      address?: string; minimum_order?: number; mysql_zone_id?: number;
      status?: boolean | number;
    }>('restaurants', {}, { limit: 5000 });
    return {
      total: rows.length,
      rows: rows.map((r) => ({
        id: r.mysql_id,
        name: r.name ?? '',
        email: r.email ?? '',
        phone: r.phone ?? '',
        address: r.address ?? '',
        minimum_order: r.minimum_order ?? 0,
        zone_id: r.mysql_zone_id ?? '',
        status: r.status === true || r.status === 1 ? 'active' : 'inactive',
      })),
    };
  }

  async bulkImportFood(rows: Array<Record<string, unknown>>) {
    if (!this.useMongo()) throw new BadRequestException({ errors: [{ code: 'config', message: 'Mongo required' }] });
    let inserted = 0; let failed = 0;
    for (const r of rows) {
      try {
        const name = typeof r.name === 'string' ? r.name : null;
        const price = typeof r.price === 'number' ? r.price : parseFloat(String(r.price));
        const restaurantId = typeof r.restaurant_id === 'number' ? r.restaurant_id : parseInt(String(r.restaurant_id), 10);
        if (!name || !Number.isFinite(price) || !Number.isFinite(restaurantId)) { failed++; continue; }
        await this.createFood({
          name, price, restaurant_id: restaurantId,
          description: typeof r.description === 'string' ? r.description : undefined,
          category_id: typeof r.category_id === 'number' ? r.category_id : undefined,
          discount: typeof r.discount === 'number' ? r.discount : undefined,
          tax: typeof r.tax === 'number' ? r.tax : undefined,
          veg: typeof r.veg === 'boolean' ? r.veg : undefined,
        });
        inserted++;
      } catch { failed++; }
    }
    return { ok: true, inserted, failed, total: rows.length };
  }

  async bulkExportFood() {
    if (!this.useMongo()) return { rows: [], total: 0 };
    const rows = await this.mongo.findMany<{
      mysql_id: number; name?: string; description?: string;
      price?: number; tax?: number; discount?: number;
      mysql_restaurant_id?: number; mysql_category_id?: number;
      status?: boolean | number;
    }>('foods', {}, { limit: 5000 });
    return {
      total: rows.length,
      rows: rows.map((r) => ({
        id: r.mysql_id,
        name: r.name ?? '',
        description: r.description ?? '',
        price: r.price ?? 0,
        tax: r.tax ?? 0,
        discount: r.discount ?? 0,
        restaurant_id: r.mysql_restaurant_id ?? '',
        category_id: r.mysql_category_id ?? '',
        status: r.status === true || r.status === 1 ? 'active' : 'inactive',
      })),
    };
  }

  // ── Newsletter subscribers ────────────────────────────────────────────

  async listNewsletterSubscribers(limit: number) {
    if (!this.useMongo()) return { total: 0, items: [] };
    const rows = await this.mongo.findMany<{
      mysql_id: number; email: string; source?: string | null;
      status?: string | null; created_at?: Date | null;
    }>('newsletter_subscribers', {}, { sort: { mysql_id: -1 }, limit });
    const total = await this.mongo.count('newsletter_subscribers', {});
    return {
      total,
      items: rows.map((r) => ({
        id: r.mysql_id,
        email: r.email,
        source: r.source ?? 'footer',
        status: r.status ?? 'active',
        created_at: r.created_at ?? null,
      })),
    };
  }

  async deleteNewsletterSubscriber(id: number) {
    if (!this.useMongo()) {
      throw new BadRequestException({ errors: [{ code: 'config', message: 'Newsletter ops require Mongo' }] });
    }
    const found = await this.mongo.findByMysqlId<{ mysql_id: number }>('newsletter_subscribers', id);
    if (!found) throw new NotFoundException({ errors: [{ code: 'subscriber', message: 'Subscriber not found' }] });
    await this.mongo.deleteOne('newsletter_subscribers', { mysql_id: id });
    return { ok: true, id };
  }

  // ── Restaurant joining requests ──────────────────────────────────────

  async listPendingRestaurants() {
    if (!this.useMongo()) return { items: [], total: 0 };
    // Pending = restaurants with `status=false` OR no `approved_at` timestamp.
    // The seed treats status=true as approved/live; new signups should be
    // inserted with status=false until admin verifies docs.
    const rows = await this.mongo.findMany<{
      mysql_id: number; name?: string | null; phone?: string | null;
      email?: string | null; address?: string | null;
      logo?: string | null; mysql_vendor_id?: number | null;
      created_at?: Date | null; approval_status?: string | null;
    }>('restaurants',
      { $or: [
        { approval_status: 'pending' },
        { status: false, approval_status: { $exists: false } },
      ] },
      { sort: { mysql_id: -1 }, limit: 100 },
    );
    return {
      total: rows.length,
      items: rows.map((r) => ({
        id: r.mysql_id,
        name: r.name ?? '—',
        email: r.email ?? null,
        phone: r.phone ?? null,
        address: r.address ?? null,
        vendor_id: r.mysql_vendor_id ?? null,
        submitted_at: r.created_at ?? null,
        status: r.approval_status ?? 'pending',
      })),
    };
  }

  async updateRestaurantApproval(id: number, decision: 'approved' | 'rejected', reason?: string) {
    if (!this.useMongo()) {
      throw new BadRequestException({ errors: [{ code: 'config', message: 'Restaurant approval requires Mongo' }] });
    }
    const r = await this.mongo.findByMysqlId<{ mysql_id: number }>('restaurants', id);
    if (!r) throw new NotFoundException({ errors: [{ code: 'restaurant', message: 'Restaurant not found' }] });
    await this.mongo.updateOne('restaurants', { mysql_id: id }, {
      approval_status: decision,
      status: decision === 'approved',
      rejection_reason: decision === 'rejected' ? (reason ?? null) : null,
      approved_at: decision === 'approved' ? new Date() : null,
      updated_at: new Date(),
    });
    return { ok: true, id, decision };
  }

  // ── Delivery man joining requests ────────────────────────────────────

  async listPendingDeliveryMen() {
    if (!this.useMongo()) return { items: [], total: 0 };
    const rows = await this.mongo.findMany<{
      mysql_id: number; f_name?: string | null; l_name?: string | null;
      phone?: string | null; email?: string | null;
      application_status?: string | null; vehicle_id?: number | null;
      mysql_zone_id?: number | null; created_at?: Date | null;
    }>('delivery_men',
      { $or: [
        { application_status: 'pending' },
        { application_status: { $exists: false } },
      ] },
      { sort: { mysql_id: -1 }, limit: 100 },
    );
    return {
      total: rows.length,
      items: rows.map((r) => ({
        id: r.mysql_id,
        name: `${r.f_name ?? ''} ${r.l_name ?? ''}`.trim() || '—',
        email: r.email ?? null,
        phone: r.phone ?? null,
        zone_id: r.mysql_zone_id ?? null,
        vehicle_id: r.vehicle_id ?? null,
        submitted_at: r.created_at ?? null,
        status: r.application_status ?? 'pending',
      })),
    };
  }

  /** Delivery men whose application was denied/rejected — for the admin
   *  "Denied Deliveryman" tab. Matches both wordings the codebase produces
   *  ('rejected' from the reject button, 'denied' from the approval endpoint). */
  async listDeniedDeliveryMen() {
    if (!this.useMongo()) return { items: [], total: 0 };
    const rows = await this.mongo.findMany<{
      mysql_id: number; f_name?: string | null; l_name?: string | null;
      phone?: string | null; email?: string | null;
      application_status?: string | null; vehicle_id?: number | null;
      mysql_zone_id?: number | null; type?: string | null;
      rejection_reason?: string | null; created_at?: Date | null; updated_at?: Date | null;
    }>('delivery_men',
      { application_status: { $in: ['denied', 'rejected'] } },
      { sort: { mysql_id: -1 }, limit: 200 },
    );
    return {
      total: rows.length,
      items: rows.map((r) => ({
        id: r.mysql_id,
        name: `${r.f_name ?? ''} ${r.l_name ?? ''}`.trim() || '—',
        email: r.email ?? null,
        phone: r.phone ?? null,
        zone_id: r.mysql_zone_id ?? null,
        vehicle_id: r.vehicle_id ?? null,
        job_type: r.type ?? null,
        reason: r.rejection_reason ?? null,
        denied_at: r.updated_at ?? r.created_at ?? null,
        status: r.application_status ?? 'denied',
      })),
    };
  }

  async updateDeliveryManApproval(id: number, decision: 'approved' | 'rejected', reason?: string) {
    if (!this.useMongo()) {
      throw new BadRequestException({ errors: [{ code: 'config', message: 'DM approval requires Mongo' }] });
    }
    const dm = await this.mongo.findByMysqlId<{ mysql_id: number }>('delivery_men', id);
    if (!dm) throw new NotFoundException({ errors: [{ code: 'delivery_man', message: 'Delivery man not found' }] });
    await this.mongo.updateOne('delivery_men', { mysql_id: id }, {
      application_status: decision,
      status: decision === 'approved',
      rejection_reason: decision === 'rejected' ? (reason ?? null) : null,
      approved_at: decision === 'approved' ? new Date() : null,
      updated_at: new Date(),
    });
    return { ok: true, id, decision };
  }

  // ── Customer wallet — admin add fund ─────────────────────────────────

  async addCustomerWalletFund(body: { user_id?: number; amount?: number; reason?: string }) {
    if (!body.user_id || !body.amount) {
      throw new BadRequestException({
        errors: [{ code: 'input', message: 'user_id and amount are required' }],
      });
    }
    if (body.amount <= 0) {
      throw new BadRequestException({
        errors: [{ code: 'amount', message: 'Amount must be positive' }],
      });
    }
    if (!this.useMongo()) {
      throw new BadRequestException({ errors: [{ code: 'config', message: 'Customer wallet ops require Mongo' }] });
    }

    const userId = Number(body.user_id);
    const user = await this.mongo.findByMysqlId<{ mysql_id: number; f_name?: string | null; l_name?: string | null }>('users', userId);
    if (!user) throw new NotFoundException({ errors: [{ code: 'user', message: 'Customer not found' }] });

    // Upsert the customer wallet — collection name follows the Laravel
    // convention (`wallets` or `customer_wallets`). We try the canonical
    // `wallets` collection here.
    const existing = await this.mongo.findOne<{ mysql_id: number; balance?: number; total_earning?: number }>(
      'wallets', { user_id: userId },
    );
    const newBalance = Number(existing?.balance ?? 0) + body.amount;
    if (existing) {
      await this.mongo.updateOne('wallets', { user_id: userId }, {
        balance: newBalance,
        updated_at: new Date(),
      });
    } else {
      const nextId = await this.mongo.nextMysqlId('wallets');
      await this.mongo.insertOne('wallets', {
        mysql_id: nextId,
        user_id: userId,
        mysql_user_id: userId,
        balance: body.amount,
        total_earning: body.amount,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    // Record a wallet_transactions row for the audit trail.
    const txId = await this.mongo.nextMysqlId('wallet_transactions');
    await this.mongo.insertOne('wallet_transactions', {
      mysql_id: txId,
      user_id: userId,
      mysql_user_id: userId,
      transaction_id: `ADMIN_FUND_${txId}`,
      credit: body.amount,
      debit: 0,
      balance: newBalance,
      transaction_type: 'admin_credit',
      reference: body.reason ?? 'Admin credit',
      admin_bonus: body.amount,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return {
      ok: true,
      transaction_id: txId,
      user_id: userId,
      customer_name: `${user.f_name ?? ''} ${user.l_name ?? ''}`.trim() || `Customer #${userId}`,
      amount: body.amount,
      new_balance: newBalance,
    };
  }

  async listCustomerWalletFundHistory(limit: number) {
    if (!this.useMongo()) return { total: 0, items: [] };
    const rows = await this.mongo.findMany<{
      mysql_id: number; user_id?: number; credit?: number;
      reference?: string | null; created_at?: Date | null;
      transaction_type?: string | null;
    }>('wallet_transactions',
      { transaction_type: 'admin_credit' },
      { sort: { mysql_id: -1 }, limit },
    );
    // Attach customer name in one batched lookup
    const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter((x): x is number => x !== undefined)));
    const users = userIds.length > 0
      ? await this.mongo.findMany<{ mysql_id: number; f_name?: string | null; l_name?: string | null }>(
          'users', { mysql_id: { $in: userIds } },
        )
      : [];
    const nameById = new Map(users.map((u) => [u.mysql_id, `${u.f_name ?? ''} ${u.l_name ?? ''}`.trim()]));
    return {
      total: rows.length,
      items: rows.map((r) => ({
        id: r.mysql_id,
        user_id: r.user_id ?? null,
        customer_name: r.user_id ? (nameById.get(r.user_id) || `Customer #${r.user_id}`) : '—',
        amount: Number(r.credit ?? 0),
        reason: r.reference ?? '—',
        created_at: r.created_at ?? null,
      })),
    };
  }

  // ── Public pages (T&C, Privacy, About, etc.) ─────────────────────────

  /** Pages are stored as documents in `public_pages` keyed by slug.
   *  This lets the marketing site fetch one with `GET /public/pages/:slug`
   *  while admin edits with PATCH. Stored as Markdown + optional title. */
  async getPublicPage(slug: string) {
    if (!this.useMongo()) return { slug, title: null, content: '', updated_at: null };
    const row = await this.mongo.findOne<{
      slug: string; title?: string | null; content?: string | null; updated_at?: Date | null;
    }>('public_pages', { slug });
    return {
      slug,
      title: row?.title ?? this.defaultPageTitle(slug),
      content: row?.content ?? '',
      updated_at: row?.updated_at ?? null,
    };
  }

  async upsertPublicPage(slug: string, body: { content?: string; title?: string }) {
    if (!this.useMongo()) {
      throw new BadRequestException({ errors: [{ code: 'config', message: 'Page edit requires Mongo' }] });
    }
    const existing = await this.mongo.findOne<{ slug: string }>('public_pages', { slug });
    const now = new Date();
    if (existing) {
      await this.mongo.updateOne('public_pages', { slug }, {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.content !== undefined ? { content: body.content } : {}),
        updated_at: now,
      });
    } else {
      const nextId = await this.mongo.nextMysqlId('public_pages');
      await this.mongo.insertOne('public_pages', {
        mysql_id: nextId,
        slug,
        title: body.title ?? this.defaultPageTitle(slug),
        content: body.content ?? '',
        created_at: now,
        updated_at: now,
      });
    }
    return { ok: true, slug };
  }

  private defaultPageTitle(slug: string): string {
    const map: Record<string, string> = {
      'terms-and-conditions': 'Terms & Conditions',
      'privacy-policy': 'Privacy Policy',
      'about-us': 'About Us',
      'refund-policy': 'Refund Policy',
      'shipping-policy': 'Shipping Policy',
      'cancellation-policy': 'Cancellation Policy',
    };
    return map[slug] ?? slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // ── Promotional banners ──────────────────────────────────────────────

  async listPromotionalBanners() {
    if (!this.useMongo()) return { items: [], total: 0 };
    const rows = await this.mongo.findMany<{
      mysql_id: number; title?: string | null; subtitle?: string | null;
      image?: string | null; type?: string | null; target?: string | null;
      cta_text?: string | null; status?: boolean | number;
      zone_id?: number | null; created_at?: Date | null;
    }>('promotional_banners', {}, { sort: { mysql_id: -1 }, limit: 100 });
    return {
      total: rows.length,
      items: rows.map((r) => ({
        id: r.mysql_id,
        title: r.title ?? '',
        subtitle: r.subtitle ?? null,
        image: r.image ?? null,
        type: r.type ?? 'promo',
        target: r.target ?? null,
        cta_text: r.cta_text ?? 'View',
        status: r.status === true || r.status === 1,
        zone_id: r.zone_id ?? null,
        created_at: r.created_at ?? null,
      })),
    };
  }

  async createPromotionalBanner(body: { title?: string; subtitle?: string; image?: string; type?: string; target?: string; cta_text?: string; zone_id?: number }) {
    if (!body.title) {
      throw new BadRequestException({ errors: [{ code: 'title', message: 'Title is required' }] });
    }
    if (!this.useMongo()) {
      throw new BadRequestException({ errors: [{ code: 'config', message: 'Mongo required' }] });
    }
    const nextId = await this.mongo.nextMysqlId('promotional_banners');
    await this.mongo.insertOne('promotional_banners', {
      mysql_id: nextId,
      title: body.title,
      subtitle: body.subtitle ?? null,
      image: body.image ?? null,
      type: body.type ?? 'promo',
      target: body.target ?? null,
      cta_text: body.cta_text ?? 'View',
      status: true,
      zone_id: body.zone_id ?? null,
      created_at: new Date(),
      updated_at: new Date(),
    });
    return { ok: true, id: nextId };
  }

  async togglePromotionalBanner(id: number, status: boolean) {
    if (!this.useMongo()) throw new BadRequestException({ errors: [{ code: 'config', message: 'Mongo required' }] });
    await this.mongo.updateOne('promotional_banners', { mysql_id: id }, { status, updated_at: new Date() });
    return { ok: true, id, status };
  }

  async deletePromotionalBanner(id: number) {
    if (!this.useMongo()) throw new BadRequestException({ errors: [{ code: 'config', message: 'Mongo required' }] });
    await this.mongo.deleteOne('promotional_banners', { mysql_id: id });
    return { ok: true, id };
  }

  // ── Email templates ──────────────────────────────────────────────────

  async listEmailTemplates() {
    if (!this.useMongo()) return { items: [], total: 0 };
    const rows = await this.mongo.findMany<{
      mysql_id: number; event?: string; audience?: string;
      subject?: string; body?: string; status?: boolean | number;
      updated_at?: Date | null;
    }>('email_templates', {}, { sort: { mysql_id: -1 }, limit: 200 });
    return {
      total: rows.length,
      items: rows.map((r) => ({
        id: r.mysql_id,
        event: r.event ?? '—',
        audience: r.audience ?? 'customer',
        subject: r.subject ?? '',
        body: r.body ?? '',
        status: r.status === true || r.status === 1,
        updated_at: r.updated_at ?? null,
      })),
    };
  }

  async createEmailTemplate(body: { event?: string; audience?: string; subject?: string; body?: string }) {
    if (!body.event || !body.subject) {
      throw new BadRequestException({ errors: [{ code: 'input', message: 'event and subject are required' }] });
    }
    if (!this.useMongo()) throw new BadRequestException({ errors: [{ code: 'config', message: 'Mongo required' }] });
    const nextId = await this.mongo.nextMysqlId('email_templates');
    await this.mongo.insertOne('email_templates', {
      mysql_id: nextId,
      event: body.event,
      audience: body.audience ?? 'customer',
      subject: body.subject,
      body: body.body ?? '',
      status: true,
      created_at: new Date(),
      updated_at: new Date(),
    });
    return { ok: true, id: nextId };
  }

  async updateEmailTemplate(id: number, body: { subject?: string; body?: string; status?: boolean }) {
    if (!this.useMongo()) throw new BadRequestException({ errors: [{ code: 'config', message: 'Mongo required' }] });
    const update: Record<string, unknown> = { updated_at: new Date() };
    if (body.subject !== undefined) update.subject = body.subject;
    if (body.body !== undefined) update.body = body.body;
    if (body.status !== undefined) update.status = body.status;
    await this.mongo.updateOne('email_templates', { mysql_id: id }, update);
    return { ok: true, id };
  }

  async deleteEmailTemplate(id: number) {
    if (!this.useMongo()) throw new BadRequestException({ errors: [{ code: 'config', message: 'Mongo required' }] });
    await this.mongo.deleteOne('email_templates', { mysql_id: id });
    return { ok: true, id };
  }

  // ── DM bonuses ───────────────────────────────────────────────────────

  async listDmBonuses() {
    if (!this.useMongo()) return { items: [], total: 0 };
    const rows = await this.mongo.findMany<{
      mysql_id: number; name?: string; type?: string;
      amount?: number; trigger?: string; status?: boolean | number;
      claims_30d?: number; created_at?: Date | null;
    }>('dm_bonuses', {}, { sort: { mysql_id: -1 }, limit: 100 });
    return {
      total: rows.length,
      items: rows.map((r) => ({
        id: r.mysql_id,
        name: r.name ?? '—',
        type: r.type ?? 'rule',
        amount: Number(r.amount ?? 0),
        trigger: r.trigger ?? '',
        status: r.status === true || r.status === 1,
        claims_30d: Number(r.claims_30d ?? 0),
        created_at: r.created_at ?? null,
      })),
    };
  }

  async createDmBonus(body: { name?: string; type?: string; amount?: number; trigger?: string }) {
    if (!body.name || !body.amount) {
      throw new BadRequestException({ errors: [{ code: 'input', message: 'name and amount are required' }] });
    }
    if (!this.useMongo()) throw new BadRequestException({ errors: [{ code: 'config', message: 'Mongo required' }] });
    const nextId = await this.mongo.nextMysqlId('dm_bonuses');
    await this.mongo.insertOne('dm_bonuses', {
      mysql_id: nextId,
      name: body.name,
      type: body.type ?? 'rule',
      amount: Number(body.amount),
      trigger: body.trigger ?? '',
      status: true,
      claims_30d: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });
    return { ok: true, id: nextId };
  }

  async toggleDmBonus(id: number, status: boolean) {
    if (!this.useMongo()) throw new BadRequestException({ errors: [{ code: 'config', message: 'Mongo required' }] });
    await this.mongo.updateOne('dm_bonuses', { mysql_id: id }, { status, updated_at: new Date() });
    return { ok: true, id, status };
  }

  async deleteDmBonus(id: number) {
    if (!this.useMongo()) throw new BadRequestException({ errors: [{ code: 'config', message: 'Mongo required' }] });
    await this.mongo.deleteOne('dm_bonuses', { mysql_id: id });
    return { ok: true, id };
  }

  // ── DM incentives ────────────────────────────────────────────────────

  async listDmIncentives(status?: string) {
    if (!this.useMongo()) return { items: [], total: 0 };
    const filter: Record<string, unknown> = {};
    if (status && status !== 'all') filter.status = status;
    const rows = await this.mongo.findMany<{
      mysql_id: number; dm_id?: number; period?: string;
      deliveries?: number; claim_amount?: number;
      status?: string; reason?: string | null; created_at?: Date | null;
    }>('dm_incentives', filter, { sort: { mysql_id: -1 }, limit: 100 });

    // Attach DM name + zone + total earning in batched lookups.
    const dmIds = Array.from(new Set(rows.map((r) => r.dm_id).filter((x): x is number => x !== undefined)));
    const dms = dmIds.length > 0
      ? await this.mongo.findMany<{ mysql_id: number; f_name?: string; l_name?: string; mysql_zone_id?: number }>(
          'delivery_men', { mysql_id: { $in: dmIds } },
        )
      : [];
    const nameById = new Map(dms.map((d) => [d.mysql_id, `${d.f_name ?? ''} ${d.l_name ?? ''}`.trim()]));
    const zoneIdByDm = new Map(dms.map((d) => [d.mysql_id, d.mysql_zone_id ?? null]));

    const zoneIds = Array.from(new Set(dms.map((d) => d.mysql_zone_id).filter((x): x is number => x != null)));
    const zones = zoneIds.length
      ? await this.mongo.findMany<{ mysql_id: number; name?: string }>('zones', { mysql_id: { $in: zoneIds } })
      : [];
    const zoneNameById = new Map(zones.map((z) => [z.mysql_id, z.name ?? `Zone #${z.mysql_id}`]));

    const wallets = dmIds.length
      ? await this.mongo.findMany<{ delivery_man_id: number; total_earning?: number }>('delivery_man_wallets', { delivery_man_id: { $in: dmIds } })
      : [];
    const earningByDm = new Map(wallets.map((w) => [w.delivery_man_id, Number(w.total_earning ?? 0)]));

    return {
      total: rows.length,
      items: rows.map((r) => {
        const zoneId = r.dm_id != null ? (zoneIdByDm.get(r.dm_id) ?? null) : null;
        return {
          id: r.mysql_id,
          dm_id: r.dm_id ?? null,
          dm_name: r.dm_id ? (nameById.get(r.dm_id) || `DM #${r.dm_id}`) : '—',
          zone_id: zoneId,
          zone_name: zoneId != null ? (zoneNameById.get(zoneId) ?? `Zone #${zoneId}`) : 'All zones',
          total_earning: r.dm_id != null ? (earningByDm.get(r.dm_id) ?? 0) : 0,
          period: r.period ?? '—',
          deliveries: Number(r.deliveries ?? 0),
          claim_amount: Number(r.claim_amount ?? 0),
          status: r.status ?? 'pending',
          reason: r.reason ?? null,
          created_at: r.created_at ?? null,
        };
      }),
    };
  }

  async updateDmIncentiveStatus(id: number, status: 'approved' | 'rejected', reason?: string) {
    if (!this.useMongo()) throw new BadRequestException({ errors: [{ code: 'config', message: 'Mongo required' }] });
    const inc = await this.mongo.findByMysqlId<{ mysql_id: number; claim_amount?: number; dm_id?: number }>('dm_incentives', id);
    if (!inc) throw new NotFoundException({ errors: [{ code: 'incentive', message: 'Not found' }] });
    await this.mongo.updateOne('dm_incentives', { mysql_id: id }, {
      status,
      reason: status === 'rejected' ? (reason ?? null) : null,
      decided_at: new Date(),
      updated_at: new Date(),
    });
    // On approval — credit DM's wallet
    if (status === 'approved' && inc.dm_id && inc.claim_amount) {
      const wallet = await this.mongo.findOne<{ mysql_id: number; balance?: number }>(
        'delivery_man_wallets', { delivery_man_id: inc.dm_id },
      );
      const newBalance = Number(wallet?.balance ?? 0) + Number(inc.claim_amount);
      if (wallet) {
        await this.mongo.updateOne('delivery_man_wallets', { delivery_man_id: inc.dm_id }, {
          balance: newBalance,
          total_earning: Number((wallet as { total_earning?: number }).total_earning ?? 0) + Number(inc.claim_amount),
          updated_at: new Date(),
        });
      }
    }
    return { ok: true, id, status };
  }

  // ── Subscription orders ──────────────────────────────────────────────

  async listSubscriptionOrders() {
    if (!this.useMongo()) return { items: [], total: 0 };
    // Subscription orders = orders where subscription_id is set, OR the
    // dedicated subscriptions collection — we list both views.
    const subs = await this.mongo.findMany<{
      mysql_id: number; mysql_user_id?: number; mysql_restaurant_id?: number;
      plan?: string; frequency?: string; status?: string;
      start_date?: Date; created_at?: Date | null;
    }>('subscriptions', {}, { sort: { mysql_id: -1 }, limit: 100 });
    const userIds = Array.from(new Set(subs.map((s) => s.mysql_user_id).filter((x): x is number => x !== undefined)));
    const restIds = Array.from(new Set(subs.map((s) => s.mysql_restaurant_id).filter((x): x is number => x !== undefined)));
    const [users, restaurants] = await Promise.all([
      userIds.length ? this.mongo.findMany<{ mysql_id: number; f_name?: string; l_name?: string }>('users', { mysql_id: { $in: userIds } }) : Promise.resolve([]),
      restIds.length ? this.mongo.findMany<{ mysql_id: number; name?: string }>('restaurants', { mysql_id: { $in: restIds } }) : Promise.resolve([]),
    ]);
    const userMap = new Map(users.map((u) => [u.mysql_id, `${u.f_name ?? ''} ${u.l_name ?? ''}`.trim()]));
    const restMap = new Map(restaurants.map((r) => [r.mysql_id, r.name ?? `Restaurant #${r.mysql_id}`]));
    return {
      total: subs.length,
      items: subs.map((s) => ({
        id: s.mysql_id,
        customer: s.mysql_user_id ? userMap.get(s.mysql_user_id) || `Customer #${s.mysql_user_id}` : '—',
        restaurant: s.mysql_restaurant_id ? restMap.get(s.mysql_restaurant_id) || `Restaurant #${s.mysql_restaurant_id}` : '—',
        plan: s.plan ?? '—',
        frequency: s.frequency ?? '—',
        status: s.status ?? 'active',
        start_date: s.start_date ?? s.created_at ?? null,
      })),
    };
  }

  /** Pause / resume / cancel a single subscription (admin manage action). */
  async updateSubscriptionStatus(id: number, status: string) {
    const allowed = ['active', 'paused', 'canceled'];
    if (!allowed.includes(status)) {
      throw new BadRequestException({ errors: [{ code: 'status', message: `status must be one of ${allowed.join(', ')}` }] });
    }
    if (!this.useMongo()) throw new BadRequestException({ errors: [{ code: 'config', message: 'Mongo required' }] });
    const sub = await this.mongo.findByMysqlId<{ mysql_id: number }>('subscriptions', id);
    if (!sub) throw new NotFoundException({ errors: [{ code: 'subscription', message: 'Subscription not found' }] });
    const now = new Date();
    const data: Record<string, unknown> = { status, updated_at: now };
    if (status === 'paused') data.paused_at = now;
    if (status === 'active') data.paused_at = null;
    if (status === 'canceled') data.canceled_at = now;
    await this.mongo.updateOne('subscriptions', { mysql_id: id }, data);
    return { ok: true, id, status };
  }

  // ── Activity log ─────────────────────────────────────────────────────

  async listActivityLog(limit: number) {
    if (!this.useMongo()) return { items: [], total: 0 };
    const rows = await this.mongo.findMany<{
      mysql_id: number; admin_email?: string; action?: string;
      target?: string; ip?: string | null; created_at?: Date | null;
      meta?: Record<string, unknown>;
    }>('activity_logs', {}, { sort: { mysql_id: -1 }, limit });
    return {
      total: rows.length,
      items: rows.map((r) => ({
        id: r.mysql_id,
        admin_email: r.admin_email ?? '—',
        action: r.action ?? '—',
        target: r.target ?? '—',
        ip: r.ip ?? null,
        created_at: r.created_at ?? null,
      })),
    };
  }

  // ── Dispatch ─────────────────────────────────────────────────────────

  async listDispatchOrders(type?: string) {
    if (!this.useMongo()) return { items: [], total: 0 };
    // type=searching → orders status=handover & no DM assigned
    // type=ongoing → orders status=picked_up
    let filter: Record<string, unknown> = {
      order_status: 'handover',
      $or: [{ mysql_delivery_man_id: { $in: [null, 0] } }, { mysql_delivery_man_id: { $exists: false } }],
    };
    if (type === 'ongoing') filter = { order_status: 'picked_up' };

    const orders = await this.mongo.findMany<{
      mysql_id: number; order_amount?: number; mysql_user_id?: number;
      mysql_restaurant_id?: number; created_at?: Date | null;
      delivery_address?: unknown; mysql_delivery_man_id?: number | null;
    }>('orders', filter, { sort: { mysql_id: -1 }, limit: 50 });

    const userIds = Array.from(new Set(orders.map((o) => o.mysql_user_id).filter((x): x is number => x !== undefined)));
    const restIds = Array.from(new Set(orders.map((o) => o.mysql_restaurant_id).filter((x): x is number => x !== undefined)));
    const [users, restaurants] = await Promise.all([
      userIds.length ? this.mongo.findMany<{ mysql_id: number; f_name?: string; l_name?: string }>('users', { mysql_id: { $in: userIds } }) : Promise.resolve([]),
      restIds.length ? this.mongo.findMany<{ mysql_id: number; name?: string }>('restaurants', { mysql_id: { $in: restIds } }) : Promise.resolve([]),
    ]);
    const userMap = new Map(users.map((u) => [u.mysql_id, `${u.f_name ?? ''} ${u.l_name ?? ''}`.trim()]));
    const restMap = new Map(restaurants.map((r) => [r.mysql_id, r.name ?? `Restaurant #${r.mysql_id}`]));

    return {
      total: orders.length,
      type: type ?? 'searching',
      items: orders.map((o) => {
        const addr = typeof o.delivery_address === 'object' && o.delivery_address !== null
          ? ((o.delivery_address as { address?: string }).address ?? '—')
          : (typeof o.delivery_address === 'string' ? o.delivery_address : '—');
        return {
          id: o.mysql_id,
          customer: o.mysql_user_id ? userMap.get(o.mysql_user_id) || `Customer #${o.mysql_user_id}` : '—',
          restaurant: o.mysql_restaurant_id ? restMap.get(o.mysql_restaurant_id) || '—' : '—',
          order_amount: Number(o.order_amount ?? 0),
          address: addr,
          wait_minutes: o.created_at ? Math.max(0, Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000)) : 0,
          assigned_to: o.mysql_delivery_man_id ?? null,
        };
      }),
    };
  }

  async assignOrderToDeliveryMan(orderId: number, deliveryManId: number) {
    if (!this.useMongo()) throw new BadRequestException({ errors: [{ code: 'config', message: 'Mongo required' }] });
    const order = await this.mongo.findByMysqlId<{ mysql_id: number }>('orders', orderId);
    if (!order) throw new NotFoundException({ errors: [{ code: 'order', message: 'Order not found' }] });
    const dm = await this.mongo.findByMysqlId<{ mysql_id: number }>('delivery_men', deliveryManId);
    if (!dm) throw new NotFoundException({ errors: [{ code: 'delivery_man', message: 'DM not found' }] });
    await this.mongo.updateOne('orders', { mysql_id: orderId }, {
      mysql_delivery_man_id: deliveryManId,
      delivery_man_id: deliveryManId,
      updated_at: new Date(),
    });
    return { ok: true, order_id: orderId, delivery_man_id: deliveryManId };
  }

  // ── Gallery / file listing ───────────────────────────────────────────

  async listGalleryFiles(folder?: string) {
    // Read from local storage/app/public — purely metadata, no DB.
    const fs = await import('fs/promises');
    const path = await import('path');
    const storageBase = process.env.STORAGE_ROOT
      ? process.env.STORAGE_ROOT
      : path.resolve(__dirname, '../../../../../storage/app/public');

    const FOLDERS = ['restaurant', 'category', 'food', 'banner', 'document', 'cuisine', 'addon', 'profile'];
    const targetFolder = folder && FOLDERS.includes(folder) ? folder : null;

    type FileEntry = { name: string; folder: string; size: number; modified: Date | null };
    const allFiles: FileEntry[] = [];
    const foldersToScan = targetFolder ? [targetFolder] : FOLDERS;

    for (const f of foldersToScan) {
      const dirPath = path.join(storageBase, f);
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile()) {
            try {
              const stat = await fs.stat(path.join(dirPath, entry.name));
              allFiles.push({
                name: entry.name,
                folder: f,
                size: stat.size,
                modified: stat.mtime,
              });
            } catch { /* skip unreadable */ }
          }
        }
      } catch { /* directory doesn't exist — skip */ }
    }

    allFiles.sort((a, b) => (b.modified?.getTime() ?? 0) - (a.modified?.getTime() ?? 0));
    return {
      total: allFiles.length,
      folders: FOLDERS.map((name) => ({ name, count: allFiles.filter((f) => f.folder === name).length })),
      files: allFiles.slice(0, 200).map((f) => ({
        name: f.name,
        folder: f.folder,
        size_bytes: f.size,
        url: `/storage/${f.folder}/${f.name}`,
        modified: f.modified,
      })),
    };
  }

  // ── Clean database ───────────────────────────────────────────────────

  async cleanDatabaseCollections(body: { collections?: string[]; confirm?: string }) {
    if (body.confirm !== 'DELETE') {
      throw new BadRequestException({
        errors: [{ code: 'confirm', message: 'Type "DELETE" in the confirm field to proceed.' }],
      });
    }
    if (!body.collections || body.collections.length === 0) {
      throw new BadRequestException({
        errors: [{ code: 'collections', message: 'No collections selected for cleanup.' }],
      });
    }
    if (!this.useMongo()) {
      throw new BadRequestException({ errors: [{ code: 'config', message: 'Mongo required' }] });
    }
    // Whitelist of collections that are safe to truncate. Wallets, employees,
    // admins, business_settings, and zones are NEVER cleaned — they are
    // operational and would brick the platform.
    const WHITELIST = [
      'orders', 'order_details', 'order_transactions',
      'reviews', 'restaurant_reviews', 'dm_reviews',
      'notifications', 'conversations', 'messages',
      'contact_messages', 'newsletter_subscribers',
      'banners', 'promotional_banners', 'advertisements', 'campaigns',
      'coupons', 'wishlists', 'customer_addresses',
      'dm_incentives', 'dm_bonuses',
      'activity_logs',
    ];

    const cleared: Record<string, number> = {};
    for (const c of body.collections) {
      if (!WHITELIST.includes(c)) {
        cleared[c] = -1; // rejected
        continue;
      }
      try {
        await this.logActivity('admin@admin.com', 'clean_database', c, '127.0.0.1');
        cleared[c] = await this.mongo.deleteMany(c, {});
      } catch {
        cleared[c] = -1;
      }
    }
    return { ok: true, cleared };
  }

  /** Helper: record an admin action in the activity log. */
  async logActivity(adminEmail: string, action: string, target: string, ip: string, meta?: Record<string, unknown>) {
    if (!this.useMongo()) return;
    const nextId = await this.mongo.nextMysqlId('activity_logs');
    await this.mongo.insertOne('activity_logs', {
      mysql_id: nextId,
      admin_email: adminEmail,
      action,
      target,
      ip,
      meta: meta ?? {},
      created_at: new Date(),
    });
  }

  async deleteZone(id: number) {
    if (this.useMongo()) {
      const z = await this.mongo.findByMysqlId<{ mysql_id: number; is_default?: boolean }>('zones', id);
      if (!z) throw new NotFoundException({ errors: [{ code: 'zone', message: 'Zone not found' }] });
      if (z.is_default) {
        throw new BadRequestException({ errors: [{ code: 'zone', message: 'Cannot delete the default zone' }] });
      }
      // Block deletion when restaurants still belong to the zone — otherwise
      // those restaurants get orphaned and disappear silently from search.
      const restaurantCount = await this.mongo.count('restaurants', { mysql_zone_id: id });
      if (restaurantCount > 0) {
        throw new BadRequestException({
          errors: [{ code: 'zone', message: `Cannot delete — ${restaurantCount} restaurant(s) still in this zone. Move or delete them first.` }],
        });
      }
      await this.mongo.deleteOne('zones', { mysql_id: id });
      return { ok: true, id };
    }
    throw new BadRequestException({
      errors: [{ code: 'config', message: 'Zone delete requires USE_MONGO_ADMIN=1 (MySQL path is read-only).' }],
    });
  }

  // ── Business settings ─────────────────────────────────────────────────

  async listBusinessSettings(prefix?: string) {
    if (this.useMongo()) {
      const filter: Record<string, unknown> = {};
      if (prefix) filter.key = { $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` };
      const rows = await this.mongo.findMany<{
        mysql_id: number; key: string; value: string | null;
      }>('business_settings', filter, { sort: { key: 1 } });
      return {
        settings: rows.map((r) => ({ id: r.mysql_id, key: r.key, value: r.value })),
      };
    }
    const rows = await this.prisma.business_settings.findMany({
      where: prefix ? { key: { startsWith: prefix } } : undefined,
      orderBy: { key: 'asc' },
    });
    return {
      settings: rows.map((r) => ({ id: Number(r.id), key: r.key, value: r.value })),
    };
  }

  async upsertBusinessSettings(body: { settings: Array<{ key: string; value: string | null }> }) {
    if (!Array.isArray(body.settings) || body.settings.length === 0) {
      throw new BadRequestException({ errors: [{ code: 'settings', message: 'settings[] required' }] });
    }
    if (this.useMongo()) {
      let updated = 0;
      for (const s of body.settings) {
        const existing = await this.mongo.findOne<{ mysql_id: number }>('business_settings', { key: s.key });
        const now = new Date();
        if (existing) {
          await this.mongo.updateOne('business_settings', { key: s.key }, { value: s.value, updated_at: now });
        } else {
          const mysql_id = await this.mongo.nextMysqlId('business_settings');
          await this.mongo.insertOne('business_settings', {
            mysql_id,
            key: s.key,
            value: s.value,
            created_at: now,
            updated_at: now,
          });
        }
        updated++;
      }
      return { ok: true, updated };
    }
    let updated = 0;
    for (const s of body.settings) {
      const existing = await this.prisma.business_settings.findFirst({ where: { key: s.key } });
      if (existing) {
        await this.prisma.business_settings.update({
          where: { id: existing.id },
          data: { value: s.value },
        });
      } else {
        await this.prisma.business_settings.create({ data: { key: s.key, value: s.value } });
      }
      updated++;
    }
    return { ok: true, updated };
  }

  // ── Reports ───────────────────────────────────────────────────────────

  async salesSummary(days = 30, opts: { from?: string; to?: string; zoneId?: number; restaurantId?: number } = {}) {
    if (this.useMongo()) {
      // Explicit from/to date range wins; otherwise fall back to the last N days.
      const fromDate = opts.from ? new Date(opts.from) : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const toDate = opts.to ? new Date(`${opts.to}T23:59:59.999Z`) : null;
      const deliveredRange: Record<string, unknown> = { $gte: fromDate };
      if (toDate) deliveredRange.$lte = toDate;
      const match: Record<string, unknown> = { order_status: 'delivered', payment_status: 'paid', delivered: deliveredRange };
      if (opts.zoneId) match.mysql_zone_id = Number(opts.zoneId);
      if (opts.restaurantId) match.mysql_restaurant_id = Number(opts.restaurantId);
      const rows = await this.mongo.aggregate<{
        _id: string;
        orders: number;
        revenue: number;
        tax: number;
        delivery: number;
      }>('orders', [
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$delivered' } },
            orders: { $sum: 1 },
            revenue: { $sum: '$order_amount' },
            tax: { $sum: '$total_tax_amount' },
            delivery: { $sum: '$delivery_charge' },
          },
        },
        { $sort: { _id: 1 } },
      ]);
      const series = rows.map((r) => ({
        day: r._id,
        revenue: Number(r.revenue ?? 0),
        orders: Number(r.orders ?? 0),
        tax: Number(r.tax ?? 0),
        delivery: Number(r.delivery ?? 0),
      }));
      return {
        days,
        total_revenue: series.reduce((s, x) => s + x.revenue, 0),
        total_orders: series.reduce((s, x) => s + x.orders, 0),
        series,
      };
    }
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const orders = await this.prisma.orders.findMany({
      where: { created_at: { gte: since }, order_status: 'delivered' },
      select: { created_at: true, order_amount: true, total_tax_amount: true, delivery_charge: true },
    });
    const dailyMap = new Map<string, { revenue: number; orders: number; tax: number; delivery: number }>();
    for (const o of orders) {
      if (!o.created_at) continue;
      const day = o.created_at.toISOString().slice(0, 10);
      const cur = dailyMap.get(day) ?? { revenue: 0, orders: 0, tax: 0, delivery: 0 };
      cur.revenue += Number(o.order_amount);
      cur.tax += Number(o.total_tax_amount);
      cur.delivery += Number(o.delivery_charge);
      cur.orders += 1;
      dailyMap.set(day, cur);
    }
    const series = Array.from(dailyMap.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([day, v]) => ({ day, ...v }));
    return {
      days,
      total_revenue: series.reduce((s, x) => s + x.revenue, 0),
      total_orders: series.reduce((s, x) => s + x.orders, 0),
      series,
    };
  }

  /** Per-order transaction report (StackFood's "Transaction details"). Computes
   *  the full money breakdown — item amount, discounts, commission, net incomes —
   *  from the stored order totals, joined with restaurant + customer names. */
  async transactionDetails(opts: ReportFilterOpts & { days?: number } = {}) {
    const match = orderReportMatch(opts);
    if (!opts.from && !opts.to) {
      const days = opts.days ?? 30;
      match.delivered = { $gte: new Date(Date.now() - days * 86_400_000) };
    }
    if (!this.useMongo()) return { total: 0, rows: [] };
    const orders = await this.mongo.findMany<Record<string, unknown>>('orders', match, { sort: { mysql_id: -1 }, limit: 500 });
    const restIds = Array.from(new Set(orders.map((o) => Number(o.mysql_restaurant_id ?? 0)).filter((n) => n > 0)));
    const userIds = Array.from(new Set(orders.map((o) => Number(o.mysql_user_id ?? 0)).filter((n) => n > 0)));
    const [rests, users] = await Promise.all([
      restIds.length ? this.mongo.findMany<{ mysql_id: number; name?: string; comission?: number }>('restaurants', { mysql_id: { $in: restIds } }) : Promise.resolve([] as Array<{ mysql_id: number; name?: string; comission?: number }>),
      userIds.length ? this.mongo.findMany<{ mysql_id: number; f_name?: string; l_name?: string }>('users', { mysql_id: { $in: userIds } }) : Promise.resolve([] as Array<{ mysql_id: number; f_name?: string; l_name?: string }>),
    ]);
    const restMap = new Map(rests.map((r) => [Number(r.mysql_id), r]));
    const userMap = new Map(users.map((u) => [Number(u.mysql_id), u]));
    const num = (v: unknown) => (v == null ? 0 : Number(v) || 0);
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const rows = orders.map((o) => {
      const orderAmount = num(o.order_amount);
      const tax = num(o.total_tax_amount);
      const delivery = num(o.delivery_charge);
      const coupon = num(o.coupon_discount_amount);
      const restDiscount = num(o.restaurant_discount_amount);
      const extraPackaging = num(o.additional_charge);
      // Reverse the item subtotal: order_amount = items − discounts + tax + delivery + extra.
      let itemAmount = r2(orderAmount + coupon + restDiscount - tax - delivery - extraPackaging);
      if (itemAmount <= 0) itemAmount = r2(Math.max(0, orderAmount - tax - delivery)) || orderAmount;
      const rest = restMap.get(Number(o.mysql_restaurant_id ?? 0));
      const commissionRate = num(rest?.comission) || 10;
      const adminCommission = r2((itemAmount * commissionRate) / 100);
      const discountedAmount = r2(itemAmount - coupon - restDiscount);
      const adminNetIncome = r2(adminCommission + tax);
      const restaurantNetIncome = r2(itemAmount - adminCommission - restDiscount);
      const user = userMap.get(Number(o.mysql_user_id ?? 0));
      const cod = String(o.payment_method) === 'cash_on_delivery';
      return {
        order_id: Number(o.mysql_id),
        restaurant: rest?.name ?? null,
        customer_name: user ? `${user.f_name ?? ''} ${user.l_name ?? ''}`.trim() || null : null,
        total_item_amount: itemAmount,
        item_discount: 0,
        coupon_discount: coupon,
        referral_discount: 0,
        discounted_amount: discountedAmount,
        vat_tax: tax,
        delivery_charge: delivery,
        order_amount: orderAmount,
        admin_discount: 0,
        restaurant_discount: restDiscount,
        admin_commission: adminCommission,
        service_charge: 0,
        extra_packaging_amount: extraPackaging,
        commission_on_delivery_charge: 0,
        admin_net_income: adminNetIncome,
        restaurant_net_income: restaurantNetIncome,
        amount_received_by: cod ? 'Delivery man' : 'Admin',
        payment_method: String(o.payment_method ?? 'cash_on_delivery'),
        payment_status: String(o.payment_status ?? 'unpaid'),
      };
    });
    return { total: rows.length, rows };
  }

  /** Per-order expense list (StackFood's "Expense Lists"). Every discount the
   *  platform funded — coupon, product discount — becomes one expense row. */
  async expenseDetails(opts: ReportFilterOpts = {}) {
    if (!this.useMongo()) return { total: 0, rows: [] };
    const match: Record<string, unknown> = {
      $or: [{ coupon_discount_amount: { $gt: 0 } }, { restaurant_discount_amount: { $gt: 0 } }],
    };
    if (opts.from || opts.to) {
      const range: Record<string, unknown> = {};
      if (opts.from) range.$gte = new Date(opts.from);
      if (opts.to) range.$lte = new Date(`${opts.to}T23:59:59.999Z`);
      match.created_at = range;
    }
    if (opts.zoneId) match.mysql_zone_id = Number(opts.zoneId);
    if (opts.restaurantId) match.mysql_restaurant_id = Number(opts.restaurantId);

    const orders = await this.mongo.findMany<Record<string, unknown>>('orders', match, { sort: { mysql_id: -1 }, limit: 1000 });
    const userIds = Array.from(new Set(orders.map((o) => Number(o.mysql_user_id ?? 0)).filter((n) => n > 0)));
    const users = userIds.length
      ? await this.mongo.findMany<{ mysql_id: number; f_name?: string; l_name?: string }>('users', { mysql_id: { $in: userIds } })
      : [];
    const userMap = new Map(users.map((u) => [Number(u.mysql_id), u]));
    const num = (v: unknown) => (v == null ? 0 : Number(v) || 0);

    const rows: Array<{ order_id: number; date_time: unknown; expense_type: string; customer_name: string | null; amount: number }> = [];
    for (const o of orders) {
      const user = userMap.get(Number(o.mysql_user_id ?? 0));
      const customerName = user ? `${user.f_name ?? ''} ${user.l_name ?? ''}`.trim() || null : null;
      const dt = o.created_at ?? o.created_at_legacy ?? null;
      const oid = Number(o.mysql_id);
      const coupon = num(o.coupon_discount_amount);
      const prod = num(o.restaurant_discount_amount);
      if (coupon > 0) rows.push({ order_id: oid, date_time: dt, expense_type: 'Coupon Discount', customer_name: customerName, amount: coupon });
      if (prod > 0) rows.push({ order_id: oid, date_time: dt, expense_type: 'Discount On Product', customer_name: customerName, amount: prod });
    }
    const total = rows.reduce((s, r) => s + r.amount, 0);
    return { total: rows.length, total_amount: Math.round(total * 100) / 100, rows };
  }

  /** Per-food sales report (StackFood's "Food Report Table"). Aggregates every
   *  order line by food → order count, total sold, discount given, avg sale,
   *  rating; joined with the food (name/image/price) and its restaurant. */
  async foodReport(opts: ReportFilterOpts & { categoryId?: number } = {}) {
    if (!this.useMongo()) return { total: 0, rows: [], yearly: [] as Array<{ year: number; total: number }> };
    const agg = await this.mongo.aggregate<{ _id: number; order_count: number; total_amount_sold: number; total_discount: number }>(
      'order_details',
      [
        {
          $group: {
            _id: { $ifNull: ['$food_id', '$mysql_food_id'] },
            order_count: { $sum: 1 },
            total_amount_sold: { $sum: { $multiply: [{ $toDouble: { $ifNull: ['$price', 0] } }, { $ifNull: ['$quantity', 1] }] } },
            total_discount: { $sum: { $toDouble: { $ifNull: ['$discount_on_food', 0] } } },
          },
        },
      ],
    );
    const foodIds = agg.map((a) => Number(a._id)).filter((n) => n > 0);
    const foods = foodIds.length
      ? await this.mongo.findMany<{ mysql_id: number; name?: string; image?: string; price?: unknown; avg_rating?: number; rating_count?: number; mysql_restaurant_id?: number; mysql_category_id?: number }>('foods', { mysql_id: { $in: foodIds } })
      : [];
    const foodMap = new Map(foods.map((f) => [Number(f.mysql_id), f]));
    const restIds = Array.from(new Set(foods.map((f) => Number(f.mysql_restaurant_id ?? 0)).filter((n) => n > 0)));
    const rests = restIds.length
      ? await this.mongo.findMany<{ mysql_id: number; name?: string }>('restaurants', { mysql_id: { $in: restIds } })
      : [];
    const restMap = new Map(rests.map((r) => [Number(r.mysql_id), r.name ?? null]));
    const num = (v: unknown) => (v == null ? 0 : Number(typeof v === 'object' ? String(v) : v) || 0);
    const r2 = (n: number) => Math.round(n * 100) / 100;

    let rows = agg
      .map((a) => {
        const fid = Number(a._id);
        const food = foodMap.get(fid);
        if (!food) return null;
        const sold = r2(a.total_amount_sold);
        const oc = a.order_count;
        return {
          food_id: fid,
          name: food.name ?? null,
          image_full_url: storageFullUrl('product', food.image ?? null),
          restaurant_id: Number(food.mysql_restaurant_id ?? 0),
          restaurant: restMap.get(Number(food.mysql_restaurant_id ?? 0)) ?? null,
          category_id: Number(food.mysql_category_id ?? 0),
          order_count: oc,
          price: num(food.price),
          total_amount_sold: sold,
          total_discount: r2(a.total_discount),
          average_sale_value: oc ? r2(sold / oc) : 0,
          avg_rating: num(food.avg_rating),
          rating_count: Number(food.rating_count ?? 0),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (opts.restaurantId) rows = rows.filter((r) => r.restaurant_id === Number(opts.restaurantId));
    if (opts.categoryId) rows = rows.filter((r) => r.category_id === Number(opts.categoryId));
    rows.sort((a, b) => b.total_amount_sold - a.total_amount_sold);

    // Yearly sales statistics for the chart (sum sold per delivered-order year).
    const yearAgg = await this.mongo.aggregate<{ _id: number; total: number }>('orders', [
      { $match: { order_status: 'delivered' } },
      { $group: { _id: { $year: '$created_at' }, total: { $sum: { $toDouble: { $ifNull: ['$order_amount', 0] } } } } },
      { $sort: { _id: 1 } },
    ]).catch(() => [] as Array<{ _id: number; total: number }>);
    const yearly = yearAgg.filter((y) => y._id).map((y) => ({ year: Number(y._id), total: r2(y.total) }));

    return { total: rows.length, rows, yearly };
  }

  /** Per-order Order Report (StackFood's "Regular Order Report"). Like the
   *  transaction report but covers ALL orders (any status) and adds order-status
   *  stat counts for the cards. */
  async orderReport(opts: ReportFilterOpts & { days?: number; campaign?: boolean } = {}) {
    if (!this.useMongo()) return { total: 0, rows: [], status_counts: {} as Record<string, number> };
    const match: Record<string, unknown> = {};
    if (opts.from || opts.to) {
      const range: Record<string, unknown> = {};
      if (opts.from) range.$gte = new Date(opts.from);
      if (opts.to) range.$lte = new Date(`${opts.to}T23:59:59.999Z`);
      match.created_at = range;
    }
    if (opts.zoneId) match.mysql_zone_id = Number(opts.zoneId);
    if (opts.restaurantId) match.mysql_restaurant_id = Number(opts.restaurantId);

    // Campaign vs regular split. A "campaign order" is one whose line items
    // came from an item campaign (order_details.item_campaign_id > 0). When
    // `campaign` is set we restrict (true) or exclude (false) those orders.
    if (opts.campaign !== undefined) {
      const campDetails = await this.mongo.findMany<{ order_id?: number }>(
        'order_details', { item_campaign_id: { $gt: 0 } }, { projection: { order_id: 1 } as Record<string, 0 | 1> },
      );
      const campaignOrderIds = Array.from(new Set(campDetails.map((d) => Number(d.order_id ?? 0)).filter((n) => n > 0)));
      if (opts.campaign) {
        // Campaign report: only those orders (empty set => match nothing).
        match.mysql_id = { $in: campaignOrderIds.length ? campaignOrderIds : [-1] };
      } else if (campaignOrderIds.length) {
        // Regular report: everything except campaign orders.
        match.mysql_id = { $nin: campaignOrderIds };
      }
    }

    const orders = await this.mongo.findMany<Record<string, unknown>>('orders', match, { sort: { mysql_id: -1 }, limit: 500 });
    const restIds = Array.from(new Set(orders.map((o) => Number(o.mysql_restaurant_id ?? 0)).filter((n) => n > 0)));
    const userIds = Array.from(new Set(orders.map((o) => Number(o.mysql_user_id ?? 0)).filter((n) => n > 0)));
    const [rests, users] = await Promise.all([
      restIds.length ? this.mongo.findMany<{ mysql_id: number; name?: string; comission?: number }>('restaurants', { mysql_id: { $in: restIds } }) : Promise.resolve([] as Array<{ mysql_id: number; name?: string; comission?: number }>),
      userIds.length ? this.mongo.findMany<{ mysql_id: number; f_name?: string; l_name?: string }>('users', { mysql_id: { $in: userIds } }) : Promise.resolve([] as Array<{ mysql_id: number; f_name?: string; l_name?: string }>),
    ]);
    const restMap = new Map(rests.map((r) => [Number(r.mysql_id), r]));
    const userMap = new Map(users.map((u) => [Number(u.mysql_id), u]));
    const num = (v: unknown) => (v == null ? 0 : Number(v) || 0);
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const status_counts: Record<string, number> = {};

    const rows = orders.map((o) => {
      const orderAmount = num(o.order_amount);
      const tax = num(o.total_tax_amount);
      const delivery = num(o.delivery_charge);
      const coupon = num(o.coupon_discount_amount);
      const restDiscount = num(o.restaurant_discount_amount);
      const extraPackaging = num(o.additional_charge);
      let itemAmount = r2(orderAmount + coupon + restDiscount - tax - delivery - extraPackaging);
      if (itemAmount <= 0) itemAmount = r2(Math.max(0, orderAmount - tax - delivery)) || orderAmount;
      const user = userMap.get(Number(o.mysql_user_id ?? 0));
      const cod = String(o.payment_method) === 'cash_on_delivery';
      const status = String(o.order_status ?? 'pending');
      status_counts[status] = (status_counts[status] ?? 0) + 1;
      return {
        order_id: Number(o.mysql_id),
        restaurant: restMap.get(Number(o.mysql_restaurant_id ?? 0))?.name ?? null,
        customer_name: user ? `${user.f_name ?? ''} ${user.l_name ?? ''}`.trim() || null : null,
        total_item_amount: itemAmount,
        item_discount: 0,
        coupon_discount: coupon,
        referral_discount: 0,
        discounted_amount: r2(itemAmount - coupon - restDiscount),
        tax,
        delivery_charge: delivery,
        service_charge: 0,
        order_amount: orderAmount,
        amount_received_by: status === 'delivered' ? (cod ? 'Delivery man' : 'Admin') : 'Not Received Yet',
        payment_method: String(o.payment_method ?? 'cash_on_delivery'),
        payment_status: String(o.payment_status ?? 'unpaid'),
        order_status: status,
        created_at: o.created_at ?? null,
      };
    });
    return { total: rows.length, rows, status_counts };
  }

  /** Per-restaurant report (StackFood's "Restaurant Report Table"): food count,
   *  order count, order amount, discount, admin commission, VAT, rating. */
  async restaurantReport(opts: ReportFilterOpts = {}) {
    if (!this.useMongo()) return { total: 0, rows: [], yearly: [] as Array<{ year: number; total: number }> };
    const agg = await this.mongo.aggregate<{ _id: number; total_order: number; total_order_amount: number; total_vat: number; total_coupon: number; total_rest_discount: number }>(
      'orders',
      [
        { $match: { order_status: { $ne: 'failed' } } },
        {
          $group: {
            _id: '$mysql_restaurant_id',
            total_order: { $sum: 1 },
            total_order_amount: { $sum: { $toDouble: { $ifNull: ['$order_amount', 0] } } },
            total_vat: { $sum: { $toDouble: { $ifNull: ['$total_tax_amount', 0] } } },
            total_coupon: { $sum: { $toDouble: { $ifNull: ['$coupon_discount_amount', 0] } } },
            total_rest_discount: { $sum: { $toDouble: { $ifNull: ['$restaurant_discount_amount', 0] } } },
          },
        },
      ],
    );
    const restIds = agg.map((a) => Number(a._id)).filter((n) => n > 0);
    const [rests, foodCounts] = await Promise.all([
      restIds.length ? this.mongo.findMany<{ mysql_id: number; name?: string; logo?: string; comission?: number; avg_rating?: number; rating_count?: number; mysql_zone_id?: number }>('restaurants', { mysql_id: { $in: restIds } }) : Promise.resolve([] as Array<{ mysql_id: number; name?: string; logo?: string; comission?: number; avg_rating?: number; rating_count?: number; mysql_zone_id?: number }>),
      restIds.length ? this.mongo.aggregate<{ _id: number; c: number }>('foods', [{ $match: { mysql_restaurant_id: { $in: restIds } } }, { $group: { _id: '$mysql_restaurant_id', c: { $sum: 1 } } }]) : Promise.resolve([] as Array<{ _id: number; c: number }>),
    ]);
    const restMap = new Map(rests.map((r) => [Number(r.mysql_id), r]));
    const foodCountMap = new Map(foodCounts.map((f) => [Number(f._id), f.c]));
    const num = (v: unknown) => (v == null ? 0 : Number(v) || 0);
    const r2 = (n: number) => Math.round(n * 100) / 100;

    let rows = agg
      .map((a) => {
        const rid = Number(a._id);
        const rest = restMap.get(rid);
        if (!rest) return null;
        const amount = r2(a.total_order_amount);
        const commissionRate = num(rest.comission) || 10;
        return {
          restaurant_id: rid,
          zone_id: Number(rest.mysql_zone_id ?? 0),
          name: rest.name ?? null,
          image_full_url: storageFullUrl('restaurant', rest.logo ?? null),
          total_food: foodCountMap.get(rid) ?? 0,
          total_order: a.total_order,
          total_order_amount: amount,
          total_discount: r2(a.total_coupon + a.total_rest_discount),
          total_admin_commission: r2((amount * commissionRate) / 100),
          total_vat: r2(a.total_vat),
          avg_rating: num(rest.avg_rating),
          rating_count: Number(rest.rating_count ?? 0),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (opts.zoneId) rows = rows.filter((r) => r.zone_id === Number(opts.zoneId));
    if (opts.restaurantId) rows = rows.filter((r) => r.restaurant_id === Number(opts.restaurantId));
    rows.sort((a, b) => b.total_order_amount - a.total_order_amount);

    const yearAgg = await this.mongo.aggregate<{ _id: number; total: number }>('orders', [
      { $match: { order_status: 'delivered' } },
      { $group: { _id: { $year: '$created_at' }, total: { $sum: { $toDouble: { $ifNull: ['$order_amount', 0] } } } } },
      { $sort: { _id: 1 } },
    ]).catch(() => [] as Array<{ _id: number; total: number }>);
    const yearly = yearAgg.filter((y) => y._id).map((y) => ({ year: Number(y._id), total: r2(y.total) }));

    return { total: rows.length, rows, yearly };
  }

  /** Restaurant subscription transactions (StackFood's "Subscription Report"). */
  async subscriptionReport() {
    if (!this.useMongo()) return { total: 0, rows: [] };
    const subs = await this.mongo.findMany<Record<string, unknown>>('subscriptions', {}, { sort: { mysql_id: -1 }, limit: 300 });
    const pkgIds = Array.from(new Set(subs.map((s) => Number(s.package_id ?? 0)).filter((n) => n > 0)));
    const vendorIds = Array.from(new Set(subs.map((s) => Number(s.vendor_id ?? 0)).filter((n) => n > 0)));
    const [pkgs, rests] = await Promise.all([
      pkgIds.length ? this.mongo.findMany<{ mysql_id: number; package_name?: string; validity?: number }>('subscription_packages', { mysql_id: { $in: pkgIds } }) : Promise.resolve([] as Array<{ mysql_id: number; package_name?: string; validity?: number }>),
      vendorIds.length ? this.mongo.findMany<{ mysql_id: number; name?: string; mysql_vendor_id?: number }>('restaurants', { mysql_vendor_id: { $in: vendorIds } }) : Promise.resolve([] as Array<{ mysql_id: number; name?: string; mysql_vendor_id?: number }>),
    ]);
    const pkgMap = new Map(pkgs.map((p) => [Number(p.mysql_id), p]));
    const restByVendor = new Map(rests.map((r) => [Number(r.mysql_vendor_id ?? 0), r.name ?? null]));
    const num = (v: unknown) => (v == null ? 0 : Number(v) || 0);
    const rows = subs.map((s) => {
      const pkg = pkgMap.get(Number(s.package_id ?? 0));
      return {
        transaction_id: (s.transaction_id as string) ?? `SUB-${Number(s.mysql_id)}`,
        transaction_date: s.started_at ?? s.created_at ?? null,
        restaurant_name: restByVendor.get(Number(s.vendor_id ?? 0)) ?? null,
        package_name: pkg?.package_name ?? 'Plan',
        duration: `${num(pkg?.validity) || 30} Days`,
        pricing: num(s.amount),
        payment_status: String(s.status ?? 'paid') === 'active' ? 'paid' : String(s.status ?? 'paid'),
        payment_method: 'Manual Payment By Admin',
      };
    });
    return { total: rows.length, rows };
  }

  /** Customer Overview Report — per-customer order stats + customer counts. */
  async customerOverviewReport(_opts: ReportFilterOpts = {}) {
    if (!this.useMongo()) return { total: 0, rows: [], stats: { total_customers: 0, new_customers: 0, active: 0, inactive: 0, returning: 0 } };
    const num = (v: unknown) => (v == null ? 0 : Number(v) || 0);
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const [ordAgg, pmAgg, users] = await Promise.all([
      this.mongo.aggregate<{ _id: number; total_order: number; total_spent: number; last_purchase: unknown }>('orders', [
        { $group: { _id: '$mysql_user_id', total_order: { $sum: 1 }, total_spent: { $sum: { $toDouble: { $ifNull: ['$order_amount', 0] } } }, last_purchase: { $max: '$created_at' } } },
      ]),
      this.mongo.aggregate<{ _id: { u: number; pm: string }; c: number }>('orders', [
        { $group: { _id: { u: '$mysql_user_id', pm: '$payment_method' }, c: { $sum: 1 } } },
        { $sort: { c: -1 } },
      ]),
      this.mongo.findMany<{ mysql_id: number; f_name?: string; l_name?: string; email?: string; phone?: string; image?: string; created_at?: unknown; legacy?: { created_at?: unknown } }>('users', {}, { sort: { mysql_id: -1 }, limit: 1000 }),
    ]);
    const ordMap = new Map(ordAgg.map((o) => [Number(o._id), o]));
    const pmMap = new Map<number, string>();
    for (const p of pmAgg) { const uid = Number(p._id?.u); if (uid && !pmMap.has(uid)) pmMap.set(uid, p._id?.pm ?? 'cash_on_delivery'); }
    const now = Date.now();

    const rows = users.map((u) => {
      const uid = Number(u.mysql_id);
      const o = ordMap.get(uid);
      const orders = o?.total_order ?? 0;
      const spent = r2(o?.total_spent ?? 0);
      return {
        customer_id: uid,
        name: `${u.f_name ?? ''} ${u.l_name ?? ''}`.trim() || null,
        email: u.email ?? null,
        phone: u.phone ?? null,
        image_full_url: storageFullUrl('profile', u.image ?? null),
        joining_date: u.created_at ?? u.legacy?.created_at ?? null,
        total_order: orders,
        total_spent: spent,
        aov: orders ? r2(spent / orders) : 0,
        last_purchase: o?.last_purchase ?? null,
        most_used_payment_method: orders ? (pmMap.get(uid) ?? 'cash_on_delivery') : null,
      };
    });
    rows.sort((a, b) => b.total_spent - a.total_spent);

    const total_customers = users.length;
    const new_customers = users.filter((u) => { const t = new Date(String(u.created_at ?? u.legacy?.created_at ?? 0)).getTime(); return t && now - t < 30 * 86_400_000; }).length;
    const active = rows.filter((r) => r.total_order > 0).length;
    const returning = rows.filter((r) => r.total_order > 1).length;
    return { total: rows.length, rows, stats: { total_customers, new_customers, active, inactive: total_customers - active, returning } };
  }

  /** Customer Wallet Report — wallet transactions + debit/credit/balance totals. */
  async customerWalletReport() {
    if (!this.useMongo()) return { total: 0, rows: [], totals: { credit: 0, debit: 0, balance: 0 } };
    const num = (v: unknown) => (v == null ? 0 : Number(v) || 0);
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const txns = await this.mongo.findMany<Record<string, unknown>>('wallet_transactions', {}, { sort: { mysql_id: -1 }, limit: 500 });
    const userIds = Array.from(new Set(txns.map((t) => Number(t.mysql_user_id ?? 0)).filter((n) => n > 0)));
    const users = userIds.length
      ? await this.mongo.findMany<{ mysql_id: number; f_name?: string; l_name?: string }>('users', { mysql_id: { $in: userIds } })
      : [];
    const userMap = new Map(users.map((u) => [Number(u.mysql_id), `${u.f_name ?? ''} ${u.l_name ?? ''}`.trim() || null]));
    let totalCredit = 0;
    let totalDebit = 0;
    const rows = txns.map((t) => {
      const credit = num(t.credit);
      const debit = num(t.debit);
      totalCredit += credit;
      totalDebit += debit;
      return {
        transaction_id: (t.transaction_id as string) ?? `TXN-${Number(t.mysql_id)}`,
        customer: userMap.get(Number(t.mysql_user_id ?? 0)) ?? null,
        credit: r2(credit),
        debit: r2(debit),
        balance: r2(num(t.balance)),
        transaction_type: String(t.transaction_type ?? '—'),
        reference: (t.reference as string) ?? (t.mysql_order_id != null ? String(t.mysql_order_id) : '—'),
        created_at: t.created_at ?? null,
      };
    });
    return { total: rows.length, rows, totals: { credit: r2(totalCredit), debit: r2(totalDebit), balance: r2(totalCredit - totalDebit) } };
  }

  /** Comprehensive Admin Earning Report (StackFood-style): earnings + expenses
   *  breakdown, summary cards, and recent earning/subscription/expense txns. */
  async adminEarningDetailed(_opts: ReportFilterOpts = {}) {
    const empty = { summary: { total_earnings: 0, total_expenses: 0, net_profit: 0 }, earnings_breakdown: [], expenses_breakdown: [], transactions: { earnings: [], subscription: [], expenses: [] } };
    if (!this.useMongo()) return empty;
    const num = (v: unknown) => (v == null ? 0 : Number(v) || 0);
    const r2 = (n: number) => Math.round(n * 100) / 100;

    const orders = await this.mongo.findMany<Record<string, unknown>>('orders', { order_status: 'delivered' }, { sort: { mysql_id: -1 }, limit: 1000 });
    const restIds = Array.from(new Set(orders.map((o) => Number(o.mysql_restaurant_id ?? 0)).filter((n) => n > 0)));
    const rests = restIds.length ? await this.mongo.findMany<{ mysql_id: number; name?: string; comission?: number }>('restaurants', { mysql_id: { $in: restIds } }) : [];
    const restMap = new Map(rests.map((r) => [Number(r.mysql_id), r]));

    let orderCommission = 0, additionalCharge = 0, deliveryCharge = 0, couponExp = 0, prodDiscExp = 0;
    const earningTxns: Array<Record<string, unknown>> = [];
    const expenseTxns: Array<Record<string, unknown>> = [];
    for (const o of orders) {
      const orderAmount = num(o.order_amount), tax = num(o.total_tax_amount), delivery = num(o.delivery_charge);
      const coupon = num(o.coupon_discount_amount), restDiscount = num(o.restaurant_discount_amount), extra = num(o.additional_charge);
      let itemAmount = r2(orderAmount + coupon + restDiscount - tax - delivery - extra);
      if (itemAmount <= 0) itemAmount = r2(Math.max(0, orderAmount - tax - delivery)) || orderAmount;
      const rest = restMap.get(Number(o.mysql_restaurant_id ?? 0));
      const commission = r2((itemAmount * (num(rest?.comission) || 10)) / 100);
      orderCommission += commission; additionalCharge += extra; deliveryCharge += delivery; couponExp += coupon; prodDiscExp += restDiscount;
      const oid = Number(o.mysql_id);
      if (commission > 0) earningTxns.push({ txn_id: `TXN ${oid}`, date: o.created_at ?? null, source: rest?.name ?? null, source_type: 'Restaurant', earning_source: `#ORD ${oid}`, amount: commission });
      if (coupon > 0) expenseTxns.push({ txn_id: `TXN ${oid}`, date: o.created_at ?? null, source: rest?.name ?? null, source_type: 'Coupon', earning_source: `#ORD ${oid}`, amount: coupon });
    }

    const subs = await this.mongo.findMany<Record<string, unknown>>('subscriptions', {}, { sort: { mysql_id: -1 }, limit: 500 });
    const subVendorIds = Array.from(new Set(subs.map((s) => Number(s.vendor_id ?? 0)).filter((n) => n > 0)));
    const subRests = subVendorIds.length ? await this.mongo.findMany<{ name?: string; mysql_vendor_id?: number }>('restaurants', { mysql_vendor_id: { $in: subVendorIds } }) : [];
    const subRestByVendor = new Map(subRests.map((r) => [Number(r.mysql_vendor_id ?? 0), r.name ?? null]));
    const subscriptionEarning = subs.reduce((s, x) => s + num(x.amount), 0);
    const subscriptionTxns = subs.map((s) => ({ txn_id: (s.transaction_id as string) ?? `SUB ${Number(s.mysql_id)}`, date: s.started_at ?? s.created_at ?? null, source: subRestByVendor.get(Number(s.vendor_id ?? 0)) ?? null, source_type: 'Subscription', earning_source: 'Subscription', amount: num(s.amount) }));

    const walletAgg = await this.mongo.aggregate<{ _id: string; total: number }>('wallet_transactions', [
      { $group: { _id: '$transaction_type', total: { $sum: { $toDouble: { $ifNull: ['$credit', 0] } } } } },
    ]).catch(() => [] as Array<{ _id: string; total: number }>);
    const walletMap = new Map(walletAgg.map((w) => [w._id, w.total]));
    const cashback = r2(walletMap.get('cashback') ?? 0);
    const addFundBonus = 0;

    orderCommission = r2(orderCommission); additionalCharge = r2(additionalCharge); couponExp = r2(couponExp); prodDiscExp = r2(prodDiscExp);
    const deliveryFeeCommission = 0;
    const totalEarnings = r2(orderCommission + subscriptionEarning + additionalCharge + deliveryFeeCommission);
    const totalExpenses = r2(couponExp + prodDiscExp + cashback + addFundBonus);
    const netProfit = r2(totalEarnings - totalExpenses);
    const pct = (a: number, t: number) => (t ? r2((a / t) * 100) : 0);

    return {
      summary: { total_earnings: totalEarnings, total_expenses: totalExpenses, net_profit: netProfit },
      earnings_breakdown: [
        { label: 'Order Commission', amount: orderCommission, pct: pct(orderCommission, totalEarnings) },
        { label: 'Subscription Packages', amount: r2(subscriptionEarning), pct: pct(subscriptionEarning, totalEarnings) },
        { label: 'Additional Charge', amount: additionalCharge, pct: pct(additionalCharge, totalEarnings) },
        { label: 'Delivery Fee Commission', amount: deliveryFeeCommission, pct: 0 },
        { label: 'Expense Charge', amount: 0, pct: 0 },
      ],
      expenses_breakdown: [
        { label: 'Coupon Offers', amount: couponExp, pct: pct(couponExp, totalExpenses) },
        { label: 'Discount on Product', amount: prodDiscExp, pct: pct(prodDiscExp, totalExpenses) },
        { label: 'Free Delivery Costs', amount: 0, pct: 0 },
        { label: 'Cashback', amount: cashback, pct: pct(cashback, totalExpenses) },
        { label: 'Add Fund Bonus', amount: addFundBonus, pct: 0 },
      ],
      transactions: { earnings: earningTxns.slice(0, 200), subscription: subscriptionTxns, expenses: expenseTxns.slice(0, 200) },
    };
  }

  /** Restaurant Earning Report — Recent Transactions (StackFood-style):
   *  per-order restaurant earnings (net take), commission expenses, and
   *  subscription transactions. */
  async restaurantEarningDetailed(opts: ReportFilterOpts = {}) {
    const empty = { transactions: { earnings: [], expenses: [], subscription: [] } };
    if (!this.useMongo()) return empty;
    const num = (v: unknown) => (v == null ? 0 : Number(v) || 0);
    const r2 = (n: number) => Math.round(n * 100) / 100;

    const orders = await this.mongo.findMany<Record<string, unknown>>('orders', orderReportMatch(opts), { sort: { mysql_id: -1 }, limit: 1000 });
    const restIds = Array.from(new Set(orders.map((o) => Number(o.mysql_restaurant_id ?? 0)).filter((n) => n > 0)));
    const rests = restIds.length ? await this.mongo.findMany<{ mysql_id: number; name?: string; comission?: number }>('restaurants', { mysql_id: { $in: restIds } }) : [];
    const restMap = new Map(rests.map((r) => [Number(r.mysql_id), r]));

    const earnings: Array<Record<string, unknown>> = [];
    const expenses: Array<Record<string, unknown>> = [];
    for (const o of orders) {
      const orderAmount = num(o.order_amount), tax = num(o.total_tax_amount), delivery = num(o.delivery_charge);
      const coupon = num(o.coupon_discount_amount), restDiscount = num(o.restaurant_discount_amount), extra = num(o.additional_charge);
      let itemAmount = r2(orderAmount + coupon + restDiscount - tax - delivery - extra);
      if (itemAmount <= 0) itemAmount = r2(Math.max(0, orderAmount - tax - delivery)) || orderAmount;
      const rest = restMap.get(Number(o.mysql_restaurant_id ?? 0));
      const commission = r2((itemAmount * (num(rest?.comission) || 10)) / 100);
      const restaurantTake = r2(itemAmount - commission);
      const oid = Number(o.mysql_id);
      if (restaurantTake > 0) earnings.push({ txn_id: `TXN ${oid}`, date: o.created_at ?? null, source: rest?.name ?? null, source_type: 'Restaurant', earning_source: `#ORD ${oid}`, amount: restaurantTake });
      if (commission > 0) expenses.push({ txn_id: `TXN ${oid}`, date: o.created_at ?? null, source: rest?.name ?? null, source_type: 'Restaurant', expense_type: 'Commission Paid', earning_source: `#ORD ${oid}`, amount: commission });
    }

    const subs = await this.mongo.findMany<Record<string, unknown>>('subscriptions', {}, { sort: { mysql_id: -1 }, limit: 500 });
    const subVendorIds = Array.from(new Set(subs.map((s) => Number(s.vendor_id ?? 0)).filter((n) => n > 0)));
    const subRests = subVendorIds.length ? await this.mongo.findMany<{ name?: string; mysql_vendor_id?: number }>('restaurants', { mysql_vendor_id: { $in: subVendorIds } }) : [];
    const subRestByVendor = new Map(subRests.map((r) => [Number(r.mysql_vendor_id ?? 0), r.name ?? null]));
    const subscription = subs.map((s) => {
      const status = String(s.status ?? '');
      const isRenew = num(s.is_trial) === 0 && (status === 'active' || num(s.canceled) === 0);
      return {
        txn_id: (s.transaction_id as string) ?? `SUB ${Number(s.mysql_id)}`,
        date: s.started_at ?? s.created_at ?? null,
        restaurant: subRestByVendor.get(Number(s.vendor_id ?? 0)) ?? null,
        transaction_type: isRenew ? 'Renew Subscription' : 'New Subscription',
        amount: num(s.amount),
      };
    });

    return { transactions: { earnings: earnings.slice(0, 300), expenses: expenses.slice(0, 300), subscription } };
  }

  async restaurantEarnings(limit = 10, opts: ReportFilterOpts = {}) {
    if (this.useMongo()) {
      const rows = await this.mongo.aggregate<{
        _id: number;
        revenue: number;
        orders: number;
        restaurant?: { mysql_id: number; name: string | null; comission: number | null } | null;
      }>('orders', [
        { $match: orderReportMatch(opts) },
        {
          $group: {
            _id: '$mysql_restaurant_id',
            revenue: { $sum: '$order_amount' },
            orders: { $sum: 1 },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: 'restaurants',
            localField: '_id',
            foreignField: 'mysql_id',
            as: 'restaurant',
          },
        },
        { $unwind: { path: '$restaurant', preserveNullAndEmptyArrays: true } },
      ]);
      return {
        top_earners: rows.map((g) => {
          const revenue = Number(g.revenue ?? 0);
          const commission =
            g.restaurant && g.restaurant.comission !== null && g.restaurant.comission !== undefined
              ? Number(g.restaurant.comission)
              : 0;
          return {
            restaurant_id: Number(g._id),
            name: g.restaurant?.name ?? null,
            orders: Number(g.orders ?? 0),
            revenue,
            admin_commission: revenue * (commission / 100),
            restaurant_take: revenue * (1 - commission / 100),
          };
        }),
      };
    }
    const groups = await this.prisma.orders.groupBy({
      by: ['restaurant_id'],
      where: { order_status: 'delivered', payment_status: 'paid' },
      _sum: { order_amount: true },
      _count: { _all: true },
      orderBy: { _sum: { order_amount: 'desc' } },
      take: limit,
    });
    const restaurantIds = groups.map((g) => g.restaurant_id);
    const restaurants = restaurantIds.length
      ? await this.prisma.restaurants.findMany({
          where: { id: { in: restaurantIds } },
          select: { id: true, name: true, comission: true },
        })
      : [];
    const map = new Map(restaurants.map((r) => [String(r.id), r]));
    return {
      top_earners: groups.map((g) => {
        const r = map.get(String(g.restaurant_id));
        const revenue = Number(g._sum.order_amount ?? 0);
        const commission = r?.comission !== null && r?.comission !== undefined ? Number(r.comission) : 0;
        return {
          restaurant_id: Number(g.restaurant_id),
          name: r?.name ?? null,
          orders: g._count._all,
          revenue,
          admin_commission: revenue * (commission / 100),
          restaurant_take: revenue * (1 - commission / 100),
        };
      }),
    };
  }

  /** Best-selling foods by units sold + revenue, over delivered+paid orders.
   *  Joins order_details to the matched orders so the same date/zone/restaurant
   *  filters as every other report apply. */
  async topFoods(limit = 50, opts: ReportFilterOpts = {}) {
    if (this.useMongo()) {
      const rows = await this.mongo.aggregate<{
        _id: number;
        units_sold: number;
        revenue: number;
        food?: { mysql_id: number; name: string | null; mysql_restaurant_id?: number | null } | null;
      }>('orders', [
        { $match: orderReportMatch(opts) },
        {
          $lookup: {
            from: 'order_details',
            localField: 'mysql_id',
            foreignField: 'order_id',
            as: 'items',
          },
        },
        { $unwind: '$items' },
        { $match: { 'items.food_id': { $ne: null } } },
        {
          $group: {
            _id: '$items.food_id',
            units_sold: { $sum: '$items.quantity' },
            revenue: { $sum: { $multiply: [{ $ifNull: ['$items.price', 0] }, { $ifNull: ['$items.quantity', 0] }] } },
          },
        },
        { $sort: { units_sold: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: 'foods',
            localField: '_id',
            foreignField: 'mysql_id',
            as: 'food',
          },
        },
        { $unwind: { path: '$food', preserveNullAndEmptyArrays: true } },
      ]);
      return {
        top_foods: rows.map((g) => ({
          food_id: g._id !== null && g._id !== undefined ? Number(g._id) : null,
          name: g.food?.name ?? null,
          restaurant_id: g.food?.mysql_restaurant_id ? Number(g.food.mysql_restaurant_id) : null,
          units_sold: Number(g.units_sold ?? 0),
          revenue: Number(g.revenue ?? 0),
        })),
      };
    }
    return { top_foods: [] };
  }
}

// ────────────────────────────────────────────────────────────────────────
// Extended admin clusters appended below via prototype-style methods.
// Kept in one class for simplicity; sectioned by comment banners.
// ────────────────────────────────────────────────────────────────────────

declare module './admin.service' {
  interface AdminService {
    // — Catalog extras —
    listAddOns(opts: ListOpts & { restaurantId?: number }): Promise<unknown>;
    createAddOn(body: { name: string; price: number; restaurant_id: number; addon_category_id?: number }): Promise<unknown>;
    updateAddOn(id: number, body: { name?: string; price?: number; addon_category_id?: number; stock_type?: string; addon_stock?: number }): Promise<unknown>;
    updateAddOnStatus(id: number, status: boolean): Promise<unknown>;
    deleteAddOn(id: number): Promise<unknown>;
    listAddonCategories(opts: ListOpts): Promise<unknown>;
    createAddonCategory(body: { name: string }): Promise<unknown>;
    updateAddonCategory(id: number, body: { name?: string }): Promise<unknown>;
    updateAddonCategoryStatus(id: number, status: boolean): Promise<unknown>;
    deleteAddonCategory(id: number): Promise<unknown>;
    listAttributes(): Promise<unknown>;
    createAttribute(body: { name: string }): Promise<unknown>;
    updateAttribute(id: number, body: { name?: string }): Promise<unknown>;
    deleteAttribute(id: number): Promise<unknown>;
    // — Marketing —
    listCampaigns(opts: ListOpts & { type?: string }): Promise<unknown>;
    createCampaign(body: { title: string; description?: string; start_date?: string; end_date?: string; start_time?: string; end_time?: string; image?: string | null; zone_id?: number | null; campaign_type?: string; food_id?: number | null; restaurant_id?: number | null; price?: number | null; discount?: number | null; discount_type?: string }): Promise<unknown>;
    updateCampaign(id: number, body: { title?: string; description?: string; start_date?: string; end_date?: string; start_time?: string; end_time?: string; image?: string | null; zone_id?: number | null; status?: boolean }): Promise<unknown>;
    updateCampaignStatus(id: number, status: boolean): Promise<unknown>;
    deleteCampaign(id: number): Promise<unknown>;
    listAdvertisements(opts: ListOpts): Promise<unknown>;
    createAdvertisement(body: {
      title?: string; description?: string; add_type?: string; restaurant_id?: number | null;
      priority?: number; start_date?: string; end_date?: string; image?: string | null; cover_image?: string | null;
      is_paid?: boolean | string; amount?: number | string;
    }): Promise<unknown>;
    updateAdvertisementStatus(id: number, status: 'approved' | 'denied' | 'pending' | 'paused' | 'expired' | 'running'): Promise<unknown>;
    deleteAdvertisement(id: number): Promise<unknown>;
    listCashBacks(): Promise<unknown>;
    createCashBack(body: {
      title?: string; customer_id?: number | string | null; cashback_type?: string;
      cashback_amount?: number; min_purchase?: number; max_discount?: number;
      start_date?: string; end_date?: string; limit?: number;
    }): Promise<unknown>;
    updateCashBackStatus(id: number, status: boolean): Promise<unknown>;
    deleteCashBack(id: number): Promise<unknown>;
    listWalletBonuses(): Promise<unknown>;
    createWalletBonus(body: {
      title: string;
      bonus_type: string;
      bonus_amount: number;
      minimum_add_amount?: number;
      maximum_bonus_amount?: number;
      start_date?: string;
      end_date?: string;
    }): Promise<unknown>;
    updateWalletBonusStatus(id: number, status: boolean): Promise<unknown>;
    deleteWalletBonus(id: number): Promise<unknown>;
    // — Finance —
    listAccountTransactions(opts: ListOpts): Promise<unknown>;
    listWalletTransactions(opts: ListOpts): Promise<unknown>;
    listLoyaltyPointTransactions(opts: ListOpts): Promise<unknown>;
    listCashbackHistories(opts: ListOpts): Promise<unknown>;
    listDisbursements(opts: ListOpts & { type?: string }): Promise<unknown>;
    updateDisbursementStatus(id: number, status: string): Promise<unknown>;
    listWithdrawRequests(opts: ListOpts & { type?: string; approved?: boolean }): Promise<unknown>;
    approveWithdrawRequest(id: number, approve: boolean): Promise<unknown>;
    listWithdrawalMethods(): Promise<unknown>;
    listOfflinePaymentMethods(): Promise<unknown>;
    createOfflinePaymentMethod(body: { method_name?: string; method_fields?: string; method_informations?: string }): Promise<unknown>;
    updateOfflinePaymentMethod(id: number, body: { method_name?: string; method_fields?: string; method_informations?: string; status?: number }): Promise<unknown>;
    updateOfflinePaymentMethodStatus(id: number, status: number): Promise<unknown>;
    deleteOfflinePaymentMethod(id: number): Promise<unknown>;
    listProvideDMEarnings(opts: ListOpts): Promise<unknown>;
    // — Content / comm —
    listContactMessages(opts: ListOpts): Promise<unknown>;
    replyContactMessage(id: number, reply: string): Promise<unknown>;
    listNotifications(opts: ListOpts): Promise<unknown>;
    createNotification(body: { title: string; description?: string; tergat?: string; zone_id?: number | null; image?: string | null }): Promise<unknown>;
    updateNotification(id: number, body: { title?: string; description?: string; tergat?: string; zone_id?: number | null; image?: string | null }): Promise<unknown>;
    updateNotificationStatus(id: number, status: boolean): Promise<unknown>;
    deleteNotification(id: number): Promise<unknown>;
    listReviews(opts: ListOpts): Promise<unknown>;
    replyReview(id: number, reply: string): Promise<unknown>;
    listDMReviews(opts: ListOpts): Promise<unknown>;
    listFAQs(): Promise<unknown>;
    createFAQ(body: { question: string; answer: string; page_type?: string; user_type?: string }): Promise<unknown>;
    updateFAQ(id: number, body: { question?: string; answer?: string; status?: boolean }): Promise<unknown>;
    deleteFAQ(id: number): Promise<unknown>;
    listPageSeo(): Promise<unknown>;
    upsertPageSeo(body: { page_name: string; title: string; description: string; status?: boolean }): Promise<unknown>;
    listSocialMedia(): Promise<unknown>;
    createSocialMedia(body: { name: string; link: string }): Promise<unknown>;
    updateSocialMediaStatus(id: number, status: boolean): Promise<unknown>;
    deleteSocialMedia(id: number): Promise<unknown>;
    // — System config —
    listEmployees(opts: ListOpts): Promise<unknown>;
    getEmployee(id: number): Promise<unknown>;
    createEmployee(body: {
      f_name?: string; l_name?: string; email?: string; phone?: string;
      password?: string; role_id?: number; zone_id?: number | null; image?: string;
    }): Promise<unknown>;
    updateEmployee(id: number, body: {
      f_name?: string; l_name?: string; email?: string; phone?: string;
      password?: string; role_id?: number; zone_id?: number | null; image?: string;
    }): Promise<unknown>;
    deleteEmployee(id: number): Promise<unknown>;
    listAdminRoles(): Promise<unknown>;
    createAdminRole(body: { name: string; modules?: string }): Promise<unknown>;
    updateAdminRole(id: number, body: { name?: string; modules?: string; status?: boolean }): Promise<unknown>;
    deleteAdminRole(id: number): Promise<unknown>;
    listSubscriptionPackages(): Promise<unknown>;
    createSubscriptionPackage(body: { package_name: string; price: number; validity: number; max_order?: string; max_product?: string; pos?: boolean; mobile_app?: boolean; chat?: boolean; review?: boolean; self_delivery?: boolean; default?: boolean }): Promise<unknown>;
    getSubscriptionPackage(id: number): Promise<unknown>;
    updateSubscriptionPackage(id: number, body: Record<string, unknown>): Promise<unknown>;
    updateSubscriptionPackageStatus(id: number, status: boolean): Promise<unknown>;
    deleteSubscriptionPackage(id: number): Promise<unknown>;
    listShifts(): Promise<unknown>;
    createShift(body: { name: string; start_time?: string; end_time?: string; is_full_day?: boolean }): Promise<unknown>;
    updateShiftStatus(id: number, status: boolean): Promise<unknown>;
    deleteShift(id: number): Promise<unknown>;
    listVehicles(): Promise<unknown>;
    createVehicle(body: { type: string; starting_coverage_area?: number; maximum_coverage_area?: number; extra_charges?: number }): Promise<unknown>;
    updateVehicleStatus(id: number, status: boolean): Promise<unknown>;
    deleteVehicle(id: number): Promise<unknown>;
    listOrderCancelReasons(): Promise<unknown>;
    createOrderCancelReason(body: { reason: string; user_type: string }): Promise<unknown>;
    updateOrderCancelReasonStatus(id: number, status: boolean): Promise<unknown>;
    deleteOrderCancelReason(id: number): Promise<unknown>;
    listRefundReasons(): Promise<unknown>;
    createRefundReason(body: { reason: string }): Promise<unknown>;
    deleteRefundReason(id: number): Promise<unknown>;
    listRefunds(opts: ListOpts): Promise<unknown>;
    updateRefundStatus(id: number, status: string, admin_note?: string): Promise<unknown>;
    listCurrencies(): Promise<unknown>;
    listTags(): Promise<unknown>;
    listTranslations(opts: ListOpts): Promise<unknown>;
    // — Reports —
    adminEarningReport(days: number, opts?: ReportFilterOpts): Promise<unknown>;
    customerReport(limit: number, opts?: ReportFilterOpts): Promise<unknown>;
    deliverymanEarningReport(limit: number, opts?: ReportFilterOpts): Promise<unknown>;
  }
}

export interface ListOpts {
  limit?: number;
  offset?: number;
  q?: string;
}

function bigToNumber<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  for (const k of Object.keys(out)) {
    if (typeof out[k] === 'bigint') out[k] = Number(out[k]);
  }
  return out as T;
}

function paginate<T>(rows: T[], total: number, limit: number, offset: number) {
  return { total, limit, offset, items: rows };
}

/** Read a foreign key that may be stored under either the `mysql_<x>_id`
 *  (seeded) or plain `<x>_id` (migrated) name. */
function readFk(row: Record<string, unknown>, key: string): number | null {
  const a = row[`mysql_${key}`];
  const b = row[key];
  const v = a !== undefined && a !== null ? a : b;
  return v !== undefined && v !== null ? Number(v) : null;
}

/** Batch-resolve a Map<mysqlId, label> for a set of ids in a collection, so
 *  list endpoints can show real names instead of "#undefined". */
async function nameMapFor(
  mongo: MongoDataService,
  collection: string,
  ids: Array<number | null>,
  fmt: (row: Record<string, unknown>) => string,
): Promise<Map<number, string>> {
  const unique = Array.from(new Set(ids.filter((x): x is number => x !== null && Number.isFinite(x))));
  if (unique.length === 0) return new Map();
  const rows = await mongo.findMany<Record<string, unknown>>(collection, { mysql_id: { $in: unique } });
  return new Map(rows.map((r) => [Number(r.mysql_id), fmt(r)]));
}

/** Build a "First Last" label from a row, falling back to phone/email/—. */
function personLabel(r: Record<string, unknown>): string {
  const name = `${r.f_name ?? ''} ${r.l_name ?? ''}`.trim();
  return name || (r.name as string) || (r.phone as string) || (r.email as string) || '—';
}

export interface ReportFilterOpts { from?: string; to?: string; zoneId?: number; restaurantId?: number }

/** Mongo $match for delivered+paid orders, optionally constrained by a date
 *  range / zone / restaurant — shared by every order-aggregating report. */
function orderReportMatch(opts: ReportFilterOpts = {}): Record<string, unknown> {
  const match: Record<string, unknown> = { order_status: 'delivered', payment_status: 'paid' };
  if (opts.from || opts.to) {
    const range: Record<string, unknown> = {};
    if (opts.from) range.$gte = new Date(opts.from);
    if (opts.to) range.$lte = new Date(`${opts.to}T23:59:59.999Z`);
    match.delivered = range;
  }
  if (opts.zoneId) match.mysql_zone_id = Number(opts.zoneId);
  if (opts.restaurantId) match.mysql_restaurant_id = Number(opts.restaurantId);
  return match;
}

// ── Catalog extras ───────────────────────────────────────────────────────

AdminService.prototype.listAddOns = async function (this: AdminService, opts: ListOpts & { restaurantId?: number }) {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  if (this['useMongo']()) {
    const filter: Record<string, unknown> = {};
    if (opts.restaurantId) filter.restaurant_id = Number(opts.restaurantId);
    if (opts.q) filter.name = { $regex: opts.q, $options: 'i' };
    const [rows, total] = await Promise.all([
      this['mongo'].findMany<Record<string, unknown>>('add_ons', filter, {
        limit,
        skip: offset,
        sort: { mysql_id: -1 },
      }),
      this['mongo'].count('add_ons', filter),
    ]);
    return paginate(
      rows.map((r) => ({
        ...r,
        id: Number(r.mysql_id),
        // Migrated DECIMAL prices arrive as decimal.js objects → Number()=NaN.
        price: toNum(r.price),
      })),
      total,
      limit,
      offset,
    );
  }
  const where: Record<string, unknown> = {};
  if (opts.restaurantId) where.restaurant_id = BigInt(opts.restaurantId);
  if (opts.q) (where as { name: unknown }).name = { contains: opts.q };
  const [rows, total] = await Promise.all([
    this['prisma'].add_ons.findMany({ where, orderBy: { id: 'desc' }, take: limit, skip: offset }),
    this['prisma'].add_ons.count({ where }),
  ]);
  return paginate(rows.map((r) => ({ ...bigToNumber(r), price: Number(r.price) })), total, limit, offset);
};

AdminService.prototype.createAddOn = async function (this: AdminService, body) {
  if (!body.name || typeof body.price !== 'number' || !body.restaurant_id) {
    throw new BadRequestException({ errors: [{ code: 'body', message: 'name, price, restaurant_id required' }] });
  }
  if (this['useMongo']()) {
    const mysqlId = await this['mongo'].nextMysqlId('add_ons');
    await this['mongo'].insertOne('add_ons', {
      mysql_id: mysqlId,
      name: body.name,
      price: body.price,
      restaurant_id: Number(body.restaurant_id),
      addon_category_id: body.addon_category_id ? Number(body.addon_category_id) : null,
      status: true,
      created_at: new Date(),
      updated_at: new Date(),
    });
    return { ok: true, id: mysqlId };
  }
  const created = await this['prisma'].add_ons.create({
    data: {
      name: body.name,
      price: body.price,
      restaurant_id: BigInt(body.restaurant_id),
      addon_category_id: body.addon_category_id ? BigInt(body.addon_category_id) : null,
    },
  });
  return { ok: true, id: Number(created.id) };
};

AdminService.prototype.updateAddOn = async function (this: AdminService, id, body) {
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.price !== undefined) data.price = Number(body.price);
  if (body.addon_category_id !== undefined) {
    data.mysql_addon_category_id = Number(body.addon_category_id);
    data.addon_category_id = Number(body.addon_category_id);
  }
  if (body.stock_type !== undefined) data.stock_type = body.stock_type;
  if (body.addon_stock !== undefined) data.addon_stock = Number(body.addon_stock);
  if (Object.keys(data).length === 0) throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields to update' }] });
  if (this['useMongo']()) {
    const a = await this['mongo'].findByMysqlId<{ mysql_id: number }>('add_ons', Number(id));
    if (!a) throw new NotFoundException({ errors: [{ code: 'add_on', message: 'Add-on not found' }] });
    data.updated_at = new Date();
    await this['mongo'].updateOne('add_ons', { mysql_id: Number(id) }, data);
    return { ok: true, id };
  }
  const a = await this['prisma'].add_ons.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!a) throw new NotFoundException({ errors: [{ code: 'add_on', message: 'Add-on not found' }] });
  await this['prisma'].add_ons.update({ where: { id: a.id }, data: data as never });
  return { ok: true, id };
};

AdminService.prototype.updateAddOnStatus = async function (this: AdminService, id, status) {
  if (this['useMongo']()) {
    const a = await this['mongo'].findByMysqlId<{ mysql_id: number }>('add_ons', id);
    if (!a) throw new NotFoundException({ errors: [{ code: 'add_on', message: 'Add-on not found' }] });
    await this['mongo'].updateOne('add_ons', { mysql_id: Number(id) }, { status, updated_at: new Date() });
    return { ok: true, id, status };
  }
  const a = await this['prisma'].add_ons.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!a) throw new NotFoundException({ errors: [{ code: 'add_on', message: 'Add-on not found' }] });
  await this['prisma'].add_ons.update({ where: { id: a.id }, data: { status } });
  return { ok: true, id, status };
};

AdminService.prototype.deleteAddOn = async function (this: AdminService, id) {
  if (this['useMongo']()) {
    const a = await this['mongo'].findByMysqlId<{ mysql_id: number }>('add_ons', id);
    if (!a) throw new NotFoundException({ errors: [{ code: 'add_on', message: 'Add-on not found' }] });
    await this['mongo'].deleteOne('add_ons', { mysql_id: Number(id) });
    return { ok: true, id };
  }
  const a = await this['prisma'].add_ons.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!a) throw new NotFoundException({ errors: [{ code: 'add_on', message: 'Add-on not found' }] });
  await this['prisma'].add_ons.delete({ where: { id: a.id } });
  return { ok: true, id };
};

AdminService.prototype.listAddonCategories = async function (this: AdminService, opts) {
  const limit = opts.limit ?? 100;
  const offset = opts.offset ?? 0;
  if (this['useMongo']()) {
    const filter: Record<string, unknown> = {};
    if (opts.q) filter.name = { $regex: opts.q, $options: 'i' };
    const [mrows, mtotal] = await Promise.all([
      this['mongo'].findMany<Record<string, unknown>>('addon_categories', filter, { limit, skip: offset, sort: { mysql_id: -1 } }),
      this['mongo'].count('addon_categories', filter),
    ]);
    return paginate(mrows.map((r) => ({ ...r, id: Number(r.mysql_id) })), mtotal, limit, offset);
  }
  const [rows, total] = await Promise.all([
    this['prisma'].addon_categories.findMany({
      where: opts.q ? { name: { contains: opts.q } } : undefined,
      orderBy: { id: 'desc' },
      take: limit,
      skip: offset,
    }),
    this['prisma'].addon_categories.count({ where: opts.q ? { name: { contains: opts.q } } : undefined }),
  ]);
  return paginate(rows.map((r) => bigToNumber(r)), total, limit, offset);
};

AdminService.prototype.createAddonCategory = async function (this: AdminService, body) {
  if (!body.name) throw new BadRequestException({ errors: [{ code: 'name', message: 'name required' }] });
  if (this['useMongo']()) {
    const mysqlId = await this['mongo'].nextMysqlId('addon_categories');
    await this['mongo'].insertOne('addon_categories', { mysql_id: mysqlId, name: body.name, status: true, created_at: new Date(), updated_at: new Date() });
    return { ok: true, id: mysqlId };
  }
  const created = await this['prisma'].addon_categories.create({ data: { name: body.name } });
  return { ok: true, id: Number(created.id) };
};

AdminService.prototype.updateAddonCategoryStatus = async function (this: AdminService, id, status) {
  if (this['useMongo']()) {
    const c = await this['mongo'].findByMysqlId<{ mysql_id: number }>('addon_categories', id);
    if (!c) throw new NotFoundException({ errors: [{ code: 'addon_category', message: 'not found' }] });
    await this['mongo'].updateOne('addon_categories', { mysql_id: Number(id) }, { status, updated_at: new Date() });
    return { ok: true, id, status };
  }
  const c = await this['prisma'].addon_categories.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!c) throw new NotFoundException({ errors: [{ code: 'addon_category', message: 'not found' }] });
  await this['prisma'].addon_categories.update({ where: { id: c.id }, data: { status } });
  return { ok: true, id, status };
};

AdminService.prototype.deleteAddonCategory = async function (this: AdminService, id) {
  if (this['useMongo']()) {
    const c = await this['mongo'].findByMysqlId<{ mysql_id: number }>('addon_categories', id);
    if (!c) throw new NotFoundException({ errors: [{ code: 'addon_category', message: 'not found' }] });
    await this['mongo'].deleteOne('addon_categories', { mysql_id: Number(id) });
    return { ok: true, id };
  }
  const c = await this['prisma'].addon_categories.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!c) throw new NotFoundException({ errors: [{ code: 'addon_category', message: 'not found' }] });
  await this['prisma'].addon_categories.delete({ where: { id: c.id } });
  return { ok: true, id };
};

AdminService.prototype.updateAddonCategory = async function (this: AdminService, id, body) {
  if (!body.name || !body.name.trim()) throw new BadRequestException({ errors: [{ code: 'name', message: 'name required' }] });
  if (this['useMongo']()) {
    const c = await this['mongo'].findByMysqlId<{ mysql_id: number }>('addon_categories', id);
    if (!c) throw new NotFoundException({ errors: [{ code: 'addon_category', message: 'not found' }] });
    await this['mongo'].updateOne('addon_categories', { mysql_id: Number(id) }, { name: body.name.trim(), updated_at: new Date() });
    return { ok: true, id };
  }
  const c = await this['prisma'].addon_categories.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!c) throw new NotFoundException({ errors: [{ code: 'addon_category', message: 'not found' }] });
  await this['prisma'].addon_categories.update({ where: { id: c.id }, data: { name: body.name.trim() } });
  return { ok: true, id };
};

AdminService.prototype.listAttributes = async function (this: AdminService) {
  if (this['useMongo']()) {
    const rows = await this['mongo'].findMany<Record<string, unknown>>('attributes', {}, { sort: { mysql_id: -1 } });
    return { attributes: rows.map((r) => ({ ...r, id: Number(r.mysql_id) })) };
  }
  const rows = await this['prisma'].attributes.findMany({ orderBy: { id: 'desc' } });
  return { attributes: rows.map((r) => bigToNumber(r)) };
};

AdminService.prototype.createAttribute = async function (this: AdminService, body) {
  if (!body.name) throw new BadRequestException({ errors: [{ code: 'name', message: 'name required' }] });
  if (this['useMongo']()) {
    const mysqlId = await this['mongo'].nextMysqlId('attributes');
    await this['mongo'].insertOne('attributes', { mysql_id: mysqlId, name: body.name, created_at: new Date(), updated_at: new Date() });
    return { ok: true, id: mysqlId };
  }
  const created = await this['prisma'].attributes.create({ data: { name: body.name } });
  return { ok: true, id: Number(created.id) };
};

AdminService.prototype.deleteAttribute = async function (this: AdminService, id) {
  if (this['useMongo']()) {
    const a = await this['mongo'].findByMysqlId<{ mysql_id: number }>('attributes', id);
    if (!a) throw new NotFoundException({ errors: [{ code: 'attribute', message: 'not found' }] });
    await this['mongo'].deleteOne('attributes', { mysql_id: Number(id) });
    return { ok: true, id };
  }
  const a = await this['prisma'].attributes.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!a) throw new NotFoundException({ errors: [{ code: 'attribute', message: 'not found' }] });
  await this['prisma'].attributes.delete({ where: { id: a.id } });
  return { ok: true, id };
};

AdminService.prototype.updateAttribute = async function (this: AdminService, id, body) {
  if (!body.name || !body.name.trim()) throw new BadRequestException({ errors: [{ code: 'name', message: 'name required' }] });
  if (this['useMongo']()) {
    const a = await this['mongo'].findByMysqlId<{ mysql_id: number }>('attributes', id);
    if (!a) throw new NotFoundException({ errors: [{ code: 'attribute', message: 'not found' }] });
    await this['mongo'].updateOne('attributes', { mysql_id: Number(id) }, { name: body.name.trim(), updated_at: new Date() });
    return { ok: true, id };
  }
  const a = await this['prisma'].attributes.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!a) throw new NotFoundException({ errors: [{ code: 'attribute', message: 'not found' }] });
  await this['prisma'].attributes.update({ where: { id: a.id }, data: { name: body.name.trim() } });
  return { ok: true, id };
};

// ── Marketing ────────────────────────────────────────────────────────────

AdminService.prototype.listCampaigns = async function (this: AdminService, opts) {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  if (this['useMongo']()) {
    const filter: Record<string, unknown> = {};
    if (opts.q) filter.title = { $regex: opts.q, $options: 'i' };
    // Basic vs Food campaign filter. Treat missing campaign_type as 'basic'.
    if (opts.type === 'food' || opts.type === 'item') filter.campaign_type = { $in: ['food', 'item'] };
    else if (opts.type === 'basic') filter.campaign_type = { $in: ['basic', null] as unknown[] };
    const [mrows, mtotal] = await Promise.all([
      this['mongo'].findMany<Record<string, unknown>>('campaigns', filter, { limit, skip: offset, sort: { mysql_id: -1 } }),
      this['mongo'].count('campaigns', filter),
    ]);
    return paginate(mrows.map((r) => ({ ...r, id: Number(r.mysql_id), campaign_type: (r.campaign_type as string) ?? 'basic' })), mtotal, limit, offset);
  }
  const where = opts.q ? { title: { contains: opts.q } } : undefined;
  const [rows, total] = await Promise.all([
    this['prisma'].campaigns.findMany({ where, orderBy: { id: 'desc' }, take: limit, skip: offset }),
    this['prisma'].campaigns.count({ where }),
  ]);
  return paginate(rows.map((r) => bigToNumber(r)), total, limit, offset);
};

AdminService.prototype.createCampaign = async function (this: AdminService, body) {
  if (!body.title) throw new BadRequestException({ errors: [{ code: 'title', message: 'title required' }] });
  if (this['useMongo']()) {
    const mysqlId = await this['mongo'].nextMysqlId('campaigns');
    // basic = restaurant-wide promo; food/item = a specific dish on campaign.
    const campaignType = body.campaign_type === 'food' || body.campaign_type === 'item' ? 'food' : 'basic';
    await this['mongo'].insertOne('campaigns', {
      mysql_id: mysqlId,
      title: body.title,
      description: body.description ?? null,
      campaign_type: campaignType,
      mysql_food_id: campaignType === 'food' && body.food_id ? Number(body.food_id) : null,
      food_id: campaignType === 'food' && body.food_id ? Number(body.food_id) : null,
      mysql_restaurant_id: body.restaurant_id ? Number(body.restaurant_id) : null,
      price: body.price !== undefined && body.price !== null ? Number(body.price) : null,
      discount: body.discount !== undefined && body.discount !== null ? Number(body.discount) : null,
      discount_type: body.discount_type ?? 'percent',
      start_date: body.start_date ? new Date(body.start_date) : null,
      end_date: body.end_date ? new Date(body.end_date) : null,
      start_time: body.start_time ?? null,
      end_time: body.end_time ?? null,
      image: body.image ?? null,
      mysql_zone_id: body.zone_id ? Number(body.zone_id) : null,
      status: true,
      created_at: new Date(),
      updated_at: new Date(),
    });
    return { ok: true, id: mysqlId };
  }
  const created = await this['prisma'].campaigns.create({
    data: {
      title: body.title,
      description: body.description,
      start_date: body.start_date ? new Date(body.start_date) : null,
      end_date: body.end_date ? new Date(body.end_date) : null,
    },
  });
  return { ok: true, id: Number(created.id) };
};

AdminService.prototype.updateCampaign = async function (this: AdminService, id, body) {
  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.description !== undefined) data.description = body.description;
  if (body.start_date !== undefined) data.start_date = body.start_date ? new Date(body.start_date) : null;
  if (body.end_date !== undefined) data.end_date = body.end_date ? new Date(body.end_date) : null;
  if (body.start_time !== undefined) data.start_time = body.start_time;
  if (body.end_time !== undefined) data.end_time = body.end_time;
  if (body.image !== undefined && body.image) data.image = body.image;
  if (body.zone_id !== undefined) data.mysql_zone_id = body.zone_id ? Number(body.zone_id) : null;
  if (body.status !== undefined) data.status = body.status;
  if (Object.keys(data).length === 0) throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields to update' }] });
  if (this['useMongo']()) {
    const c = await this['mongo'].findByMysqlId<{ mysql_id: number }>('campaigns', Number(id));
    if (!c) throw new NotFoundException({ errors: [{ code: 'campaign', message: 'not found' }] });
    data.updated_at = new Date();
    await this['mongo'].updateOne('campaigns', { mysql_id: Number(id) }, data);
    return { ok: true, id };
  }
  const c = await this['prisma'].campaigns.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!c) throw new NotFoundException({ errors: [{ code: 'campaign', message: 'not found' }] });
  await this['prisma'].campaigns.update({ where: { id: c.id }, data: { title: body.title, description: body.description } as never });
  return { ok: true, id };
};

AdminService.prototype.updateCampaignStatus = async function (this: AdminService, id, status) {
  if (this['useMongo']()) {
    const c = await this['mongo'].findByMysqlId<{ mysql_id: number }>('campaigns', id);
    if (!c) throw new NotFoundException({ errors: [{ code: 'campaign', message: 'not found' }] });
    await this['mongo'].updateOne('campaigns', { mysql_id: Number(id) }, { status, updated_at: new Date() });
    return { ok: true, id, status };
  }
  const c = await this['prisma'].campaigns.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!c) throw new NotFoundException({ errors: [{ code: 'campaign', message: 'not found' }] });
  await this['prisma'].campaigns.update({ where: { id: c.id }, data: { status } });
  return { ok: true, id, status };
};

AdminService.prototype.deleteCampaign = async function (this: AdminService, id) {
  if (this['useMongo']()) {
    const c = await this['mongo'].findByMysqlId<{ mysql_id: number }>('campaigns', id);
    if (!c) throw new NotFoundException({ errors: [{ code: 'campaign', message: 'not found' }] });
    await this['mongo'].deleteOne('campaigns', { mysql_id: Number(id) });
    return { ok: true, id };
  }
  const c = await this['prisma'].campaigns.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!c) throw new NotFoundException({ errors: [{ code: 'campaign', message: 'not found' }] });
  await this['prisma'].campaigns.delete({ where: { id: c.id } });
  return { ok: true, id };
};

AdminService.prototype.listAdvertisements = async function (this: AdminService, opts) {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  if (this['useMongo']()) {
    const [mrows, mtotal] = await Promise.all([
      this['mongo'].findMany<Record<string, unknown>>('advertisements', {}, { limit, skip: offset, sort: { mysql_id: -1 } }),
      this['mongo'].count('advertisements'),
    ]);
    const restNames = await nameMapFor(this['mongo'], 'restaurants', mrows.map((r) => readFk(r, 'restaurant_id')), (x) => (x.name as string) ?? '—');
    return paginate(mrows.map((r) => {
      const restaurantId = readFk(r, 'restaurant_id');
      return {
        ...r,
        id: Number(r.mysql_id),
        restaurant_id: restaurantId,
        restaurant_name: restaurantId !== null ? (restNames.get(restaurantId) ?? null) : null,
        add_type: (r.add_type as string) ?? (r.type as string) ?? null,
        image_full_url: storageFullUrl('advertisement', (r.image as string | null | undefined) ?? null),
        cover_image_full_url: storageFullUrl('advertisement', (r.cover_image as string | null | undefined) ?? null),
      };
    }), mtotal, limit, offset);
  }
  const [rows, total] = await Promise.all([
    this['prisma'].advertisements.findMany({ orderBy: { id: 'desc' }, take: limit, skip: offset }),
    this['prisma'].advertisements.count(),
  ]);
  return paginate(rows.map((r) => bigToNumber(r)), total, limit, offset);
};

AdminService.prototype.updateAdvertisementStatus = async function (this: AdminService, id, status) {
  if (this['useMongo']()) {
    const a = await this['mongo'].findByMysqlId<{ mysql_id: number }>('advertisements', id);
    if (!a) throw new NotFoundException({ errors: [{ code: 'advertisement', message: 'not found' }] });
    await this['mongo'].updateOne('advertisements', { mysql_id: Number(id) }, { status, updated_at: new Date() });
    return { ok: true, id, status };
  }
  const a = await this['prisma'].advertisements.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!a) throw new NotFoundException({ errors: [{ code: 'advertisement', message: 'not found' }] });
  await this['prisma'].advertisements.update({ where: { id: a.id }, data: { status } });
  return { ok: true, id, status };
};

AdminService.prototype.createAdvertisement = async function (this: AdminService, body) {
  if (!body.title) throw new BadRequestException({ errors: [{ code: 'title', message: 'title required' }] });
  if (this['useMongo']()) {
    const mysqlId = await this['mongo'].nextMysqlId('advertisements');
    const now = new Date();
    await this['mongo'].insertOne('advertisements', {
      mysql_id: mysqlId,
      title: body.title,
      description: body.description ?? null,
      add_type: body.add_type ?? 'restaurant_promotion',
      type: body.add_type ?? 'restaurant_promotion',
      mysql_restaurant_id: body.restaurant_id ? Number(body.restaurant_id) : null,
      restaurant_id: body.restaurant_id ? Number(body.restaurant_id) : null,
      priority: body.priority !== undefined && body.priority !== null ? Number(body.priority) : 0,
      image: body.image ?? null,
      cover_image: body.cover_image ?? null,
      start_date: body.start_date ? new Date(body.start_date) : null,
      end_date: body.end_date ? new Date(body.end_date) : null,
      // Admin-created ads are auto-approved — only vendor/restaurant ads need
      // admin approval (those stay 'pending' from the vendor endpoint).
      status: 'approved',
      created_by_type: 'admin',
      // Paid / unpaid choice + the ad amount when paid.
      is_paid: body.is_paid === true || body.is_paid === 'paid' || body.is_paid === '1',
      amount: (body.is_paid === true || body.is_paid === 'paid' || body.is_paid === '1') ? Math.max(0, Number(body.amount ?? 0)) : 0,
      created_at: now,
      updated_at: now,
    });
    return { ok: true, id: mysqlId };
  }
  throw new BadRequestException({ errors: [{ code: 'config', message: 'Mongo required' }] });
};

AdminService.prototype.deleteAdvertisement = async function (this: AdminService, id) {
  if (this['useMongo']()) {
    const a = await this['mongo'].findByMysqlId<{ mysql_id: number }>('advertisements', Number(id));
    if (!a) throw new NotFoundException({ errors: [{ code: 'advertisement', message: 'not found' }] });
    await this['mongo'].deleteOne('advertisements', { mysql_id: Number(id) });
    return { ok: true, id };
  }
  const a = await this['prisma'].advertisements.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!a) throw new NotFoundException({ errors: [{ code: 'advertisement', message: 'not found' }] });
  await this['prisma'].advertisements.delete({ where: { id: a.id } });
  return { ok: true, id };
};

AdminService.prototype.listCashBacks = async function (this: AdminService) {
  if (this['useMongo']()) {
    const rows = await this['mongo'].findMany<Record<string, unknown>>('cash_backs', {}, { sort: { mysql_id: -1 } });
    return { cash_backs: rows.map((r) => ({ ...r, id: Number(r.mysql_id) })) };
  }
  const rows = await this['prisma'].cash_backs.findMany({ orderBy: { id: 'desc' } });
  return { cash_backs: rows.map((r) => bigToNumber(r)) };
};

AdminService.prototype.createCashBack = async function (this: AdminService, body) {
  if (!body.title || typeof body.cashback_amount !== 'number') {
    throw new BadRequestException({ errors: [{ code: 'body', message: 'title and cashback_amount are required' }] });
  }
  if (this['useMongo']()) {
    const mysqlId = await this['mongo'].nextMysqlId('cash_backs');
    const now = new Date();
    await this['mongo'].insertOne('cash_backs', {
      mysql_id: mysqlId,
      title: body.title,
      customer_id: body.customer_id !== undefined && body.customer_id !== null && body.customer_id !== '' ? String(body.customer_id) : null,
      cashback_type: body.cashback_type ?? 'percentage',
      cashback_amount: Number(body.cashback_amount),
      min_purchase: Number(body.min_purchase ?? 0),
      max_discount: Number(body.max_discount ?? 0),
      start_date: body.start_date ? new Date(body.start_date) : null,
      end_date: body.end_date ? new Date(body.end_date) : null,
      limit: body.limit !== undefined && body.limit !== null ? Number(body.limit) : null,
      status: true,
      created_at: now,
      updated_at: now,
    });
    return { ok: true, id: mysqlId };
  }
  const created = await this['prisma'].cash_backs.create({
    data: {
      title: body.title,
      cashback_type: body.cashback_type ?? 'percentage',
      cashback_amount: Number(body.cashback_amount),
      min_purchase: Number(body.min_purchase ?? 0),
      max_discount: Number(body.max_discount ?? 0),
      start_date: body.start_date ? new Date(body.start_date) : null,
      end_date: body.end_date ? new Date(body.end_date) : null,
    } as never,
  });
  return { ok: true, id: Number(created.id) };
};

AdminService.prototype.updateCashBackStatus = async function (this: AdminService, id, status) {
  if (this['useMongo']()) {
    const c = await this['mongo'].findByMysqlId<{ mysql_id: number }>('cash_backs', Number(id));
    if (!c) throw new NotFoundException({ errors: [{ code: 'cash_back', message: 'Cashback not found' }] });
    await this['mongo'].updateOne('cash_backs', { mysql_id: Number(id) }, { status, updated_at: new Date() });
    return { ok: true, id, status };
  }
  const c = await this['prisma'].cash_backs.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!c) throw new NotFoundException({ errors: [{ code: 'cash_back', message: 'Cashback not found' }] });
  await this['prisma'].cash_backs.update({ where: { id: c.id }, data: { status } });
  return { ok: true, id, status };
};

AdminService.prototype.deleteCashBack = async function (this: AdminService, id) {
  if (this['useMongo']()) {
    const c = await this['mongo'].findByMysqlId<{ mysql_id: number }>('cash_backs', Number(id));
    if (!c) throw new NotFoundException({ errors: [{ code: 'cash_back', message: 'Cashback not found' }] });
    await this['mongo'].deleteOne('cash_backs', { mysql_id: Number(id) });
    return { ok: true, id };
  }
  const c = await this['prisma'].cash_backs.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!c) throw new NotFoundException({ errors: [{ code: 'cash_back', message: 'Cashback not found' }] });
  await this['prisma'].cash_backs.delete({ where: { id: c.id } });
  return { ok: true, id };
};

AdminService.prototype.listWalletBonuses = async function (this: AdminService) {
  if (this['useMongo']()) {
    const rows = await this['mongo'].findMany<Record<string, unknown>>('wallet_bonuses', {}, { sort: { mysql_id: -1 } });
    return { wallet_bonuses: rows.map((r) => ({ ...r, id: Number(r.mysql_id) })) };
  }
  const rows = await this['prisma'].wallet_bonuses.findMany({ orderBy: { id: 'desc' } });
  return { wallet_bonuses: rows.map((r) => bigToNumber(r)) };
};

AdminService.prototype.createWalletBonus = async function (this: AdminService, body) {
  if (!body.title || !body.bonus_type || typeof body.bonus_amount !== 'number') {
    throw new BadRequestException({ errors: [{ code: 'body', message: 'title, bonus_type, bonus_amount required' }] });
  }
  if (this['useMongo']()) {
    const mysqlId = await this['mongo'].nextMysqlId('wallet_bonuses');
    await this['mongo'].insertOne('wallet_bonuses', {
      mysql_id: mysqlId,
      title: body.title,
      bonus_type: body.bonus_type,
      bonus_amount: body.bonus_amount,
      minimum_add_amount: body.minimum_add_amount ?? 0,
      maximum_bonus_amount: body.maximum_bonus_amount ?? 0,
      start_date: body.start_date ? new Date(body.start_date) : null,
      end_date: body.end_date ? new Date(body.end_date) : null,
      status: true,
      created_at: new Date(),
      updated_at: new Date(),
    });
    return { ok: true, id: mysqlId };
  }
  const created = await this['prisma'].wallet_bonuses.create({
    data: {
      title: body.title,
      bonus_type: body.bonus_type,
      bonus_amount: body.bonus_amount,
      minimum_add_amount: body.minimum_add_amount ?? 0,
      maximum_bonus_amount: body.maximum_bonus_amount ?? 0,
      start_date: body.start_date ? new Date(body.start_date) : null,
      end_date: body.end_date ? new Date(body.end_date) : null,
    },
  });
  return { ok: true, id: Number(created.id) };
};

AdminService.prototype.updateWalletBonusStatus = async function (this: AdminService, id, status) {
  if (this['useMongo']()) {
    const b = await this['mongo'].findByMysqlId<{ mysql_id: number }>('wallet_bonuses', id);
    if (!b) throw new NotFoundException({ errors: [{ code: 'wallet_bonus', message: 'not found' }] });
    await this['mongo'].updateOne('wallet_bonuses', { mysql_id: Number(id) }, { status, updated_at: new Date() });
    return { ok: true, id, status };
  }
  const b = await this['prisma'].wallet_bonuses.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!b) throw new NotFoundException({ errors: [{ code: 'wallet_bonus', message: 'not found' }] });
  await this['prisma'].wallet_bonuses.update({ where: { id: b.id }, data: { status } });
  return { ok: true, id, status };
};

AdminService.prototype.deleteWalletBonus = async function (this: AdminService, id) {
  if (this['useMongo']()) {
    const b = await this['mongo'].findByMysqlId<{ mysql_id: number }>('wallet_bonuses', id);
    if (!b) throw new NotFoundException({ errors: [{ code: 'wallet_bonus', message: 'not found' }] });
    await this['mongo'].deleteOne('wallet_bonuses', { mysql_id: Number(id) });
    return { ok: true, id };
  }
  const b = await this['prisma'].wallet_bonuses.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!b) throw new NotFoundException({ errors: [{ code: 'wallet_bonus', message: 'not found' }] });
  await this['prisma'].wallet_bonuses.delete({ where: { id: b.id } });
  return { ok: true, id };
};

// ── Finance ──────────────────────────────────────────────────────────────

AdminService.prototype.listAccountTransactions = async function (this: AdminService, opts) {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  if (this['useMongo']()) {
    const [rows, total] = await Promise.all([
      this['mongo'].findMany<Record<string, unknown>>('account_transactions', {}, {
        limit,
        skip: offset,
        sort: { mysql_id: -1 },
      }),
      this['mongo'].count('account_transactions'),
    ]);
    return paginate(
      rows.map((r) => ({
        ...r,
        id: Number(r.mysql_id),
        from_id: r.from_id !== undefined && r.from_id !== null ? Number(r.from_id) : 0,
        current_balance:
          r.current_balance !== undefined && r.current_balance !== null ? Number(r.current_balance) : 0,
        amount: r.amount !== undefined && r.amount !== null ? Number(r.amount) : 0,
      })),
      total,
      limit,
      offset,
    );
  }
  const [rows, total] = await Promise.all([
    this['prisma'].account_transactions.findMany({ orderBy: { id: 'desc' }, take: limit, skip: offset }),
    this['prisma'].account_transactions.count(),
  ]);
  return paginate(
    rows.map((r) => ({
      ...bigToNumber(r),
      from_id: Number(r.from_id),
      current_balance: Number(r.current_balance),
      amount: Number(r.amount),
    })),
    total,
    limit,
    offset,
  );
};

AdminService.prototype.listWalletTransactions = async function (this: AdminService, opts) {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  if (this['useMongo']()) {
    const [rows, total] = await Promise.all([
      this['mongo'].findMany<Record<string, unknown>>('wallet_transactions', {}, {
        limit,
        skip: offset,
        sort: { mysql_id: -1 },
      }),
      this['mongo'].count('wallet_transactions'),
    ]);
    return paginate(
      rows.map((r) => ({
        ...r,
        id: Number(r.mysql_id),
        credit: r.credit !== undefined && r.credit !== null ? Number(r.credit) : 0,
        debit: r.debit !== undefined && r.debit !== null ? Number(r.debit) : 0,
        balance: r.balance !== undefined && r.balance !== null ? Number(r.balance) : 0,
        admin_bonus: r.admin_bonus !== undefined && r.admin_bonus !== null ? Number(r.admin_bonus) : 0,
      })),
      total,
      limit,
      offset,
    );
  }
  const [rows, total] = await Promise.all([
    this['prisma'].wallet_transactions.findMany({ orderBy: { id: 'desc' }, take: limit, skip: offset }),
    this['prisma'].wallet_transactions.count(),
  ]);
  return paginate(
    rows.map((r) => ({
      ...bigToNumber(r),
      credit: Number(r.credit),
      debit: Number(r.debit),
      balance: Number(r.balance),
      admin_bonus: Number(r.admin_bonus),
    })),
    total,
    limit,
    offset,
  );
};

AdminService.prototype.listLoyaltyPointTransactions = async function (this: AdminService, opts) {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  if (this['useMongo']()) {
    const [rows, total] = await Promise.all([
      this['mongo'].findMany<Record<string, unknown>>('loyalty_point_transactions', {}, {
        limit,
        skip: offset,
        sort: { mysql_id: -1 },
      }),
      this['mongo'].count('loyalty_point_transactions'),
    ]);
    const userNames = await nameMapFor(this['mongo'], 'users', rows.map((r) => readFk(r, 'user_id')), personLabel);
    return paginate(
      rows.map((r) => {
        const userId = readFk(r, 'user_id');
        return {
          ...r,
          id: Number(r.mysql_id),
          user_id: userId,
          user_name: userId !== null ? (userNames.get(userId) ?? null) : null,
          credit: r.credit !== undefined && r.credit !== null ? Number(r.credit) : 0,
          debit: r.debit !== undefined && r.debit !== null ? Number(r.debit) : 0,
          balance: r.balance !== undefined && r.balance !== null ? Number(r.balance) : 0,
        };
      }),
      total,
      limit,
      offset,
    );
  }
  const [rows, total] = await Promise.all([
    this['prisma'].loyalty_point_transactions.findMany({ orderBy: { id: 'desc' }, take: limit, skip: offset }),
    this['prisma'].loyalty_point_transactions.count(),
  ]);
  return paginate(
    rows.map((r) => ({
      ...bigToNumber(r),
      credit: Number(r.credit),
      debit: Number(r.debit),
      balance: Number(r.balance),
    })),
    total,
    limit,
    offset,
  );
};

AdminService.prototype.listCashbackHistories = async function (this: AdminService, opts) {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  if (this['useMongo']()) {
    const [rows, total] = await Promise.all([
      this['mongo'].findMany<Record<string, unknown>>('cash_back_histories', {}, {
        limit,
        skip: offset,
        sort: { mysql_id: -1 },
      }),
      this['mongo'].count('cash_back_histories'),
    ]);
    const userNames = await nameMapFor(this['mongo'], 'users', rows.map((r) => readFk(r, 'user_id')), personLabel);
    return paginate(
      rows.map((r) => {
        const userId = readFk(r, 'user_id');
        const calculated = r.calculated_amount !== undefined && r.calculated_amount !== null ? Number(r.calculated_amount) : 0;
        return {
          ...r,
          id: Number(r.mysql_id),
          user_id: userId,
          order_id: readFk(r, 'order_id'),
          user_name: userId !== null ? (userNames.get(userId) ?? null) : null,
          // The cashback amount equals the calculated amount when not stored separately.
          cashback_amount: r.cashback_amount !== undefined && r.cashback_amount !== null ? Number(r.cashback_amount) : calculated,
          calculated_amount: calculated,
          cashback_type: (r.cashback_type as string) ?? 'cashback',
        };
      }),
      total,
      limit,
      offset,
    );
  }
  const [rows, total] = await Promise.all([
    this['prisma'].cash_back_histories.findMany({ orderBy: { id: 'desc' }, take: limit, skip: offset }),
    this['prisma'].cash_back_histories.count(),
  ]);
  return paginate(rows.map((r) => bigToNumber(r)), total, limit, offset);
};

AdminService.prototype.listDisbursements = async function (this: AdminService, opts) {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  if (this['useMongo']()) {
    // Restaurant disbursements carry a vendor; deliveryman ones a delivery man.
    const filter: Record<string, unknown> = {};
    if (opts.type === 'restaurant') filter.mysql_vendor_id = { $ne: null };
    else if (opts.type === 'deliveryman') filter.mysql_delivery_man_id = { $ne: null };
    const [rows, total] = await Promise.all([
      this['mongo'].findMany<Record<string, unknown>>('disbursements', filter, {
        limit,
        skip: offset,
        sort: { mysql_id: -1 },
      }),
      this['mongo'].count('disbursements', filter),
    ]);
    const vendorNames = await nameMapFor(this['mongo'], 'vendors', rows.map((r) => readFk(r, 'vendor_id')), personLabel);
    const dmNames = await nameMapFor(this['mongo'], 'delivery_men', rows.map((r) => readFk(r, 'delivery_man_id')), personLabel);
    // Restaurant disbursements should show the RESTAURANT name, not the owner's.
    // Resolve restaurant name via the vendor → restaurant link.
    const vendorIds = Array.from(new Set(rows.map((r) => readFk(r, 'vendor_id')).filter((x): x is number => x !== null)));
    const restByVendor = new Map<number, string>();
    if (vendorIds.length) {
      const rests = await this['mongo'].findMany<{ mysql_vendor_id?: number; name?: string }>(
        'restaurants', { mysql_vendor_id: { $in: vendorIds } },
        { projection: { mysql_vendor_id: 1, name: 1 } as Record<string, 0 | 1> },
      );
      for (const rr of rests) {
        if (rr.mysql_vendor_id != null && rr.name) restByVendor.set(Number(rr.mysql_vendor_id), rr.name);
      }
    }
    return paginate(
      rows.map((r) => {
        const vendorId = readFk(r, 'vendor_id');
        const dmId = readFk(r, 'delivery_man_id');
        const isDm = dmId !== null;
        const amount = r.total_amount !== undefined && r.total_amount !== null ? Number(r.total_amount) : 0;
        const status = String(r.status ?? 'pending');
        // Payment-initiated / paid dates. New transitions stamp these exactly;
        // for older rows we fall back to updated/created so the status' implied
        // milestones still show a date instead of a blank.
        const fallback = (r.updated_at as Date | null | undefined) ?? (r.created_at as Date | null | undefined) ?? null;
        const initiatedAt = (r.initiated_at as Date | null | undefined)
          ?? (status === 'processing' || status === 'disbursed' ? fallback : null);
        const paidAt = (r.paid_at as Date | null | undefined)
          ?? (status === 'disbursed' ? fallback : null);
        return {
          ...r,
          id: Number(r.mysql_id),
          vendor_id: vendorId,
          delivery_man_id: dmId,
          // Report reads `amount`/`recipient`; also keep total_amount.
          amount,
          total_amount: amount,
          recipient: isDm
            ? (dmNames.get(dmId) ?? null)
            // Restaurant name first; fall back to the owner/vendor name.
            : (vendorId !== null ? (restByVendor.get(vendorId) ?? vendorNames.get(vendorId) ?? null) : null),
          type: isDm ? 'deliveryman' : 'restaurant',
          payment_method: (r.payment_method as string) ?? 'cash',
          initiated_at: initiatedAt,
          paid_at: paidAt,
        };
      }),
      total,
      limit,
      offset,
    );
  }
  const [rows, total] = await Promise.all([
    this['prisma'].disbursements.findMany({ orderBy: { id: 'desc' }, take: limit, skip: offset }),
    this['prisma'].disbursements.count(),
  ]);
  return paginate(rows.map((r) => bigToNumber(r)), total, limit, offset);
};

AdminService.prototype.updateDisbursementStatus = async function (this: AdminService, id, status) {
  // Allowed states: pending → processing (payment initiated) → disbursed (paid).
  const allowed = ['pending', 'processing', 'disbursed', 'canceled'];
  if (!allowed.includes(status)) {
    throw new BadRequestException({ errors: [{ code: 'status', message: `status must be one of ${allowed.join(', ')}` }] });
  }
  if (this['useMongo']()) {
    const d = await this['mongo'].findByMysqlId<{ mysql_id: number; initiated_at?: Date | null }>('disbursements', Number(id));
    if (!d) throw new NotFoundException({ errors: [{ code: 'disbursement', message: 'not found' }] });
    const now = new Date();
    const data: Record<string, unknown> = { status, updated_at: now };
    // Stamp / clear the milestone dates. Transitions are reversible (admin can
    // un-initiate or mark unpaid in case of miscommunication) so we also clear
    // the dates that no longer apply.
    if (status === 'pending') {
      data.initiated_at = null;
      data.paid_at = null;
    } else if (status === 'processing') {
      if (!d.initiated_at) data.initiated_at = now;
      data.paid_at = null; // un-paid: it is initiated but not yet paid
    } else if (status === 'disbursed') {
      data.paid_at = now;
      if (!d.initiated_at) data.initiated_at = now; // paid directly from pending
    }
    await this['mongo'].updateOne('disbursements', { mysql_id: Number(id) }, data);
    return { ok: true, id, status };
  }
  const d = await this['prisma'].disbursements.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!d) throw new NotFoundException({ errors: [{ code: 'disbursement', message: 'not found' }] });
  await this['prisma'].disbursements.update({ where: { id: d.id }, data: { status } });
  return { ok: true, id, status };
};

AdminService.prototype.listWithdrawRequests = async function (this: AdminService, opts) {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  if (this['useMongo']()) {
    const filter: Record<string, unknown> = {};
    if (opts.type) filter.type = opts.type;
    if (opts.approved !== undefined) filter.approved = opts.approved;
    const [rows, total] = await Promise.all([
      this['mongo'].findMany<Record<string, unknown>>('withdraw_requests', filter, {
        limit,
        skip: offset,
        sort: { mysql_id: -1 },
      }),
      this['mongo'].count('withdraw_requests', filter),
    ]);
    return paginate(
      rows.map((r) => ({
        ...r,
        id: Number(r.mysql_id),
        amount: r.amount !== undefined && r.amount !== null ? Number(r.amount) : 0,
      })),
      total,
      limit,
      offset,
    );
  }
  const where: Record<string, unknown> = {};
  if (opts.type) where.type = opts.type;
  if (opts.approved !== undefined) where.approved = opts.approved;
  const [rows, total] = await Promise.all([
    this['prisma'].withdraw_requests.findMany({ where, orderBy: { id: 'desc' }, take: limit, skip: offset }),
    this['prisma'].withdraw_requests.count({ where }),
  ]);
  return paginate(
    rows.map((r) => ({ ...bigToNumber(r), amount: Number(r.amount) })),
    total,
    limit,
    offset,
  );
};

AdminService.prototype.approveWithdrawRequest = async function (this: AdminService, id, approve) {
  if (this['useMongo']()) {
    const w = await this['mongo'].findByMysqlId<{ mysql_id: number }>('withdraw_requests', Number(id));
    if (!w) throw new NotFoundException({ errors: [{ code: 'withdraw_request', message: 'not found' }] });
    await this['mongo'].updateOne('withdraw_requests', { mysql_id: Number(id) }, { approved: approve, updated_at: new Date() });
    return { ok: true, id, approved: approve };
  }
  const w = await this['prisma'].withdraw_requests.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!w) throw new NotFoundException({ errors: [{ code: 'withdraw_request', message: 'not found' }] });
  await this['prisma'].withdraw_requests.update({ where: { id: w.id }, data: { approved: approve } });
  return { ok: true, id, approved: approve };
};

AdminService.prototype.listWithdrawalMethods = async function (this: AdminService) {
  if (this['useMongo']()) {
    const rows = await this['mongo'].findMany<Record<string, unknown>>('withdrawal_methods', {}, {
      sort: { mysql_id: -1 },
    });
    return {
      withdrawal_methods: rows.map((r) => ({ ...r, id: Number(r.mysql_id) })),
    };
  }
  const rows = await this['prisma'].withdrawal_methods.findMany({ orderBy: { id: 'desc' } });
  return { withdrawal_methods: rows.map((r) => bigToNumber(r)) };
};

AdminService.prototype.listOfflinePaymentMethods = async function (this: AdminService) {
  if (this['useMongo']()) {
    const rows = await this['mongo'].findMany<Record<string, unknown>>('offline_payment_methods', {}, {
      sort: { mysql_id: -1 },
    });
    return {
      offline_payment_methods: rows.map((r) => ({ ...r, id: Number(r.mysql_id) })),
    };
  }
  const rows = await this['prisma'].offline_payment_methods.findMany({ orderBy: { id: 'desc' } });
  return { offline_payment_methods: rows.map((r) => bigToNumber(r)) };
};

AdminService.prototype.createOfflinePaymentMethod = async function (this: AdminService, body) {
  if (!body.method_name || !body.method_name.trim()) {
    throw new BadRequestException({ errors: [{ code: 'method_name', message: 'Method name is required' }] });
  }
  if (!this['useMongo']()) throw new BadRequestException({ errors: [{ code: 'config', message: 'Mongo required' }] });
  const mysqlId = await this['mongo'].nextMysqlId('offline_payment_methods');
  const now = new Date();
  await this['mongo'].insertOne('offline_payment_methods', {
    mysql_id: mysqlId,
    method_name: body.method_name.trim(),
    method_fields: body.method_fields ?? null,
    method_informations: body.method_informations ?? null,
    status: 1,
    created_at: now,
    updated_at: now,
  });
  return { ok: true, id: mysqlId };
};

AdminService.prototype.updateOfflinePaymentMethod = async function (this: AdminService, id, body) {
  if (!this['useMongo']()) throw new BadRequestException({ errors: [{ code: 'config', message: 'Mongo required' }] });
  const m = await this['mongo'].findByMysqlId<{ mysql_id: number }>('offline_payment_methods', Number(id));
  if (!m) throw new NotFoundException({ errors: [{ code: 'method', message: 'not found' }] });
  const data: Record<string, unknown> = {};
  if (body.method_name !== undefined) data.method_name = body.method_name;
  if (body.method_fields !== undefined) data.method_fields = body.method_fields;
  if (body.method_informations !== undefined) data.method_informations = body.method_informations;
  if (body.status !== undefined) data.status = Number(body.status);
  if (Object.keys(data).length === 0) throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields to update' }] });
  data.updated_at = new Date();
  await this['mongo'].updateOne('offline_payment_methods', { mysql_id: Number(id) }, data);
  return { ok: true, id };
};

AdminService.prototype.updateOfflinePaymentMethodStatus = async function (this: AdminService, id, status) {
  if (this['useMongo']()) {
    const m = await this['mongo'].findByMysqlId<{ mysql_id: number }>('offline_payment_methods', Number(id));
    if (!m) throw new NotFoundException({ errors: [{ code: 'method', message: 'not found' }] });
    await this['mongo'].updateOne('offline_payment_methods', { mysql_id: Number(id) }, { status, updated_at: new Date() });
    return { ok: true, id, status };
  }
  const m = await this['prisma'].offline_payment_methods.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!m) throw new NotFoundException({ errors: [{ code: 'method', message: 'not found' }] });
  await this['prisma'].offline_payment_methods.update({ where: { id: m.id }, data: { status } });
  return { ok: true, id, status };
};

AdminService.prototype.deleteOfflinePaymentMethod = async function (this: AdminService, id) {
  if (this['useMongo']()) {
    const m = await this['mongo'].findByMysqlId<{ mysql_id: number }>('offline_payment_methods', Number(id));
    if (!m) throw new NotFoundException({ errors: [{ code: 'method', message: 'not found' }] });
    await this['mongo'].deleteOne('offline_payment_methods', { mysql_id: Number(id) });
    return { ok: true, id };
  }
  const m = await this['prisma'].offline_payment_methods.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!m) throw new NotFoundException({ errors: [{ code: 'method', message: 'not found' }] });
  await this['prisma'].offline_payment_methods.delete({ where: { id: m.id } });
  return { ok: true, id };
};

AdminService.prototype.listProvideDMEarnings = async function (this: AdminService, opts) {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  if (this['useMongo']()) {
    const [rows, total] = await Promise.all([
      this['mongo'].findMany<Record<string, unknown>>('provide_d_m_earnings', {}, {
        limit,
        skip: offset,
        sort: { mysql_id: -1 },
      }),
      this['mongo'].count('provide_d_m_earnings'),
    ]);
    return paginate(
      rows.map((r) => ({
        ...r,
        id: Number(r.mysql_id),
        amount: r.amount !== undefined && r.amount !== null ? Number(r.amount) : 0,
      })),
      total,
      limit,
      offset,
    );
  }
  const [rows, total] = await Promise.all([
    this['prisma'].provide_d_m_earnings.findMany({ orderBy: { id: 'desc' }, take: limit, skip: offset }),
    this['prisma'].provide_d_m_earnings.count(),
  ]);
  return paginate(
    rows.map((r) => ({ ...bigToNumber(r), amount: Number(r.amount) })),
    total,
    limit,
    offset,
  );
};

// ── Content / comm ───────────────────────────────────────────────────────

AdminService.prototype.listContactMessages = async function (this: AdminService, opts) {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  if (this['useMongo']()) {
    const [rows, total] = await Promise.all([
      this['mongo'].findMany<Record<string, unknown>>('contact_messages', {}, {
        limit,
        skip: offset,
        sort: { mysql_id: -1 },
      }),
      this['mongo'].count('contact_messages'),
    ]);
    return paginate(
      rows.map((r) => ({ ...r, id: Number(r.mysql_id) })),
      total,
      limit,
      offset,
    );
  }
  const [rows, total] = await Promise.all([
    this['prisma'].contact_messages.findMany({ orderBy: { id: 'desc' }, take: limit, skip: offset }),
    this['prisma'].contact_messages.count(),
  ]);
  return paginate(rows.map((r) => bigToNumber(r)), total, limit, offset);
};

AdminService.prototype.replyContactMessage = async function (this: AdminService, id, reply) {
  if (!reply) throw new BadRequestException({ errors: [{ code: 'reply', message: 'reply required' }] });
  if (this['useMongo']()) {
    const m = await this['mongo'].findByMysqlId<{ mysql_id: number }>('contact_messages', Number(id));
    if (!m) throw new NotFoundException({ errors: [{ code: 'contact_message', message: 'not found' }] });
    await this['mongo'].updateOne(
      'contact_messages',
      { mysql_id: Number(id) },
      { reply, seen: true, replied: true, updated_at: new Date() },
    );
    return { ok: true, id };
  }
  const m = await this['prisma'].contact_messages.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!m) throw new NotFoundException({ errors: [{ code: 'contact_message', message: 'not found' }] });
  await this['prisma'].contact_messages.update({ where: { id: m.id }, data: { reply, seen: true } });
  return { ok: true, id };
};

AdminService.prototype.listNotifications = async function (this: AdminService, opts) {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  if (this['useMongo']()) {
    const [rows, total] = await Promise.all([
      this['mongo'].findMany<Record<string, unknown>>('notifications', {}, {
        limit,
        skip: offset,
        sort: { mysql_id: -1 },
      }),
      this['mongo'].count('notifications'),
    ]);
    return paginate(
      // Default old rows (no status field) to ON.
      rows.map((r) => ({ ...r, id: Number(r.mysql_id), status: r.status !== undefined && r.status !== null ? !!r.status : true })),
      total,
      limit,
      offset,
    );
  }
  const [rows, total] = await Promise.all([
    this['prisma'].notifications.findMany({ orderBy: { id: 'desc' }, take: limit, skip: offset }),
    this['prisma'].notifications.count(),
  ]);
  return paginate(rows.map((r) => bigToNumber(r)), total, limit, offset);
};

AdminService.prototype.createNotification = async function (this: AdminService, body) {
  if (!body.title) throw new BadRequestException({ errors: [{ code: 'title', message: 'title required' }] });
  if (this['useMongo']()) {
    const mysqlId = await this['mongo'].nextMysqlId('notifications');
    const now = new Date();
    await this['mongo'].insertOne('notifications', {
      mysql_id: mysqlId,
      title: body.title,
      description: body.description ?? null,
      tergat: body.tergat ?? null,
      zone_id: body.zone_id ? Number(body.zone_id) : null,
      image: body.image ?? null,
      status: true,
      created_at: now,
      updated_at: now,
    });
    return { ok: true, id: mysqlId };
  }
  const created = await this['prisma'].notifications.create({
    data: {
      title: body.title,
      description: body.description,
      tergat: body.tergat,
      zone_id: body.zone_id ? BigInt(body.zone_id) : null,
    },
  });
  return { ok: true, id: Number(created.id) };
};

AdminService.prototype.updateNotification = async function (this: AdminService, id, body) {
  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.description !== undefined) data.description = body.description;
  if (body.tergat !== undefined) data.tergat = body.tergat;
  if (body.zone_id !== undefined) data.zone_id = body.zone_id ? Number(body.zone_id) : null;
  if (body.image !== undefined && body.image) data.image = body.image;
  if (Object.keys(data).length === 0) throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields to update' }] });
  if (this['useMongo']()) {
    const n = await this['mongo'].findByMysqlId<{ mysql_id: number }>('notifications', Number(id));
    if (!n) throw new NotFoundException({ errors: [{ code: 'notification', message: 'not found' }] });
    data.updated_at = new Date();
    await this['mongo'].updateOne('notifications', { mysql_id: Number(id) }, data);
    return { ok: true, id };
  }
  const n = await this['prisma'].notifications.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!n) throw new NotFoundException({ errors: [{ code: 'notification', message: 'not found' }] });
  await this['prisma'].notifications.update({ where: { id: n.id }, data: data as never });
  return { ok: true, id };
};

AdminService.prototype.updateNotificationStatus = async function (this: AdminService, id, status) {
  if (this['useMongo']()) {
    const n = await this['mongo'].findByMysqlId<{ mysql_id: number }>('notifications', Number(id));
    if (!n) throw new NotFoundException({ errors: [{ code: 'notification', message: 'not found' }] });
    await this['mongo'].updateOne('notifications', { mysql_id: Number(id) }, { status: !!status, updated_at: new Date() });
    return { ok: true, id, status: !!status };
  }
  const n = await this['prisma'].notifications.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!n) throw new NotFoundException({ errors: [{ code: 'notification', message: 'not found' }] });
  await this['prisma'].notifications.update({ where: { id: n.id }, data: { status: !!status } as never });
  return { ok: true, id, status: !!status };
};

AdminService.prototype.deleteNotification = async function (this: AdminService, id) {
  if (this['useMongo']()) {
    const n = await this['mongo'].findByMysqlId<{ mysql_id: number }>('notifications', Number(id));
    if (!n) throw new NotFoundException({ errors: [{ code: 'notification', message: 'not found' }] });
    await this['mongo'].deleteOne('notifications', { mysql_id: Number(id) });
    return { ok: true, id };
  }
  const n = await this['prisma'].notifications.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!n) throw new NotFoundException({ errors: [{ code: 'notification', message: 'not found' }] });
  await this['prisma'].notifications.delete({ where: { id: n.id } });
  return { ok: true, id };
};

AdminService.prototype.listReviews = async function (this: AdminService, opts) {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  if (this['useMongo']()) {
    const [rows, total] = await Promise.all([
      this['mongo'].findMany<Record<string, unknown>>('reviews', {}, {
        limit,
        skip: offset,
        sort: { mysql_id: -1 },
      }),
      this['mongo'].count('reviews'),
    ]);
    return paginate(
      rows.map((r) => ({
        ...r,
        id: Number(r.mysql_id),
        rating: r.rating !== undefined && r.rating !== null ? Number(r.rating) : 0,
      })),
      total,
      limit,
      offset,
    );
  }
  const [rows, total] = await Promise.all([
    this['prisma'].reviews.findMany({ orderBy: { id: 'desc' }, take: limit, skip: offset }),
    this['prisma'].reviews.count(),
  ]);
  return paginate(rows.map((r) => bigToNumber(r)), total, limit, offset);
};

AdminService.prototype.replyReview = async function (this: AdminService, id, reply) {
  if (this['useMongo']()) {
    const r = await this['mongo'].findByMysqlId<{ mysql_id: number }>('reviews', Number(id));
    if (!r) throw new NotFoundException({ errors: [{ code: 'review', message: 'not found' }] });
    await this['mongo'].updateOne(
      'reviews',
      { mysql_id: Number(id) },
      { reply, reply_at: new Date(), updated_at: new Date() },
    );
    return { ok: true, id };
  }
  const r = await this['prisma'].reviews.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!r) throw new NotFoundException({ errors: [{ code: 'review', message: 'not found' }] });
  await this['prisma'].reviews.update({ where: { id: r.id }, data: { reply, reply_at: new Date() } });
  return { ok: true, id };
};

AdminService.prototype.listDMReviews = async function (this: AdminService, opts) {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  if (this['useMongo']()) {
    const [rows, total] = await Promise.all([
      this['mongo'].findMany<Record<string, unknown>>('d_m_reviews', {}, {
        limit,
        skip: offset,
        sort: { mysql_id: -1 },
      }),
      this['mongo'].count('d_m_reviews'),
    ]);
    // Resolve DM + customer names so the table shows real people, not #undefined.
    const [dmNames, userNames] = await Promise.all([
      nameMapFor(this['mongo'], 'delivery_men', rows.map((r) => readFk(r, 'delivery_man_id')), personLabel),
      nameMapFor(this['mongo'], 'users', rows.map((r) => readFk(r, 'user_id')), personLabel),
    ]);
    return paginate(
      rows.map((r) => {
        const dmId = readFk(r, 'delivery_man_id');
        const userId = readFk(r, 'user_id');
        const orderId = readFk(r, 'order_id');
        return {
          ...r,
          id: Number(r.mysql_id),
          delivery_man_id: dmId,
          user_id: userId,
          order_id: orderId,
          dm_name: dmId !== null ? (dmNames.get(dmId) ?? null) : null,
          user_name: userId !== null ? (userNames.get(userId) ?? null) : null,
          rating: r.rating !== undefined && r.rating !== null ? Number(r.rating) : 0,
        };
      }),
      total,
      limit,
      offset,
    );
  }
  const [rows, total] = await Promise.all([
    this['prisma'].d_m_reviews.findMany({ orderBy: { id: 'desc' }, take: limit, skip: offset }),
    this['prisma'].d_m_reviews.count(),
  ]);
  return paginate(rows.map((r) => bigToNumber(r)), total, limit, offset);
};

AdminService.prototype.listFAQs = async function (this: AdminService) {
  if (this['useMongo']()) {
    const rows = await this['mongo'].findMany<Record<string, unknown>>('f_a_q_s', {}, {
      sort: { mysql_id: -1 },
    });
    return {
      faqs: rows.map((r) => ({ ...r, id: Number(r.mysql_id) })),
    };
  }
  const rows = await this['prisma'].f_a_q_s.findMany({ orderBy: { id: 'desc' } });
  return { faqs: rows.map((r) => bigToNumber(r)) };
};

AdminService.prototype.createFAQ = async function (this: AdminService, body) {
  if (!body.question || !body.answer) {
    throw new BadRequestException({ errors: [{ code: 'body', message: 'question and answer required' }] });
  }
  if (this['useMongo']()) {
    const mysqlId = await this['mongo'].nextMysqlId('f_a_q_s');
    const now = new Date();
    await this['mongo'].insertOne('f_a_q_s', {
      mysql_id: mysqlId,
      question: body.question,
      answer: body.answer,
      page_type: body.page_type ?? null,
      user_type: body.user_type ?? null,
      status: true,
      created_at: now,
      updated_at: now,
    });
    return { ok: true, id: mysqlId };
  }
  const created = await this['prisma'].f_a_q_s.create({
    data: { question: body.question, answer: body.answer, page_type: body.page_type, user_type: body.user_type },
  });
  return { ok: true, id: Number(created.id) };
};

AdminService.prototype.updateFAQ = async function (this: AdminService, id, body) {
  if (this['useMongo']()) {
    const f = await this['mongo'].findByMysqlId<{ mysql_id: number }>('f_a_q_s', Number(id));
    if (!f) throw new NotFoundException({ errors: [{ code: 'faq', message: 'not found' }] });
    const data: Record<string, unknown> = {};
    if (body.question !== undefined) data.question = body.question;
    if (body.answer !== undefined) data.answer = body.answer;
    if (body.status !== undefined) data.status = body.status;
    if (Object.keys(data).length === 0) {
      throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields' }] });
    }
    data.updated_at = new Date();
    await this['mongo'].updateOne('f_a_q_s', { mysql_id: Number(id) }, data);
    return { ok: true, id };
  }
  const f = await this['prisma'].f_a_q_s.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!f) throw new NotFoundException({ errors: [{ code: 'faq', message: 'not found' }] });
  const data: Record<string, unknown> = {};
  if (body.question !== undefined) data.question = body.question;
  if (body.answer !== undefined) data.answer = body.answer;
  if (body.status !== undefined) data.status = body.status;
  if (Object.keys(data).length === 0) {
    throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields' }] });
  }
  await this['prisma'].f_a_q_s.update({ where: { id: f.id }, data });
  return { ok: true, id };
};

AdminService.prototype.deleteFAQ = async function (this: AdminService, id) {
  if (this['useMongo']()) {
    const f = await this['mongo'].findByMysqlId<{ mysql_id: number }>('f_a_q_s', Number(id));
    if (!f) throw new NotFoundException({ errors: [{ code: 'faq', message: 'not found' }] });
    await this['mongo'].deleteOne('f_a_q_s', { mysql_id: Number(id) });
    return { ok: true, id };
  }
  const f = await this['prisma'].f_a_q_s.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!f) throw new NotFoundException({ errors: [{ code: 'faq', message: 'not found' }] });
  await this['prisma'].f_a_q_s.delete({ where: { id: f.id } });
  return { ok: true, id };
};

AdminService.prototype.listPageSeo = async function (this: AdminService) {
  if (this['useMongo']()) {
    const rows = await this['mongo'].findMany<Record<string, unknown>>('page_seo_data', {}, {
      sort: { mysql_id: -1 },
    });
    return {
      pages: rows.map((r) => ({ ...r, id: Number(r.mysql_id) })),
    };
  }
  const rows = await this['prisma'].page_seo_data.findMany({ orderBy: { id: 'desc' } });
  return { pages: rows.map((r) => bigToNumber(r)) };
};

AdminService.prototype.upsertPageSeo = async function (this: AdminService, body) {
  if (!body.page_name || !body.title || !body.description) {
    throw new BadRequestException({ errors: [{ code: 'body', message: 'page_name, title, description required' }] });
  }
  if (this['useMongo']()) {
    const existing = await this['mongo'].findOne<{ mysql_id: number }>('page_seo_data', { page_name: body.page_name });
    const now = new Date();
    if (existing) {
      const data: Record<string, unknown> = {
        title: body.title,
        description: body.description,
        updated_at: now,
      };
      if (body.status !== undefined) data.status = body.status;
      await this['mongo'].updateOne('page_seo_data', { mysql_id: existing.mysql_id }, data);
      return { ok: true, id: Number(existing.mysql_id) };
    }
    const mysqlId = await this['mongo'].nextMysqlId('page_seo_data');
    await this['mongo'].insertOne('page_seo_data', {
      mysql_id: mysqlId,
      page_name: body.page_name,
      title: body.title,
      description: body.description,
      status: body.status ?? true,
      created_at: now,
      updated_at: now,
    });
    return { ok: true, id: mysqlId };
  }
  const row = await this['prisma'].page_seo_data.upsert({
    where: { page_name: body.page_name },
    create: {
      page_name: body.page_name,
      title: body.title,
      description: body.description,
      status: body.status ?? true,
    },
    update: {
      title: body.title,
      description: body.description,
      status: body.status ?? undefined,
    },
  });
  return { ok: true, id: Number(row.id) };
};

AdminService.prototype.listSocialMedia = async function (this: AdminService) {
  if (this['useMongo']()) {
    const rows = await this['mongo'].findMany<Record<string, unknown>>('social_media', {}, {
      sort: { mysql_id: -1 },
    });
    return {
      social_media: rows.map((r) => ({ ...r, id: Number(r.mysql_id) })),
    };
  }
  const rows = await this['prisma'].social_media.findMany({ orderBy: { id: 'desc' } });
  return { social_media: rows.map((r) => bigToNumber(r)) };
};

AdminService.prototype.createSocialMedia = async function (this: AdminService, body) {
  if (!body.name || !body.link) throw new BadRequestException({ errors: [{ code: 'body', message: 'name and link required' }] });
  if (this['useMongo']()) {
    const mysqlId = await this['mongo'].nextMysqlId('social_media');
    const now = new Date();
    await this['mongo'].insertOne('social_media', {
      mysql_id: mysqlId,
      name: body.name,
      link: body.link,
      status: true,
      created_at: now,
      updated_at: now,
    });
    return { ok: true, id: mysqlId };
  }
  const created = await this['prisma'].social_media.create({ data: { name: body.name, link: body.link } });
  return { ok: true, id: Number(created.id) };
};

AdminService.prototype.updateSocialMediaStatus = async function (this: AdminService, id, status) {
  if (this['useMongo']()) {
    const s = await this['mongo'].findByMysqlId<{ mysql_id: number }>('social_media', Number(id));
    if (!s) throw new NotFoundException({ errors: [{ code: 'social_media', message: 'not found' }] });
    await this['mongo'].updateOne('social_media', { mysql_id: Number(id) }, { status, updated_at: new Date() });
    return { ok: true, id, status };
  }
  const s = await this['prisma'].social_media.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!s) throw new NotFoundException({ errors: [{ code: 'social_media', message: 'not found' }] });
  await this['prisma'].social_media.update({ where: { id: s.id }, data: { status } });
  return { ok: true, id, status };
};

AdminService.prototype.deleteSocialMedia = async function (this: AdminService, id) {
  if (this['useMongo']()) {
    const s = await this['mongo'].findByMysqlId<{ mysql_id: number }>('social_media', Number(id));
    if (!s) throw new NotFoundException({ errors: [{ code: 'social_media', message: 'not found' }] });
    await this['mongo'].deleteOne('social_media', { mysql_id: Number(id) });
    return { ok: true, id };
  }
  const s = await this['prisma'].social_media.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!s) throw new NotFoundException({ errors: [{ code: 'social_media', message: 'not found' }] });
  await this['prisma'].social_media.delete({ where: { id: s.id } });
  return { ok: true, id };
};

// ── System config ────────────────────────────────────────────────────────

AdminService.prototype.getEmployee = async function (this: AdminService, id) {
  if (!this['useMongo']()) throw new BadRequestException({ errors: [{ code: 'config', message: 'Mongo required' }] });
  const e = await this['mongo'].findByMysqlId<Record<string, unknown>>('admins', Number(id));
  if (!e) throw new NotFoundException({ errors: [{ code: 'employee', message: 'Employee not found' }] });
  return {
    employee: {
      id: Number(e.mysql_id),
      f_name: e.f_name ?? null,
      l_name: e.l_name ?? null,
      email: e.email ?? null,
      phone: e.phone ?? null,
      image: e.image ?? null,
      role_id: e.role_id != null ? Number(e.role_id) : null,
      zone_id: e.zone_id != null ? Number(e.zone_id) : null,
    },
  };
};

AdminService.prototype.createEmployee = async function (this: AdminService, body) {
  if (!body.f_name || !body.email || !body.role_id) {
    throw new BadRequestException({ errors: [{ code: 'input', message: 'First name, email and role are required' }] });
  }
  if (!this['useMongo']()) throw new BadRequestException({ errors: [{ code: 'config', message: 'Mongo required' }] });
  const dup = await this['mongo'].findOne<{ mysql_id: number }>('admins', { email: body.email });
  if (dup) throw new BadRequestException({ errors: [{ code: 'email', message: 'An account with this email already exists' }] });
  const bcrypt = await import('bcrypt');
  const hash = (await bcrypt.hash(body.password ?? '12345678', 10)).replace(/^\$2b\$/, '$2y$');
  const nextId = await this['mongo'].nextMysqlId('admins');
  const now = new Date();
  await this['mongo'].insertOne('admins', {
    mysql_id: nextId,
    f_name: body.f_name,
    l_name: body.l_name ?? '',
    email: body.email,
    phone: body.phone ?? null,
    password: hash,
    image: body.image ?? null,
    role_id: Number(body.role_id),
    zone_id: body.zone_id ? Number(body.zone_id) : null,
    status: true,
    created_at: now,
    updated_at: now,
  });
  return { ok: true, id: nextId };
};

AdminService.prototype.updateEmployee = async function (this: AdminService, id, body) {
  if (!this['useMongo']()) throw new BadRequestException({ errors: [{ code: 'config', message: 'Mongo required' }] });
  const e = await this['mongo'].findByMysqlId<{ mysql_id: number }>('admins', Number(id));
  if (!e) throw new NotFoundException({ errors: [{ code: 'employee', message: 'Employee not found' }] });
  const data: Record<string, unknown> = {};
  if (body.f_name !== undefined) data.f_name = body.f_name;
  if (body.l_name !== undefined) data.l_name = body.l_name;
  if (body.email !== undefined) data.email = body.email;
  if (body.phone !== undefined) data.phone = body.phone;
  if (body.role_id !== undefined) data.role_id = Number(body.role_id);
  if (body.zone_id !== undefined) data.zone_id = body.zone_id ? Number(body.zone_id) : null;
  if (body.image !== undefined && body.image) data.image = body.image;
  if (typeof body.password === 'string' && body.password.length > 1) {
    const bcrypt = await import('bcrypt');
    data.password = (await bcrypt.hash(body.password, 10)).replace(/^\$2b\$/, '$2y$');
  }
  if (Object.keys(data).length === 0) throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields to update' }] });
  data.updated_at = new Date();
  await this['mongo'].updateOne('admins', { mysql_id: Number(id) }, data);
  return { ok: true, id };
};

AdminService.prototype.deleteEmployee = async function (this: AdminService, id) {
  if (!this['useMongo']()) throw new BadRequestException({ errors: [{ code: 'config', message: 'Mongo required' }] });
  const e = await this['mongo'].findByMysqlId<{ mysql_id: number; role_id?: number | null }>('admins', Number(id));
  if (!e) throw new NotFoundException({ errors: [{ code: 'employee', message: 'Employee not found' }] });
  // Guard: never delete the super-admin (role_id 1) — it would lock everyone out.
  if (Number(e.role_id) === 1) {
    throw new BadRequestException({ errors: [{ code: 'employee', message: 'The super admin account cannot be deleted' }] });
  }
  await this['mongo'].deleteOne('admins', { mysql_id: Number(id) });
  return { ok: true, id };
};

AdminService.prototype.listEmployees = async function (this: AdminService, opts) {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  if (this['useMongo']()) {
    const filter: Record<string, unknown> = opts.q
      ? {
          $or: [
            { f_name: { $regex: opts.q, $options: 'i' } },
            { email: { $regex: opts.q, $options: 'i' } },
          ],
        }
      : { role_id: { $ne: 1 } };
    const [rows, total] = await Promise.all([
      this['mongo'].findMany<Record<string, unknown>>('admins', filter, {
        limit,
        skip: offset,
        sort: { mysql_id: -1 },
        projection: {
          mysql_id: 1,
          f_name: 1,
          l_name: 1,
          email: 1,
          phone: 1,
          image: 1,
          role_id: 1,
          zone_id: 1,
          created_at: 1,
        },
      }),
      this['mongo'].count('admins', filter),
    ]);
    return paginate(
      rows.map((r) => ({
        id: Number(r.mysql_id),
        f_name: (r.f_name as string) ?? null,
        l_name: (r.l_name as string) ?? null,
        email: (r.email as string) ?? null,
        phone: (r.phone as string) ?? null,
        image: (r.image as string) ?? null,
        role_id: r.role_id !== undefined && r.role_id !== null ? Number(r.role_id) : null,
        zone_id: r.zone_id !== undefined && r.zone_id !== null ? Number(r.zone_id) : null,
        created_at: (r.created_at as Date) ?? null,
      })),
      total,
      limit,
      offset,
    );
  }
  const where = opts.q
    ? { OR: [{ f_name: { contains: opts.q } }, { email: { contains: opts.q } }] }
    : { role_id: { not: 1n } };
  const [rows, total] = await Promise.all([
    this['prisma'].admins.findMany({
      where,
      orderBy: { id: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        f_name: true,
        l_name: true,
        email: true,
        phone: true,
        image: true,
        role_id: true,
        zone_id: true,
        created_at: true,
      },
    }),
    this['prisma'].admins.count({ where }),
  ]);
  return paginate(
    rows.map((r) => ({ ...r, id: Number(r.id), role_id: Number(r.role_id), zone_id: r.zone_id ? Number(r.zone_id) : null })),
    total,
    limit,
    offset,
  );
};

AdminService.prototype.listAdminRoles = async function (this: AdminService) {
  if (this['useMongo']()) {
    const rows = await this['mongo'].findMany<Record<string, unknown>>('admin_roles', {}, {
      sort: { mysql_id: -1 },
    });
    return {
      roles: rows.map((r) => ({ ...r, id: Number(r.mysql_id) })),
    };
  }
  const rows = await this['prisma'].admin_roles.findMany({ orderBy: { id: 'desc' } });
  return { roles: rows.map((r) => bigToNumber(r)) };
};

AdminService.prototype.createAdminRole = async function (this: AdminService, body) {
  if (!body.name) throw new BadRequestException({ errors: [{ code: 'name', message: 'name required' }] });
  if (this['useMongo']()) {
    const mysqlId = await this['mongo'].nextMysqlId('admin_roles');
    const now = new Date();
    await this['mongo'].insertOne('admin_roles', {
      mysql_id: mysqlId,
      name: body.name,
      modules: body.modules ?? null,
      status: true,
      created_at: now,
      updated_at: now,
    });
    return { ok: true, id: mysqlId };
  }
  const created = await this['prisma'].admin_roles.create({ data: { name: body.name, modules: body.modules ?? null } });
  return { ok: true, id: Number(created.id) };
};

AdminService.prototype.updateAdminRole = async function (this: AdminService, id, body) {
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.modules !== undefined) data.modules = body.modules;
  if (body.status !== undefined) data.status = body.status;
  if (Object.keys(data).length === 0) {
    throw new BadRequestException({ errors: [{ code: 'body', message: 'no fields to update' }] });
  }
  if (this['useMongo']()) {
    const r = await this['mongo'].findByMysqlId<{ mysql_id: number }>('admin_roles', Number(id));
    if (!r) throw new NotFoundException({ errors: [{ code: 'role', message: 'not found' }] });
    data.updated_at = new Date();
    await this['mongo'].updateOne('admin_roles', { mysql_id: Number(id) }, data);
    return { ok: true, id };
  }
  const r = await this['prisma'].admin_roles.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!r) throw new NotFoundException({ errors: [{ code: 'role', message: 'not found' }] });
  await this['prisma'].admin_roles.update({ where: { id: r.id }, data: data as never });
  return { ok: true, id };
};

AdminService.prototype.deleteAdminRole = async function (this: AdminService, id) {
  if (this['useMongo']()) {
    const r = await this['mongo'].findByMysqlId<{ mysql_id: number }>('admin_roles', Number(id));
    if (!r) throw new NotFoundException({ errors: [{ code: 'role', message: 'not found' }] });
    await this['mongo'].deleteOne('admin_roles', { mysql_id: Number(id) });
    return { ok: true, id };
  }
  const r = await this['prisma'].admin_roles.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!r) throw new NotFoundException({ errors: [{ code: 'role', message: 'not found' }] });
  await this['prisma'].admin_roles.delete({ where: { id: r.id } });
  return { ok: true, id };
};

AdminService.prototype.listSubscriptionPackages = async function (this: AdminService) {
  if (this['useMongo']()) {
    const rows = await this['mongo'].findMany<Record<string, unknown>>('subscription_packages', {}, { sort: { mysql_id: -1 } });
    return { packages: rows.map((r) => ({ ...r, id: Number(r.mysql_id), price: r.price !== undefined && r.price !== null ? Number(r.price) : 0 })) };
  }
  const rows = await this['prisma'].subscription_packages.findMany({ orderBy: { id: 'desc' } });
  return { packages: rows.map((r) => bigToNumber(r)) };
};

AdminService.prototype.createSubscriptionPackage = async function (this: AdminService, body) {
  if (!body.package_name || typeof body.price !== 'number' || typeof body.validity !== 'number') {
    throw new BadRequestException({ errors: [{ code: 'body', message: 'package_name, price, validity required' }] });
  }
  const b = body as Record<string, unknown>;
  const flag = (v: unknown) => v === true || v === 1 || v === '1' || v === 'true' || v === 'on';
  if (this['useMongo']()) {
    const mysqlId = await this['mongo'].nextMysqlId('subscription_packages');
    await this['mongo'].insertOne('subscription_packages', {
      mysql_id: mysqlId,
      package_name: body.package_name,
      price: body.price,
      validity: body.validity,
      max_order: body.max_order ?? 'unlimited',
      max_product: body.max_product ?? 'unlimited',
      pos: flag(b.pos),
      mobile_app: flag(b.mobile_app),
      chat: flag(b.chat),
      review: flag(b.review),
      self_delivery: flag(b.self_delivery),
      default: flag(b.default),
      status: true,
      created_at: new Date(),
      updated_at: new Date(),
    });
    return { ok: true, id: mysqlId };
  }
  const created = await this['prisma'].subscription_packages.create({
    data: {
      package_name: body.package_name,
      price: body.price,
      validity: body.validity,
      max_order: body.max_order ?? 'unlimited',
      max_product: body.max_product ?? 'unlimited',
      pos: flag(b.pos),
      mobile_app: flag(b.mobile_app),
      chat: flag(b.chat),
      review: flag(b.review),
      self_delivery: flag(b.self_delivery),
    },
  });
  return { ok: true, id: Number(created.id) };
};

AdminService.prototype.getSubscriptionPackage = async function (this: AdminService, id) {
  if (this['useMongo']()) {
    const p = await this['mongo'].findByMysqlId<Record<string, unknown>>('subscription_packages', Number(id));
    if (!p) throw new NotFoundException({ errors: [{ code: 'package', message: 'not found' }] });
    return { package: { ...p, id: Number(p.mysql_id), price: p.price != null ? Number(p.price) : 0 } };
  }
  const p = await this['prisma'].subscription_packages.findUnique({ where: { id: BigInt(id) } });
  if (!p) throw new NotFoundException({ errors: [{ code: 'package', message: 'not found' }] });
  return { package: bigToNumber(p) };
};

AdminService.prototype.updateSubscriptionPackage = async function (this: AdminService, id, body) {
  const b = body as Record<string, unknown>;
  const flag = (v: unknown) => v === true || v === 1 || v === '1' || v === 'true' || v === 'on';
  const data: Record<string, unknown> = { updated_at: new Date() };
  if (b.package_name !== undefined) data.package_name = String(b.package_name);
  if (b.price !== undefined) data.price = Number(b.price);
  if (b.validity !== undefined) data.validity = Number(b.validity);
  if (b.max_order !== undefined) data.max_order = String(b.max_order);
  if (b.max_product !== undefined) data.max_product = String(b.max_product);
  for (const k of ['pos', 'mobile_app', 'chat', 'review', 'self_delivery', 'default', 'status']) {
    if (b[k] !== undefined) data[k] = flag(b[k]);
  }
  if (this['useMongo']()) {
    const p = await this['mongo'].findByMysqlId<{ mysql_id: number }>('subscription_packages', Number(id));
    if (!p) throw new NotFoundException({ errors: [{ code: 'package', message: 'not found' }] });
    await this['mongo'].updateOne('subscription_packages', { mysql_id: Number(id) }, data);
    return { ok: true, id };
  }
  const p = await this['prisma'].subscription_packages.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!p) throw new NotFoundException({ errors: [{ code: 'package', message: 'not found' }] });
  delete data.updated_at;
  await this['prisma'].subscription_packages.update({ where: { id: p.id }, data: data as never });
  return { ok: true, id };
};

AdminService.prototype.updateSubscriptionPackageStatus = async function (this: AdminService, id, status) {
  if (this['useMongo']()) {
    const p = await this['mongo'].findByMysqlId<{ mysql_id: number }>('subscription_packages', id);
    if (!p) throw new NotFoundException({ errors: [{ code: 'package', message: 'not found' }] });
    await this['mongo'].updateOne('subscription_packages', { mysql_id: Number(id) }, { status, updated_at: new Date() });
    return { ok: true, id, status };
  }
  const p = await this['prisma'].subscription_packages.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!p) throw new NotFoundException({ errors: [{ code: 'package', message: 'not found' }] });
  await this['prisma'].subscription_packages.update({ where: { id: p.id }, data: { status } });
  return { ok: true, id, status };
};

AdminService.prototype.deleteSubscriptionPackage = async function (this: AdminService, id) {
  if (this['useMongo']()) {
    const p = await this['mongo'].findByMysqlId<{ mysql_id: number }>('subscription_packages', id);
    if (!p) throw new NotFoundException({ errors: [{ code: 'package', message: 'not found' }] });
    await this['mongo'].deleteOne('subscription_packages', { mysql_id: Number(id) });
    return { ok: true, id };
  }
  const p = await this['prisma'].subscription_packages.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!p) throw new NotFoundException({ errors: [{ code: 'package', message: 'not found' }] });
  await this['prisma'].subscription_packages.delete({ where: { id: p.id } });
  return { ok: true, id };
};

AdminService.prototype.listShifts = async function (this: AdminService) {
  if (this['useMongo']()) {
    const rows = await this['mongo'].findMany<Record<string, unknown>>('shifts', {}, { sort: { mysql_id: -1 } });
    return { shifts: rows.map((r) => ({ ...r, id: Number(r.mysql_id) })) };
  }
  const rows = await this['prisma'].shifts.findMany({ orderBy: { id: 'desc' } });
  return { shifts: rows.map((r) => bigToNumber(r)) };
};

AdminService.prototype.createShift = async function (this: AdminService, body) {
  if (!body.name) throw new BadRequestException({ errors: [{ code: 'name', message: 'name required' }] });
  const baseDate = '1970-01-01T';
  if (this['useMongo']()) {
    const mysqlId = await this['mongo'].nextMysqlId('shifts');
    await this['mongo'].insertOne('shifts', {
      mysql_id: mysqlId,
      name: body.name,
      start_time: body.start_time ? new Date(`${baseDate}${body.start_time}Z`) : null,
      end_time: body.end_time ? new Date(`${baseDate}${body.end_time}Z`) : null,
      is_full_day: body.is_full_day ?? false,
      status: true,
      created_at: new Date(),
      updated_at: new Date(),
    });
    return { ok: true, id: mysqlId };
  }
  const created = await this['prisma'].shifts.create({
    data: {
      name: body.name,
      start_time: body.start_time ? new Date(`${baseDate}${body.start_time}Z`) : null,
      end_time: body.end_time ? new Date(`${baseDate}${body.end_time}Z`) : null,
      is_full_day: body.is_full_day ?? false,
    },
  });
  return { ok: true, id: Number(created.id) };
};

AdminService.prototype.updateShiftStatus = async function (this: AdminService, id, status) {
  if (this['useMongo']()) {
    const s = await this['mongo'].findByMysqlId<{ mysql_id: number }>('shifts', id);
    if (!s) throw new NotFoundException({ errors: [{ code: 'shift', message: 'not found' }] });
    await this['mongo'].updateOne('shifts', { mysql_id: Number(id) }, { status, updated_at: new Date() });
    return { ok: true, id, status };
  }
  const s = await this['prisma'].shifts.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!s) throw new NotFoundException({ errors: [{ code: 'shift', message: 'not found' }] });
  await this['prisma'].shifts.update({ where: { id: s.id }, data: { status } });
  return { ok: true, id, status };
};

AdminService.prototype.deleteShift = async function (this: AdminService, id) {
  if (this['useMongo']()) {
    const s = await this['mongo'].findByMysqlId<{ mysql_id: number }>('shifts', id);
    if (!s) throw new NotFoundException({ errors: [{ code: 'shift', message: 'not found' }] });
    await this['mongo'].deleteOne('shifts', { mysql_id: Number(id) });
    return { ok: true, id };
  }
  const s = await this['prisma'].shifts.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!s) throw new NotFoundException({ errors: [{ code: 'shift', message: 'not found' }] });
  await this['prisma'].shifts.delete({ where: { id: s.id } });
  return { ok: true, id };
};

AdminService.prototype.listVehicles = async function (this: AdminService) {
  if (this['useMongo']()) {
    const rows = await this['mongo'].findMany<Record<string, unknown>>('vehicles', {}, { sort: { mysql_id: -1 } });
    return { vehicles: rows.map((r) => ({ ...r, id: Number(r.mysql_id) })) };
  }
  const rows = await this['prisma'].vehicles.findMany({ orderBy: { id: 'desc' } });
  return { vehicles: rows.map((r) => bigToNumber(r)) };
};

AdminService.prototype.createVehicle = async function (this: AdminService, body) {
  // Only the vehicle type is mandatory now; coverage + extra charge are
  // optional (default 0) since the admin form no longer collects extra charge
  // and keeps the coverage fields non-mandatory.
  if (!body.type) {
    throw new BadRequestException({ errors: [{ code: 'body', message: 'type is required' }] });
  }
  const startCoverage = Number(body.starting_coverage_area ?? 0) || 0;
  const maxCoverage = Number(body.maximum_coverage_area ?? 0) || 0;
  const extraCharges = Number(body.extra_charges ?? 0) || 0;
  if (this['useMongo']()) {
    const mysqlId = await this['mongo'].nextMysqlId('vehicles');
    await this['mongo'].insertOne('vehicles', {
      mysql_id: mysqlId,
      type: body.type,
      starting_coverage_area: startCoverage,
      maximum_coverage_area: maxCoverage,
      extra_charges: extraCharges,
      status: true,
      created_at: new Date(),
      updated_at: new Date(),
    });
    return { ok: true, id: mysqlId };
  }
  const created = await this['prisma'].vehicles.create({
    data: {
      type: body.type,
      starting_coverage_area: startCoverage,
      maximum_coverage_area: maxCoverage,
      extra_charges: extraCharges,
    },
  });
  return { ok: true, id: Number(created.id) };
};

AdminService.prototype.updateVehicleStatus = async function (this: AdminService, id, status) {
  if (this['useMongo']()) {
    const v = await this['mongo'].findByMysqlId<{ mysql_id: number }>('vehicles', id);
    if (!v) throw new NotFoundException({ errors: [{ code: 'vehicle', message: 'not found' }] });
    await this['mongo'].updateOne('vehicles', { mysql_id: Number(id) }, { status, updated_at: new Date() });
    return { ok: true, id, status };
  }
  const v = await this['prisma'].vehicles.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!v) throw new NotFoundException({ errors: [{ code: 'vehicle', message: 'not found' }] });
  await this['prisma'].vehicles.update({ where: { id: v.id }, data: { status } });
  return { ok: true, id, status };
};

AdminService.prototype.deleteVehicle = async function (this: AdminService, id) {
  if (this['useMongo']()) {
    const v = await this['mongo'].findByMysqlId<{ mysql_id: number }>('vehicles', id);
    if (!v) throw new NotFoundException({ errors: [{ code: 'vehicle', message: 'not found' }] });
    await this['mongo'].deleteOne('vehicles', { mysql_id: Number(id) });
    return { ok: true, id };
  }
  const v = await this['prisma'].vehicles.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!v) throw new NotFoundException({ errors: [{ code: 'vehicle', message: 'not found' }] });
  await this['prisma'].vehicles.delete({ where: { id: v.id } });
  return { ok: true, id };
};

AdminService.prototype.listOrderCancelReasons = async function (this: AdminService) {
  if (this['useMongo']()) {
    const rows = await this['mongo'].findMany<Record<string, unknown>>('order_cancel_reasons', {}, {
      sort: { mysql_id: -1 },
    });
    return {
      reasons: rows.map((r) => ({ ...r, id: Number(r.mysql_id) })),
    };
  }
  const rows = await this['prisma'].order_cancel_reasons.findMany({ orderBy: { id: 'desc' } });
  return { reasons: rows.map((r) => bigToNumber(r)) };
};

AdminService.prototype.createOrderCancelReason = async function (this: AdminService, body) {
  if (!body.reason || !body.user_type) {
    throw new BadRequestException({ errors: [{ code: 'body', message: 'reason and user_type required' }] });
  }
  if (this['useMongo']()) {
    const mysqlId = await this['mongo'].nextMysqlId('order_cancel_reasons');
    const now = new Date();
    await this['mongo'].insertOne('order_cancel_reasons', {
      mysql_id: mysqlId,
      reason: body.reason,
      user_type: body.user_type,
      status: true,
      created_at: now,
      updated_at: now,
    });
    return { ok: true, id: mysqlId };
  }
  const created = await this['prisma'].order_cancel_reasons.create({
    data: { reason: body.reason, user_type: body.user_type },
  });
  return { ok: true, id: Number(created.id) };
};

AdminService.prototype.updateOrderCancelReasonStatus = async function (this: AdminService, id, status) {
  if (this['useMongo']()) {
    const r = await this['mongo'].findByMysqlId<{ mysql_id: number }>('order_cancel_reasons', Number(id));
    if (!r) throw new NotFoundException({ errors: [{ code: 'reason', message: 'not found' }] });
    await this['mongo'].updateOne('order_cancel_reasons', { mysql_id: Number(id) }, { status, updated_at: new Date() });
    return { ok: true, id, status };
  }
  const r = await this['prisma'].order_cancel_reasons.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!r) throw new NotFoundException({ errors: [{ code: 'reason', message: 'not found' }] });
  await this['prisma'].order_cancel_reasons.update({ where: { id: r.id }, data: { status } });
  return { ok: true, id, status };
};

AdminService.prototype.deleteOrderCancelReason = async function (this: AdminService, id) {
  if (this['useMongo']()) {
    const r = await this['mongo'].findByMysqlId<{ mysql_id: number }>('order_cancel_reasons', Number(id));
    if (!r) throw new NotFoundException({ errors: [{ code: 'reason', message: 'not found' }] });
    await this['mongo'].deleteOne('order_cancel_reasons', { mysql_id: Number(id) });
    return { ok: true, id };
  }
  const r = await this['prisma'].order_cancel_reasons.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!r) throw new NotFoundException({ errors: [{ code: 'reason', message: 'not found' }] });
  await this['prisma'].order_cancel_reasons.delete({ where: { id: r.id } });
  return { ok: true, id };
};

AdminService.prototype.listRefundReasons = async function (this: AdminService) {
  if (this['useMongo']()) {
    const rows = await this['mongo'].findMany<Record<string, unknown>>('refund_reasons', {}, {
      sort: { mysql_id: -1 },
    });
    return {
      reasons: rows.map((r) => ({ ...r, id: Number(r.mysql_id) })),
    };
  }
  const rows = await this['prisma'].refund_reasons.findMany({ orderBy: { id: 'desc' } });
  return { reasons: rows.map((r) => bigToNumber(r)) };
};

AdminService.prototype.createRefundReason = async function (this: AdminService, body) {
  if (!body.reason) throw new BadRequestException({ errors: [{ code: 'reason', message: 'reason required' }] });
  if (this['useMongo']()) {
    const mysqlId = await this['mongo'].nextMysqlId('refund_reasons');
    const now = new Date();
    await this['mongo'].insertOne('refund_reasons', {
      mysql_id: mysqlId,
      reason: body.reason,
      status: true,
      created_at: now,
      updated_at: now,
    });
    return { ok: true, id: mysqlId };
  }
  const created = await this['prisma'].refund_reasons.create({ data: { reason: body.reason } });
  return { ok: true, id: Number(created.id) };
};

AdminService.prototype.deleteRefundReason = async function (this: AdminService, id) {
  if (this['useMongo']()) {
    const r = await this['mongo'].findByMysqlId<{ mysql_id: number }>('refund_reasons', Number(id));
    if (!r) throw new NotFoundException({ errors: [{ code: 'refund_reason', message: 'not found' }] });
    await this['mongo'].deleteOne('refund_reasons', { mysql_id: Number(id) });
    return { ok: true, id };
  }
  const r = await this['prisma'].refund_reasons.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!r) throw new NotFoundException({ errors: [{ code: 'refund_reason', message: 'not found' }] });
  await this['prisma'].refund_reasons.delete({ where: { id: r.id } });
  return { ok: true, id };
};

AdminService.prototype.listRefunds = async function (this: AdminService, opts) {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  if (this['useMongo']()) {
    const [rows, total] = await Promise.all([
      this['mongo'].findMany<Record<string, unknown>>('refunds', {}, {
        limit,
        skip: offset,
        sort: { mysql_id: -1 },
      }),
      this['mongo'].count('refunds'),
    ]);
    return paginate(
      rows.map((r) => ({
        ...r,
        id: Number(r.mysql_id),
        refund_amount: r.refund_amount !== undefined && r.refund_amount !== null ? Number(r.refund_amount) : 0,
      })),
      total,
      limit,
      offset,
    );
  }
  const [rows, total] = await Promise.all([
    this['prisma'].refunds.findMany({ orderBy: { id: 'desc' }, take: limit, skip: offset }),
    this['prisma'].refunds.count(),
  ]);
  return paginate(
    rows.map((r) => ({ ...bigToNumber(r), refund_amount: Number(r.refund_amount) })),
    total,
    limit,
    offset,
  );
};

AdminService.prototype.updateRefundStatus = async function (this: AdminService, id, status, admin_note) {
  if (this['useMongo']()) {
    const r = await this['mongo'].findByMysqlId<Record<string, unknown>>('refunds', Number(id));
    if (!r) throw new NotFoundException({ errors: [{ code: 'refund', message: 'not found' }] });
    const data: Record<string, unknown> = { refund_status: status, updated_at: new Date() };
    if (admin_note !== undefined) data.admin_note = admin_note;
    await this['mongo'].updateOne('refunds', { mysql_id: Number(id) }, data);

    // ── Auto-generate the credit note ────────────────────────────────────
    // Every approved/completed refund issues a credit note automatically
    // (reversing the original GST + delivery), so admins never do it by hand.
    // Idempotent: one credit note per refund.
    if (status === 'approved' || status === 'completed') {
      const orderId = Number(r.order_id ?? r.mysql_order_id ?? 0);
      const refundAmount = Number(r.refund_amount ?? 0);
      if (orderId > 0 && refundAmount > 0) {
        const existing = await this['mongo'].findOne<{ mysql_id: number }>('credit_notes', { refund_id: Number(id) });
        if (!existing) {
          const order = await this['mongo'].findByMysqlId<{
            mysql_id: number; mysql_user_id?: number; mysql_restaurant_id?: number;
            total_tax_amount?: number; delivery_charge?: number;
          }>('orders', orderId);
          const taxReversed = Number(order?.total_tax_amount ?? 0);
          const delivReversed = Number(order?.delivery_charge ?? 0);
          const total = refundAmount + taxReversed + delivReversed;
          const today = new Date();
          const cnNumber = `CN-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${orderId}R${id}`;
          const cnId = await this['mongo'].nextMysqlId('credit_notes');
          await this['mongo'].insertOne('credit_notes', {
            mysql_id: cnId,
            credit_note_number: cnNumber,
            refund_id: Number(id),
            order_id: orderId,
            customer_id: Number(order?.mysql_user_id ?? r.user_id ?? 0),
            restaurant_id: order?.mysql_restaurant_id != null ? Number(order.mysql_restaurant_id) : null,
            reason: (r.customer_reason as string) ?? 'Refund',
            refund_amount: refundAmount,
            tax_reversed: taxReversed,
            delivery_reversed: delivReversed,
            total_credit: total,
            status: 'issued',
            notes: 'Auto-issued on refund ' + status,
            issued_by: null,
            created_at: today,
            updated_at: today,
          });
        }
      }
    }
    return { ok: true, id, status };
  }
  const r = await this['prisma'].refunds.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!r) throw new NotFoundException({ errors: [{ code: 'refund', message: 'not found' }] });
  await this['prisma'].refunds.update({
    where: { id: r.id },
    data: { refund_status: status, admin_note: admin_note ?? undefined },
  });
  return { ok: true, id, status };
};

AdminService.prototype.listCurrencies = async function (this: AdminService) {
  if (this['useMongo']()) {
    const rows = await this['mongo'].findMany<Record<string, unknown>>('currencies', {}, { sort: { mysql_id: 1 } });
    return {
      currencies: rows.map((r) => ({
        ...r,
        id: Number(r.mysql_id),
        exchange_rate: r.exchange_rate !== undefined && r.exchange_rate !== null ? Number(r.exchange_rate) : null,
      })),
    };
  }
  const rows = await this['prisma'].currencies.findMany({ orderBy: { id: 'asc' } });
  return {
    currencies: rows.map((r) => ({ ...bigToNumber(r), exchange_rate: r.exchange_rate ? Number(r.exchange_rate) : null })),
  };
};

AdminService.prototype.listTags = async function (this: AdminService) {
  if (this['useMongo']()) {
    const rows = await this['mongo'].findMany<Record<string, unknown>>('tags', {}, { limit: 200, sort: { mysql_id: -1 } });
    return { tags: rows.map((r) => ({ ...r, id: Number(r.mysql_id) })) };
  }
  const rows = await this['prisma'].tags.findMany({ orderBy: { id: 'desc' }, take: 200 });
  return { tags: rows.map((r) => bigToNumber(r)) };
};

AdminService.prototype.listTranslations = async function (this: AdminService, opts) {
  const limit = opts.limit ?? 200;
  const offset = opts.offset ?? 0;
  if (this['useMongo']()) {
    const [mrows, mtotal] = await Promise.all([
      this['mongo'].findMany<Record<string, unknown>>('translations', {}, { limit, skip: offset, sort: { mysql_id: -1 } }),
      this['mongo'].count('translations'),
    ]);
    return paginate(mrows.map((r) => ({ ...r, id: Number(r.mysql_id) })), mtotal, limit, offset);
  }
  const [rows, total] = await Promise.all([
    this['prisma'].translations.findMany({ orderBy: { id: 'desc' }, take: limit, skip: offset }),
    this['prisma'].translations.count(),
  ]);
  return paginate(rows.map((r) => bigToNumber(r)), total, limit, offset);
};

// ── Reports ──────────────────────────────────────────────────────────────

AdminService.prototype.adminEarningReport = async function (this: AdminService, days, opts = {}) {
  if (this['useMongo']()) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const hasFilter = !!(opts && (opts.from || opts.to || opts.zoneId || opts.restaurantId));
    const match = hasFilter ? orderReportMatch(opts) : { order_status: 'delivered', payment_status: 'paid', delivered: { $gte: cutoff } };
    const rows = await this['mongo'].aggregate<{
      _id: number;
      gross: number;
      tax: number;
      delivery: number;
      orders: number;
      restaurant?: { mysql_id: number; comission: number | null } | null;
    }>('orders', [
      { $match: match },
      {
        $group: {
          _id: '$mysql_restaurant_id',
          gross: { $sum: '$order_amount' },
          tax: { $sum: '$total_tax_amount' },
          delivery: { $sum: '$delivery_charge' },
          orders: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'restaurants',
          localField: '_id',
          foreignField: 'mysql_id',
          as: 'restaurant',
        },
      },
      { $unwind: { path: '$restaurant', preserveNullAndEmptyArrays: true } },
    ]);
    let gross = 0;
    let tax = 0;
    let deliveryCharges = 0;
    let adminCommission = 0;
    let deliveredOrders = 0;
    for (const r of rows) {
      const g = Number(r.gross ?? 0);
      gross += g;
      tax += Number(r.tax ?? 0);
      deliveryCharges += Number(r.delivery ?? 0);
      deliveredOrders += Number(r.orders ?? 0);
      const comm =
        r.restaurant && r.restaurant.comission !== null && r.restaurant.comission !== undefined
          ? Number(r.restaurant.comission)
          : 0;
      adminCommission += g * (comm / 100);
    }
    return {
      days,
      delivered_orders: deliveredOrders,
      gross_sales: gross,
      total_tax: tax,
      total_delivery_charges: deliveryCharges,
      admin_commission: adminCommission,
      restaurant_take: gross - adminCommission,
    };
  }
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const orders = await this['prisma'].orders.findMany({
    where: { created_at: { gte: since }, order_status: 'delivered', payment_status: 'paid' },
    select: { order_amount: true, restaurant_id: true, total_tax_amount: true, delivery_charge: true },
  });
  const restaurantIds = Array.from(new Set(orders.map((o) => o.restaurant_id)));
  const restaurants = restaurantIds.length
    ? await this['prisma'].restaurants.findMany({
        where: { id: { in: restaurantIds } },
        select: { id: true, comission: true },
      })
    : [];
  const commByRestaurant = new Map(
    restaurants.map((r) => [String(r.id), r.comission !== null ? Number(r.comission) : 0]),
  );
  let gross = 0;
  let tax = 0;
  let deliveryCharges = 0;
  let adminCommission = 0;
  for (const o of orders) {
    const amt = Number(o.order_amount);
    gross += amt;
    tax += Number(o.total_tax_amount);
    deliveryCharges += Number(o.delivery_charge);
    const comm = commByRestaurant.get(String(o.restaurant_id)) ?? 0;
    adminCommission += amt * (comm / 100);
  }
  return {
    days,
    delivered_orders: orders.length,
    gross_sales: gross,
    total_tax: tax,
    total_delivery_charges: deliveryCharges,
    admin_commission: adminCommission,
    restaurant_take: gross - adminCommission,
  };
};

AdminService.prototype.customerReport = async function (this: AdminService, limit, opts = {}) {
  if (this['useMongo']()) {
    const rows = await this['mongo'].aggregate<{
      _id: number;
      orders: number;
      total_spend: number;
      user?: {
        mysql_id: number;
        f_name: string | null;
        l_name: string | null;
        email: string | null;
        phone: string | null;
      } | null;
    }>('orders', [
      { $match: { ...orderReportMatch(opts), mysql_user_id: { $ne: null } } },
      {
        $group: {
          _id: '$mysql_user_id',
          orders: { $sum: 1 },
          total_spend: { $sum: '$order_amount' },
        },
      },
      { $sort: { total_spend: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'mysql_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    ]);
    return {
      top_customers: rows.map((g) => ({
        user_id: g._id !== null && g._id !== undefined ? Number(g._id) : null,
        name: g.user ? `${g.user.f_name ?? ''} ${g.user.l_name ?? ''}`.trim() : null,
        email: g.user?.email ?? null,
        phone: g.user?.phone ?? null,
        orders: Number(g.orders ?? 0),
        total_spend: Number(g.total_spend ?? 0),
      })),
    };
  }
  const groups = await this['prisma'].orders.groupBy({
    by: ['user_id'],
    where: { user_id: { not: null } },
    _count: { _all: true },
    _sum: { order_amount: true },
    orderBy: { _sum: { order_amount: 'desc' } },
    take: limit,
  });
  const userIds = groups.map((g) => g.user_id).filter((u): u is bigint => u !== null);
  const users = userIds.length
    ? await this['prisma'].users.findMany({
        where: { id: { in: userIds } },
        select: { id: true, f_name: true, l_name: true, email: true, phone: true },
      })
    : [];
  const map = new Map(users.map((u) => [String(u.id), u]));
  return {
    top_customers: groups.map((g) => {
      const u = g.user_id ? map.get(String(g.user_id)) : null;
      return {
        user_id: g.user_id ? Number(g.user_id) : null,
        name: u ? `${u.f_name ?? ''} ${u.l_name ?? ''}`.trim() : null,
        email: u?.email ?? null,
        phone: u?.phone ?? null,
        orders: g._count._all,
        total_spend: Number(g._sum.order_amount ?? 0),
      };
    }),
  };
};

AdminService.prototype.deliverymanEarningReport = async function (this: AdminService, limit, opts = {}) {
  if (this['useMongo']()) {
    const rows = await this['mongo'].aggregate<{
      _id: number;
      deliveries: number;
      total_tips: number;
      total_delivery_charges: number;
      dm?: {
        mysql_id: number;
        f_name: string | null;
        l_name: string | null;
        phone: string | null;
        mysql_zone_id?: number | null;
      } | null;
    }>('orders', [
      { $match: { ...orderReportMatch(opts), mysql_delivery_man_id: { $ne: null } } },
      {
        $group: {
          _id: '$mysql_delivery_man_id',
          deliveries: { $sum: 1 },
          total_tips: { $sum: '$dm_tips' },
          total_delivery_charges: { $sum: '$delivery_charge' },
        },
      },
      { $sort: { deliveries: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'delivery_men',
          localField: '_id',
          foreignField: 'mysql_id',
          as: 'dm',
        },
      },
      { $unwind: { path: '$dm', preserveNullAndEmptyArrays: true } },
    ]);

    const dmIds = rows.map((g) => Number(g._id)).filter((n) => Number.isFinite(n));

    // Incentive = sum of APPROVED incentive claims credited to the rider.
    const incentiveByDm = new Map<number, number>();
    if (dmIds.length) {
      const incRows = await this['mongo'].aggregate<{ _id: number; total: number }>(
        'dm_incentives',
        [
          { $match: { dm_id: { $in: dmIds }, status: 'approved' } },
          { $group: { _id: '$dm_id', total: { $sum: '$claim_amount' } } },
        ],
      );
      for (const r of incRows) incentiveByDm.set(Number(r._id), Number(r.total ?? 0));
    }

    // Bonus = derived from the Bonus & Incentive config: a rider who completed
    // at least the threshold deliveries earns the configured bonus amount.
    const cfgRows = await this['mongo'].findMany<{ key: string; value: string | null }>(
      'business_settings',
      { key: { $in: ['dm_incentive_enabled', 'dm_incentive_bonus_threshold', 'dm_incentive_bonus_amount'] } },
    );
    const cfg = new Map(cfgRows.map((r) => [r.key, r.value]));
    const bonusEnabled = /^(1|true|yes|on)$/i.test(String(cfg.get('dm_incentive_enabled') ?? '1'));
    const bonusThreshold = Number(cfg.get('dm_incentive_bonus_threshold') ?? 0) || 0;
    const bonusAmount = Number(cfg.get('dm_incentive_bonus_amount') ?? 0) || 0;

    return {
      top_delivery_men: rows.map((g) => {
        const id = g._id !== null && g._id !== undefined ? Number(g._id) : null;
        const deliveries = Number(g.deliveries ?? 0);
        const incentive = id !== null ? (incentiveByDm.get(id) ?? 0) : 0;
        const bonus = bonusEnabled && bonusThreshold > 0 && deliveries >= bonusThreshold ? bonusAmount : 0;
        return {
          delivery_man_id: id,
          name: g.dm ? `${g.dm.f_name ?? ''} ${g.dm.l_name ?? ''}`.trim() : null,
          phone: g.dm?.phone ?? null,
          zone_id:
            g.dm && g.dm.mysql_zone_id !== null && g.dm.mysql_zone_id !== undefined
              ? Number(g.dm.mysql_zone_id)
              : null,
          deliveries,
          total_tips: Number(g.total_tips ?? 0),
          total_delivery_charges: Number(g.total_delivery_charges ?? 0),
          total_incentive: incentive,
          total_bonus: bonus,
        };
      }),
    };
  }
  const groups = await this['prisma'].orders.groupBy({
    by: ['delivery_man_id'],
    where: { delivery_man_id: { not: null }, order_status: 'delivered' },
    _count: { _all: true },
    _sum: { dm_tips: true, delivery_charge: true },
    orderBy: { _count: { delivery_man_id: 'desc' } },
    take: limit,
  });
  const dmIds = groups.map((g) => g.delivery_man_id).filter((d): d is bigint => d !== null);
  const dms = dmIds.length
    ? await this['prisma'].delivery_men.findMany({
        where: { id: { in: dmIds } },
        select: { id: true, f_name: true, l_name: true, phone: true, zone_id: true },
      })
    : [];
  const map = new Map(dms.map((d) => [String(d.id), d]));
  return {
    top_delivery_men: groups.map((g) => {
      const d = g.delivery_man_id ? map.get(String(g.delivery_man_id)) : null;
      return {
        delivery_man_id: g.delivery_man_id ? Number(g.delivery_man_id) : null,
        name: d ? `${d.f_name ?? ''} ${d.l_name ?? ''}`.trim() : null,
        phone: d?.phone ?? null,
        zone_id: d?.zone_id ? Number(d.zone_id) : null,
        deliveries: g._count._all,
        total_tips: Number(g._sum.dm_tips ?? 0),
        total_delivery_charges: Number(g._sum.delivery_charge ?? 0),
        total_incentive: 0,
        total_bonus: 0,
      };
    }),
  };
};

function parseJsonField(s: string | null | undefined): unknown {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
