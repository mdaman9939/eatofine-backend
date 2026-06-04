import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';

interface MongoFood {
  mysql_id: number;
  name?: string;
  price?: number;
  tax?: number;
  tax_type?: string;
  veg?: boolean;
  mysql_category_id?: number;
}

interface MongoRestaurant {
  mysql_id: number;
  minimum_shipping_charge?: number;
  mysql_zone_id?: number;
}

interface MongoOrder {
  mysql_id: number;
  mysql_user_id?: number;
  mysql_restaurant_id?: number;
  mysql_delivery_man_id?: number;
  mysql_zone_id?: number;
  order_status?: string;
  payment_status?: string;
  payment_method?: string;
  order_type?: string;
  order_amount?: number;
  total_tax_amount?: number;
  delivery_charge?: number;
  coupon_discount_amount?: number;
  additional_charge?: number;
  restaurant_discount_amount?: number;
  otp?: string;
  pending?: Date | null;
  accepted?: Date | null;
  confirmed?: Date | null;
  processing?: Date | null;
  handover?: Date | null;
  picked_up?: Date | null;
  delivered?: Date | null;
  created_at_legacy?: Date;
  items?: Array<Record<string, unknown>>;
}

interface MongoOrderCancelReason {
  mysql_id?: number;
  reason?: string;
  user_type?: string;
  status?: boolean;
}

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mongo: MongoDataService,
  ) {}

  /** Feature flag — when "1", order reads/writes go to MongoDB instead of MySQL. */
  private useMongo(): boolean {
    const v = (process.env.USE_MONGO_ORDER ?? '1').toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }

  async placeOrder(
    userId: bigint,
    body: {
      cart?: Array<{ item_id?: number; quantity?: number; price?: number; variations?: unknown[]; add_on_ids?: number[]; add_on_qtys?: number[] }>;
      order_amount?: number;
      payment_method?: string;
      order_type?: string;
      restaurant_id?: number;
      distance?: number;
      address?: string;
      latitude?: string;
      longitude?: string;
      contact_person_name?: string;
      contact_person_number?: string;
      address_type?: string;
      road?: string;
      house?: string;
      floor?: string;
      delivery_address_id?: number;
      coupon_code?: string;
      order_note?: string;
      schedule_at?: string;
    },
  ) {
    if (!body.cart || body.cart.length === 0) {
      throw new BadRequestException({ errors: [{ code: 'cart', message: 'cart_is_empty' }] });
    }
    if (!body.restaurant_id) {
      throw new BadRequestException({ errors: [{ code: 'restaurant_id', message: 'required' }] });
    }
    const paymentMethod = body.payment_method ?? 'cash_on_delivery';
    if (paymentMethod !== 'cash_on_delivery') {
      throw new BadRequestException({
        errors: [{ code: 'payment_method', message: 'Only COD supported in demo backend' }],
      });
    }

    if (this.useMongo()) {
      const restaurant = await this.mongo.findByMysqlId<MongoRestaurant>('restaurants', body.restaurant_id);
      if (!restaurant) {
        throw new NotFoundException({ errors: [{ code: 'restaurant_id', message: 'not_found' }] });
      }

      const itemIds = body.cart.map((c) => Number(c.item_id ?? 0));
      const foods = await this.mongo.findMany<MongoFood>('foods', { mysql_id: { $in: itemIds } });
      const foodById = new Map<number, MongoFood>(foods.map((f) => [Number(f.mysql_id), f]));

      let orderAmount = 0;
      let totalTax = 0;
      for (const c of body.cart) {
        const f = foodById.get(Number(c.item_id ?? 0));
        if (!f) continue;
        const qty = c.quantity ?? 1;
        const price = c.price ?? Number(f.price ?? 0);
        const lineTotal = price * qty;
        const taxRate = Number(f.tax ?? 0) / 100;
        const lineTax = f.tax_type === 'percent' ? lineTotal * taxRate : Number(f.tax ?? 0) * qty;
        orderAmount += lineTotal;
        totalTax += lineTax;
      }

      const deliveryCharge = body.order_type === 'take_away' ? 0 : Number(restaurant.minimum_shipping_charge ?? 0);
      const finalAmount = Math.round((orderAmount + totalTax + deliveryCharge) * 100) / 100;
      const otp = String(Math.floor(1000 + Math.random() * 9000));
      const now = new Date();

      const orderMysqlId = await this.mongo.nextMysqlId('orders');

      // Build embedded items array (also written to order_details for parity)
      const items: Array<Record<string, unknown>> = [];
      for (const c of body.cart) {
        const f = foodById.get(Number(c.item_id ?? 0));
        if (!f) continue;
        const qty = c.quantity ?? 1;
        const price = c.price ?? Number(f.price ?? 0);
        const taxRate = Number(f.tax ?? 0) / 100;
        const lineTax = f.tax_type === 'percent' ? price * qty * taxRate : Number(f.tax ?? 0) * qty;
        const foodDetails = { id: Number(f.mysql_id), name: f.name, price: Number(f.price ?? 0), veg: f.veg ? 1 : 0 };
        items.push({
          food_id: Number(f.mysql_id),
          price,
          quantity: qty,
          tax_amount: Math.round(lineTax * 100) / 100,
          food_details: foodDetails,
          variation: c.variations ?? [],
          add_ons: [],
          discount_on_food: 0,
          discount_type: 'amount',
          total_add_on_price: 0,
          category_id: f.mysql_category_id ?? null,
        });
      }

      await this.mongo.insertOne<MongoOrder>('orders', {
        mysql_id: orderMysqlId,
        mysql_user_id: Number(userId),
        mysql_restaurant_id: Number(body.restaurant_id),
        mysql_zone_id: restaurant.mysql_zone_id,
        order_status: 'pending',
        payment_status: 'unpaid',
        payment_method: paymentMethod,
        order_type: body.order_type ?? 'delivery',
        order_amount: finalAmount,
        total_tax_amount: Math.round(totalTax * 100) / 100,
        delivery_charge: deliveryCharge,
        coupon_discount_amount: 0,
        additional_charge: 0,
        restaurant_discount_amount: 0,
        otp,
        pending: now,
        items,
        created_at_legacy: now,
      });

      // Mirror to order_details collection for joins from other services
      for (const it of items) {
        const odMysqlId = await this.mongo.nextMysqlId('order_details');
        await this.mongo.insertOne('order_details', {
          mysql_id: odMysqlId,
          order_id: orderMysqlId,
          food_id: it.food_id,
          food_details: it.food_details,
          price: it.price,
          quantity: it.quantity,
          tax_amount: it.tax_amount,
          discount_on_food: it.discount_on_food,
          discount_type: it.discount_type,
          total_add_on_price: it.total_add_on_price,
          variation: it.variation,
          add_ons: it.add_ons,
          category_id: it.category_id,
          created_at: now,
          updated_at: now,
        });
      }

      // Clear cart for this user (best-effort — carts collection may not exist)
      try {
        await this.mongo.updateMany('carts', { mysql_user_id: Number(userId), is_guest: false }, {});
      } catch {
        // ignore — cart cleanup is non-fatal
      }

      return {
        message: 'order_placed_successfully',
        order_id: orderMysqlId,
        total_ammount: finalAmount,
      };
    }

    const restaurant = await this.prisma.restaurants.findUnique({
      where: { id: BigInt(body.restaurant_id) },
    });
    if (!restaurant) {
      throw new NotFoundException({ errors: [{ code: 'restaurant_id', message: 'not_found' }] });
    }

    const itemIds = body.cart.map((c) => BigInt(c.item_id ?? 0));
    const foods = await this.prisma.food.findMany({ where: { id: { in: itemIds } } });
    const foodById = new Map(foods.map((f) => [f.id, f]));

    let orderAmount = 0;
    let totalTax = 0;
    for (const c of body.cart) {
      const f = foodById.get(BigInt(c.item_id ?? 0));
      if (!f) continue;
      const qty = c.quantity ?? 1;
      const price = c.price ?? Number(f.price);
      const lineTotal = price * qty;
      const taxRate = Number(f.tax) / 100;
      const lineTax = f.tax_type === 'percent' ? lineTotal * taxRate : Number(f.tax) * qty;
      orderAmount += lineTotal;
      totalTax += lineTax;
    }

    const deliveryCharge = body.order_type === 'take_away' ? 0 : Number(restaurant.minimum_shipping_charge ?? 0);
    const finalAmount = Math.round((orderAmount + totalTax + deliveryCharge) * 100) / 100;

    const otp = String(Math.floor(1000 + Math.random() * 9000));

    const order = await this.prisma.orders.create({
      data: {
        user_id: userId,
        order_amount: finalAmount,
        total_tax_amount: Math.round(totalTax * 100) / 100,
        payment_method: paymentMethod,
        payment_status: 'unpaid',
        order_status: 'pending',
        delivery_address_id: body.delivery_address_id ? BigInt(body.delivery_address_id) : null,
        order_type: body.order_type ?? 'delivery',
        restaurant_id: BigInt(body.restaurant_id),
        delivery_charge: deliveryCharge,
        otp,
        pending: new Date(),
        order_note: body.order_note,
        coupon_code: body.coupon_code,
        schedule_at: body.schedule_at ? new Date(body.schedule_at) : null,
        restaurant_discount_amount: 0,
        delivery_address: body.address,
        zone_id: restaurant.zone_id,
        distance: body.distance,
      },
    });

    for (const c of body.cart) {
      const f = foodById.get(BigInt(c.item_id ?? 0));
      if (!f) continue;
      const qty = c.quantity ?? 1;
      const price = c.price ?? Number(f.price);
      const taxRate = Number(f.tax) / 100;
      const lineTax = f.tax_type === 'percent' ? price * qty * taxRate : Number(f.tax) * qty;
      await this.prisma.order_details.create({
        data: {
          food_id: f.id,
          order_id: order.id,
          price,
          quantity: qty,
          tax_amount: Math.round(lineTax * 100) / 100,
          food_details: JSON.stringify({ id: Number(f.id), name: f.name, price: Number(f.price), veg: f.veg ? 1 : 0 }),
          variation: JSON.stringify(c.variations ?? []),
          add_ons: JSON.stringify([]),
          discount_on_food: 0,
          discount_type: 'amount',
          total_add_on_price: 0,
          category_id: f.category_id ? Number(f.category_id) : null,
        },
      });
    }

    await this.prisma.carts.deleteMany({ where: { user_id: userId, is_guest: false } });

    return {
      message: 'order_placed_successfully',
      order_id: Number(order.id),
      total_ammount: finalAmount,
    };
  }

  async trackOrder(orderId: number) {
    if (this.useMongo()) {
      const o = await this.mongo.findByMysqlId<MongoOrder>('orders', orderId);
      if (!o) throw new NotFoundException({ errors: [{ code: 'order_id', message: 'not_found' }] });
      return {
        id: o.mysql_id,
        order_status: o.order_status,
        payment_status: o.payment_status,
        payment_method: o.payment_method,
        order_amount: Number(o.order_amount ?? 0),
        restaurant_id: o.mysql_restaurant_id ?? null,
        delivery_man_id: o.mysql_delivery_man_id ?? null,
        pending: o.pending ?? null,
        accepted: o.accepted ?? null,
        confirmed: o.confirmed ?? null,
        processing: o.processing ?? null,
        handover: o.handover ?? null,
        picked_up: o.picked_up ?? null,
        delivered: o.delivered ?? null,
        otp: o.otp ?? null,
      };
    }
    const o = await this.prisma.orders.findUnique({ where: { id: BigInt(orderId) } });
    if (!o) throw new NotFoundException({ errors: [{ code: 'order_id', message: 'not_found' }] });
    return {
      id: o.id,
      order_status: o.order_status,
      payment_status: o.payment_status,
      payment_method: o.payment_method,
      order_amount: Number(o.order_amount),
      restaurant_id: o.restaurant_id,
      delivery_man_id: o.delivery_man_id,
      pending: o.pending,
      accepted: o.accepted,
      confirmed: o.confirmed,
      processing: o.processing,
      handover: o.handover,
      picked_up: o.picked_up,
      delivered: o.delivered,
      otp: o.otp,
    };
  }

  async customerOrderList(userId: bigint) {
    if (this.useMongo()) {
      const orders = await this.mongo.findMany<MongoOrder>(
        'orders',
        { mysql_user_id: Number(userId) },
        { sort: { mysql_id: -1 } },
      );
      return {
        total_size: orders.length,
        limit: 10,
        offset: 1,
        orders: orders.map((o) => ({
          id: o.mysql_id,
          order_status: o.order_status,
          payment_status: o.payment_status,
          order_amount: Number(o.order_amount ?? 0),
          payment_method: o.payment_method,
          restaurant_id: o.mysql_restaurant_id ?? null,
          created_at: o.created_at_legacy ?? null,
        })),
      };
    }
    const orders = await this.prisma.orders.findMany({
      where: { user_id: userId },
      orderBy: { id: 'desc' },
    });
    return {
      total_size: orders.length,
      limit: 10,
      offset: 1,
      orders: orders.map((o) => ({
        id: o.id,
        order_status: o.order_status,
        payment_status: o.payment_status,
        order_amount: Number(o.order_amount),
        payment_method: o.payment_method,
        restaurant_id: o.restaurant_id,
        created_at: o.created_at,
      })),
    };
  }

  async cancellationReasons() {
    if (this.useMongo()) {
      const rows = await this.mongo
        .findMany<MongoOrderCancelReason>('order_cancel_reasons', { status: true })
        .catch(() => [] as MongoOrderCancelReason[]);
      return {
        reasons: rows.map((r) => ({
          id: r.mysql_id ?? null,
          reason: r.reason ?? null,
          user_type: r.user_type ?? null,
          status: r.status ?? true,
        })),
      };
    }
    const rows = await this.prisma.order_cancel_reasons.findMany({ where: { status: true } }).catch(() => []);
    return { reasons: rows };
  }
}
