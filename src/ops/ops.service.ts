import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';
import { SettlementService } from '../settlement/settlement.service';
import { OrderLifecycleService } from '../lifecycle/order-lifecycle.service';
import { RefundService } from '../refund/refund.service';
import { scenarioForRestaurantReject, type ScenarioKey } from '../refund/refund-policy';
import { storageBaseUrl } from '../common/storage-url';

const VENDOR_STATUSES = ['accepted', 'confirmed', 'processing', 'handover', 'ready_for_pickup', 'served', 'completed', 'canceled'] as const;
// The delivery app drives the full pickup→deliver flow and sends 'confirmed'
// (accept handover), 'picked_up', 'delivered', and 'canceled'. The old 2-item
// list rejected the others with "must be one of picked_up, delivered".
const DM_STATUSES = ['confirmed', 'processing', 'handover', 'ready_for_pickup', 'picked_up', 'out_for_delivery', 'delivered', 'completed', 'canceled'] as const;

type MongoOrderDoc = {
  mysql_id: number;
  mysql_user_id?: number | null;
  mysql_restaurant_id?: number | null;
  mysql_delivery_man_id?: number | null;
  mysql_zone_id?: number | null;
  order_status?: string;
  payment_status?: string;
  payment_method?: string | null;
  order_amount?: number;
  delivery_charge?: number;
  total_tax_amount?: number;
  order_type?: string;
  delivery_address?: string | null;
  delivery_address_id?: number | null;
  otp?: string | null;
  pending?: Date | null;
  accepted?: Date | null;
  confirmed?: Date | null;
  processing?: Date | null;
  handover?: Date | null;
  picked_up?: Date | null;
  delivered?: Date | null;
  canceled?: Date | null;
  created_at_legacy?: Date | null;
  created_at?: Date | null;
  items?: Array<Record<string, unknown>>;
};

type MongoOrderDetailDoc = {
  mysql_id: number;
  order_id?: number;
  food_id?: number | null;
  price?: number;
  quantity?: number;
  tax_amount?: number;
  food_details?: string | null;
};

@Injectable()
export class OpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mongo: MongoDataService,
    private readonly settlement: SettlementService,
    private readonly lifecycle: OrderLifecycleService,
    private readonly refund: RefundService,
  ) {}

  /** Feature flag â€” when "1", ops reads/writes route to MongoDB instead of MySQL. */
  private useMongo(): boolean {
    const v = (process.env.USE_MONGO_OPS ?? '1').toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }

  private storageBase(): string {
    return storageBaseUrl();
  }

  private async restaurantForVendor(vendorId: bigint) {
    return this.prisma.restaurants.findFirst({ where: { vendor_id: vendorId } });
  }

  /** Mongo equivalent â€” restaurant doc keyed off mysql_vendor_id. */
  private async restaurantForVendorMongo(vendorId: bigint) {
    return this.mongo.findOne<{
      mysql_id: number;
      name?: string;
      mysql_vendor_id?: number;
      mysql_zone_id?: number;
    }>('restaurants', { mysql_vendor_id: Number(vendorId) });
  }

  private async loadOrderDetails(orderId: bigint) {
    const order = await this.prisma.orders.findUnique({ where: { id: orderId } });
    if (!order) return null;
    const details = await this.prisma.order_details.findMany({ where: { order_id: orderId } });
    return { order, details };
  }

  private mapOrder(
    o: {
      id: bigint;
      user_id: bigint | null;
      order_status: string;
      payment_status: string;
      payment_method: string | null;
      order_amount: number | { toString(): string };
      delivery_charge: number | { toString(): string };
      total_tax_amount: number | { toString(): string };
      restaurant_id: bigint;
      delivery_man_id: bigint | null;
      delivery_address_id: bigint | null;
      delivery_address: string | null;
      order_type: string;
      otp: string | null;
      pending: Date | null;
      accepted: Date | null;
      confirmed: Date | null;
      processing: Date | null;
      handover: Date | null;
      picked_up: Date | null;
      delivered: Date | null;
      canceled: Date | null;
      created_at: Date | null;
    },
  ) {
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

  /** Map a Mongo order doc to the same shape Prisma `mapOrder` returns.
   * Converts `mysql_*` numeric ids back to plain integers under the
   * historical key names (id, user_id, restaurant_id, delivery_man_id). */
  private mapMongoOrder(o: MongoOrderDoc) {
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

  async vendorOrders(vendorId: bigint, status?: string) {
    if (this.useMongo()) {
      const restaurant = await this.restaurantForVendorMongo(vendorId);
      if (!restaurant) throw new NotFoundException({ errors: [{ code: 'restaurant', message: 'not_found' }] });
      const filter: Record<string, unknown> = { mysql_restaurant_id: Number(restaurant.mysql_id) };
      if (status && status !== 'all') {
        if (status === 'ongoing') {
          filter.order_status = { $in: ['accepted', 'confirmed', 'processing', 'handover', 'picked_up'] };
        } else {
          filter.order_status = status;
        }
      }
      const orders = await this.mongo.findMany<MongoOrderDoc>('orders', filter, { sort: { mysql_id: -1 } });
      return {
        total_size: orders.length,
        limit: 20,
        offset: 1,
        orders: orders.map((o) => this.mapMongoOrder(o)),
      };
    }
    const restaurant = await this.restaurantForVendor(vendorId);
    if (!restaurant) throw new NotFoundException({ errors: [{ code: 'restaurant', message: 'not_found' }] });
    const where: { restaurant_id: bigint; order_status?: string | { in: string[] } } = {
      restaurant_id: restaurant.id,
    };
    if (status && status !== 'all') {
      if (status === 'ongoing') where.order_status = { in: ['accepted', 'confirmed', 'processing', 'handover', 'picked_up'] };
      else where.order_status = status;
    }
    const orders = await this.prisma.orders.findMany({ where, orderBy: { id: 'desc' } });
    return {
      total_size: orders.length,
      limit: 20,
      offset: 1,
      orders: orders.map((o) => this.mapOrder(o)),
    };
  }

  async vendorOrderDetail(vendorId: bigint, orderId: number) {
    if (this.useMongo()) {
      const restaurant = await this.restaurantForVendorMongo(vendorId);
      if (!restaurant) throw new NotFoundException({ errors: [{ code: 'restaurant', message: 'not_found' }] });
      const order = await this.mongo.findByMysqlId<MongoOrderDoc>('orders', orderId);
      if (!order || Number(order.mysql_restaurant_id) !== Number(restaurant.mysql_id)) {
        throw new NotFoundException({ errors: [{ code: 'order_id', message: 'not_found' }] });
      }
      const details = await this.mongo.findMany<MongoOrderDetailDoc>(
        'order_details',
        { order_id: Number(order.mysql_id) },
        { sort: { mysql_id: 1 } },
      );
      const customer = order.mysql_user_id
        ? await this.mongo.findByMysqlId<{
            mysql_id: number;
            f_name?: string | null;
            l_name?: string | null;
            phone?: string | null;
            email?: string | null;
          }>('users', Number(order.mysql_user_id))
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
    if (!restaurant) throw new NotFoundException({ errors: [{ code: 'restaurant', message: 'not_found' }] });
    const res = await this.loadOrderDetails(BigInt(orderId));
    if (!res || res.order.restaurant_id !== restaurant.id) {
      throw new NotFoundException({ errors: [{ code: 'order_id', message: 'not_found' }] });
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

  async vendorUpdateStatus(vendorId: bigint, orderId: number, newStatus: string, reason?: string) {
    if (!VENDOR_STATUSES.includes(newStatus as (typeof VENDOR_STATUSES)[number])) {
      throw new BadRequestException({
        errors: [{ code: 'order_status', message: `must be one of ${VENDOR_STATUSES.join(', ')}` }],
      });
    }
    if (this.useMongo()) {
      const restaurant = await this.restaurantForVendorMongo(vendorId);
      if (!restaurant) throw new NotFoundException({ errors: [{ code: 'restaurant', message: 'not_found' }] });
      const o = await this.mongo.findByMysqlId<MongoOrderDoc>('orders', orderId);
      if (!o || Number(o.mysql_restaurant_id) !== Number(restaurant.mysql_id)) {
        throw new NotFoundException({ errors: [{ code: 'order_id', message: 'not_found' }] });
      }
      // Restaurant rejects/cancels (Case 2 item_unavailable / Case 4 restaurant_cancelled).
      if (newStatus === 'canceled') {
        const r = reason === 'item_unavailable' ? 'item_unavailable'
          : reason === 'restaurant_closed' ? 'restaurant_closed'
            : reason === 'restaurant_unavailable' ? 'restaurant_unavailable'
              : 'restaurant_cancelled';
        // Capture the stage BEFORE the cancel mutates order_status — it decides
        // which restaurant-rejection penalty scenario applies.
        const preStatus = String(o.order_status ?? 'pending');
        const hadDeliveryMan = o.mysql_delivery_man_id != null;
        // Lifecycle owns the customer side: full refund to the user (prepaid),
        // status, audit, notifications.
        await this.lifecycle.cancelOrder(Number(o.mysql_id), r, 'restaurant');
        // Refund engine owns the partner side: park the penalty for admin review
        // (no partner wallet moves until an admin confirms). The scenario is
        // chosen from the order's stage, unless an admin has mapped this exact
        // cancel reason to a specific fault scenario (configurable override).
        let scenarioKey: ScenarioKey = scenarioForRestaurantReject(preStatus, hadDeliveryMan);
        const override = await this.mongo.findOne<{ scenario_key?: string | null }>('order_cancel_reasons', {
          user_type: 'restaurant',
          scenario_key: { $nin: [null, ''] },
          $or: [{ reason }, { reason: r }],
        }).catch(() => null);
        if (override?.scenario_key) scenarioKey = override.scenario_key as ScenarioKey;
        await this.refund.proposePartnerPenalty(Number(o.mysql_id), scenarioKey, 'restaurant', r).catch(() => undefined);
        return { message: 'order_cancelled', order_status: 'canceled' };
      }
      const fromStatus = o.order_status;
      this.lifecycle.assertTransition(o.order_type, fromStatus, newStatus); // no-op unless STRICT enabled
      const data: Record<string, unknown> = { order_status: newStatus };
      data[newStatus] = new Date();
      if (newStatus === 'confirmed') {
        data.payment_status = o.payment_method === 'cash_on_delivery' ? 'unpaid' : 'paid';
      }
      await this.mongo.updateOne('orders', { mysql_id: Number(o.mysql_id) }, data);
      await this.lifecycle.recordTransition(Number(o.mysql_id), fromStatus, newStatus, 'restaurant').catch(() => undefined);
      // Settlement when a Take Away / Dine In order is completed at the counter.
      if (newStatus === 'completed') {
        await this.settlement.settleOrder(Number(o.mysql_id)).catch(() => undefined);
      }
      return { message: 'order_status_updated', order_status: newStatus };
    }
    const restaurant = await this.restaurantForVendor(vendorId);
    if (!restaurant) throw new NotFoundException({ errors: [{ code: 'restaurant', message: 'not_found' }] });
    const o = await this.prisma.orders.findFirst({
      where: { id: BigInt(orderId), restaurant_id: restaurant.id },
    });
    if (!o) throw new NotFoundException({ errors: [{ code: 'order_id', message: 'not_found' }] });
    const data: Record<string, unknown> = { order_status: newStatus };
    data[newStatus] = new Date();
    if (newStatus === 'confirmed') data.payment_status = o.payment_method === 'cash_on_delivery' ? 'unpaid' : 'paid';
    await this.prisma.orders.update({ where: { id: o.id }, data });
    return { message: 'order_status_updated', order_status: newStatus };
  }

  async vendorAssignDeliveryMan(vendorId: bigint, orderId: number, deliveryManId: number) {
    if (this.useMongo()) {
      const restaurant = await this.restaurantForVendorMongo(vendorId);
      if (!restaurant) throw new NotFoundException({ errors: [{ code: 'restaurant', message: 'not_found' }] });
      const o = await this.mongo.findByMysqlId<MongoOrderDoc>('orders', orderId);
      if (!o || Number(o.mysql_restaurant_id) !== Number(restaurant.mysql_id)) {
        throw new NotFoundException({ errors: [{ code: 'order_id', message: 'not_found' }] });
      }
      const dm = await this.mongo.findByMysqlId<{ mysql_id: number }>('delivery_men', deliveryManId);
      if (!dm) throw new NotFoundException({ errors: [{ code: 'delivery_man_id', message: 'not_found' }] });
      const data: Record<string, unknown> = { mysql_delivery_man_id: Number(deliveryManId) };
      // Keep existing order_status as-is â€” Prisma version writes back the same value, so we don't touch it.
      await this.mongo.updateOne('orders', { mysql_id: Number(o.mysql_id) }, data);
      return { message: 'delivery_man_assigned', order_id: Number(o.mysql_id), delivery_man_id: deliveryManId };
    }
    const restaurant = await this.restaurantForVendor(vendorId);
    if (!restaurant) throw new NotFoundException({ errors: [{ code: 'restaurant', message: 'not_found' }] });
    const o = await this.prisma.orders.findFirst({
      where: { id: BigInt(orderId), restaurant_id: restaurant.id },
    });
    if (!o) throw new NotFoundException({ errors: [{ code: 'order_id', message: 'not_found' }] });
    const dm = await this.prisma.delivery_men.findUnique({ where: { id: BigInt(deliveryManId) } });
    if (!dm) throw new NotFoundException({ errors: [{ code: 'delivery_man_id', message: 'not_found' }] });
    await this.prisma.orders.update({
      where: { id: o.id },
      data: { delivery_man_id: BigInt(deliveryManId), order_status: o.order_status === 'handover' ? 'handover' : o.order_status },
    });
    return { message: 'delivery_man_assigned', order_id: Number(o.id), delivery_man_id: deliveryManId };
  }

  async vendorAllDeliveryMen(vendorId: bigint) {
    if (this.useMongo()) {
      const restaurant = await this.restaurantForVendorMongo(vendorId);
      if (!restaurant) throw new NotFoundException({ errors: [{ code: 'restaurant', message: 'not_found' }] });
      // Mongo `delivery_men` doesn't carry restaurant_id (it isn't migrated). The
      // Prisma version OR-matches by zone OR restaurant â€” here we filter by the
      // restaurant's zone only. Approved DMs only.
      const filter: Record<string, unknown> = { application_status: 'approved' };
      if (restaurant.mysql_zone_id != null) {
        filter.mysql_zone_id = Number(restaurant.mysql_zone_id);
      }
      const dms = await this.mongo.findMany<{
        mysql_id: number;
        f_name?: string | null;
        l_name?: string | null;
        phone?: string | null;
        email?: string | null;
        image?: string | null;
        status?: boolean;
      }>('delivery_men', filter);
      return dms.map((d) => ({
        id: Number(d.mysql_id),
        f_name: d.f_name ?? null,
        l_name: d.l_name ?? null,
        phone: d.phone ?? null,
        email: d.email ?? null,
        image: d.image ?? null,
        image_full_url: d.image ? `${this.storageBase()}/delivery-man/${d.image}` : null,
        status: d.status ? 1 : 0,
        // `current_orders` is not present in the Mongo schema; default to 0.
        current_orders: 0,
      }));
    }
    const restaurant = await this.restaurantForVendor(vendorId);
    if (!restaurant) throw new NotFoundException({ errors: [{ code: 'restaurant', message: 'not_found' }] });
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

  async dmCurrentOrders(dmId: bigint) {
    if (this.useMongo()) {
      const orders = await this.mongo.findMany<MongoOrderDoc>(
        'orders',
        {
          mysql_delivery_man_id: Number(dmId),
          order_status: { $in: ['accepted', 'confirmed', 'processing', 'handover', 'picked_up'] },
        },
        { sort: { mysql_id: -1 } },
      );
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

  async dmLatestOrders(dmId: bigint) {
    if (this.useMongo()) {
      const dm = await this.mongo.findByMysqlId<{ mysql_id: number; mysql_zone_id?: number }>('delivery_men', Number(dmId));
      const filter: Record<string, unknown> = {
        // Match unassigned orders: either missing or null. Prisma's
        // `delivery_man_id: null` translates to "no assignee" â€” in Mongo we
        // accept both null and absent.
        $or: [{ mysql_delivery_man_id: null }, { mysql_delivery_man_id: { $exists: false } }],
        order_status: 'handover',
      };
      if (dm?.mysql_zone_id != null) {
        filter.mysql_zone_id = Number(dm.mysql_zone_id);
      }
      const orders = await this.mongo.findMany<MongoOrderDoc>('orders', filter, { sort: { mysql_id: -1 } });
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

  async dmOrderDetail(dmId: bigint, orderId: number) {
    if (this.useMongo()) {
      const order = await this.mongo.findByMysqlId<MongoOrderDoc>('orders', orderId);
      const assigned = order?.mysql_delivery_man_id != null ? Number(order.mysql_delivery_man_id) : null;
      if (!order || (assigned !== null && assigned !== Number(dmId))) {
        throw new NotFoundException({ errors: [{ code: 'order_id', message: 'not_found' }] });
      }
      const details = await this.mongo.findMany<MongoOrderDetailDoc>(
        'order_details',
        { order_id: Number(order.mysql_id) },
        { sort: { mysql_id: 1 } },
      );
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
      throw new NotFoundException({ errors: [{ code: 'order_id', message: 'not_found' }] });
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

  async dmUpdateStatus(dmId: bigint, orderId: number, newStatus: string) {
    if (!DM_STATUSES.includes(newStatus as (typeof DM_STATUSES)[number])) {
      throw new BadRequestException({
        errors: [{ code: 'order_status', message: `must be one of ${DM_STATUSES.join(', ')}` }],
      });
    }
    if (this.useMongo()) {
      const o = await this.mongo.findByMysqlId<MongoOrderDoc>('orders', orderId);
      if (!o || Number(o.mysql_delivery_man_id) !== Number(dmId)) {
        throw new NotFoundException({ errors: [{ code: 'order_id', message: 'not_found' }] });
      }
      // A rider rejecting an order must NOT cancel it — unassign + reassign, and
      // only cancel (delivery_partner_unavailable) if no rider is left.
      if (newStatus === 'canceled') {
        const res = await this.lifecycle.handleDeliveryRejection(Number(o.mysql_id), Number(dmId));
        return { message: res.cancelled ? 'no_rider_order_cancelled' : 'rider_reassigned', order_status: res.cancelled ? 'canceled' : String(o.order_status) };
      }
      const fromStatus = o.order_status;
      this.lifecycle.assertTransition(o.order_type, fromStatus, newStatus); // no-op unless STRICT enabled
      const data: Record<string, unknown> = { order_status: newStatus };
      data[newStatus] = new Date();
      if ((newStatus === 'delivered' || newStatus === 'completed') && o.payment_method === 'cash_on_delivery') {
        data.payment_status = 'paid';
      }
      await this.mongo.updateOne('orders', { mysql_id: Number(o.mysql_id) }, data);
      await this.lifecycle.recordTransition(Number(o.mysql_id), fromStatus, newStatus, 'delivery_partner').catch(() => undefined);
      // Idempotent Pay-Per-Order settlement on the terminal state (non-fatal).
      if (newStatus === 'delivered' || newStatus === 'completed') {
        await this.settlement.settleOrder(Number(o.mysql_id)).catch(() => undefined);
      }
      return { message: 'order_status_updated', order_status: newStatus };
    }
    const o = await this.prisma.orders.findFirst({ where: { id: BigInt(orderId), delivery_man_id: dmId } });
    if (!o) throw new NotFoundException({ errors: [{ code: 'order_id', message: 'not_found' }] });
    const data: Record<string, unknown> = { order_status: newStatus };
    data[newStatus] = new Date();
    if (newStatus === 'delivered' && o.payment_method === 'cash_on_delivery') {
      data.payment_status = 'paid';
    }
    await this.prisma.orders.update({ where: { id: o.id }, data });
    return { message: 'order_status_updated', order_status: newStatus };
  }

  /** Safe JSON parse â€” Mongo `food_details` may already be a JSON string from
   * the MySQL row (migrated as-is) or null. Returns null on parse failure. */
  private tryParse(s: string): unknown {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  }
}
