import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';
import { storageFullUrl } from '../common/storage-url';
import { FcmService } from '../notifications/fcm.service';
import { UserDeliveryChargesService } from '../enhancements/user-delivery-charges.service';
import { ZoneService } from '../zone/zone.service';
import { computeFlatAdditionalCharge, type AdditionalChargeRow } from '../common/additional-charge';

/** Great-circle distance between two lat/lng points, in kilometres. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface MongoFood {
  mysql_id: number;
  name?: string;
  price?: number;
  tax?: number;
  tax_type?: string;
  veg?: boolean;
  mysql_category_id?: number;
  stock_type?: string;
  item_stock?: number;
  sell_count?: number;
}

interface MongoRestaurant {
  mysql_id: number;
  minimum_shipping_charge?: number;
  mysql_zone_id?: number;
  latitude?: string | number | null;
  longitude?: string | number | null;
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
  coupon_code?: string | null;
  discount_owner?: string | null;
  admin_discount_amount?: number;
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
    private readonly fcm: FcmService,
    private readonly userCharges: UserDeliveryChargesService,
    private readonly zones: ZoneService,
  ) {}

  /** Push a real-time "new order" FCM notification to the restaurant's vendor
   *  device. Looks up the vendor's stored fcm_token via the restaurant. Fully
   *  best-effort — never throws, no-ops when FCM creds / token are absent. */
  private async pushNewOrderToRestaurant(restaurantId: number, orderId: number): Promise<void> {
    try {
      const restaurant = await this.mongo.findOne<{ mysql_vendor_id?: number; name?: string }>(
        'restaurants',
        { mysql_id: Number(restaurantId) },
      );
      const vendorId = Number(restaurant?.mysql_vendor_id ?? 0);
      if (!vendorId) return;
      const vendor = await this.mongo.findOne<{ fcm_token?: string }>(
        'vendors',
        { mysql_id: vendorId },
      );
      const token = vendor?.fcm_token;
      if (!token) return;
      await this.fcm.sendToToken(
        token,
        { title: 'New order placed', body: `You have a new order #${orderId}` },
        { type: 'new_order', order_id: orderId, title: 'New order placed' },
      );
    } catch {
      // ignore — push is non-fatal
    }
  }

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
      cutlery?: number | string | boolean;
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

      // ── Zone geofence ──────────────────────────────────────────────────
      // A delivery customer may only order from a restaurant inside their own
      // zone (e.g. a Delhi address cannot order a UP restaurant). We resolve the
      // delivery location's zone by point-in-polygon and reject a cross-zone or
      // out-of-coverage order. Take Away / Dine In are exempt (the buyer travels
      // to the restaurant). The check is a no-op until the admin draws zone
      // polygons (geofencingActive=false), so existing behaviour is preserved.
      if ((body.order_type ?? 'delivery') === 'delivery') {
        const dLat = Number(body.latitude);
        const dLng = Number(body.longitude);
        if (Number.isFinite(dLat) && Number.isFinite(dLng)) {
          const { zones, geofencingActive, serviceable } = await this.zones.classifyPoint(dLat, dLng);
          if (geofencingActive) {
            if (!serviceable) {
              throw new BadRequestException({ errors: [{ code: 'zone', message: 'We are not available at your location yet.' }] });
            }
            const zoneIds = zones.map((z) => z.id);
            if (restaurant.mysql_zone_id != null && !zoneIds.includes(Number(restaurant.mysql_zone_id))) {
              throw new BadRequestException({ errors: [{ code: 'zone', message: 'This restaurant does not deliver to your area.' }] });
            }
          }
        }
      }

      const itemIds = body.cart.map((c) => Number(c.item_id ?? 0));
      const foods = await this.mongo.findMany<MongoFood>('foods', { mysql_id: { $in: itemIds } });
      const foodById = new Map<number, MongoFood>(foods.map((f) => [Number(f.mysql_id), f]));

      // Stock guard — block ordering an out-of-stock item (or more than what is
      // left). Foods with stock_type 'unlimited' are always available.
      for (const c of body.cart) {
        const f = foodById.get(Number(c.item_id ?? 0));
        if (!f) continue;
        const stockType = String(f.stock_type ?? 'unlimited');
        if (stockType !== 'unlimited') {
          const available = Number(f.item_stock ?? 0);
          const wanted = Number(c.quantity ?? 1);
          if (available <= 0) {
            throw new BadRequestException({ errors: [{ code: 'stock', message: `${f.name ?? 'This item'} is out of stock` }] });
          }
          if (wanted > available) {
            throw new BadRequestException({ errors: [{ code: 'stock', message: `Only ${available} left of ${f.name ?? 'this item'}` }] });
          }
        }
      }

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

      // ── Coupon — backend-validated + discount-ownership aware ──────────────
      // We recompute the coupon discount here (authoritative — the customer is
      // charged what WE compute, not what the app sent), and split it by the
      // coupon's owner so the right party bears it:
      //   restaurant-funded → restaurant_discount_amount (restaurant bears it)
      //   admin-funded      → admin_discount_amount (Eatofine bears it)
      //   shared            → split per the coupon's configured amounts
      let couponDiscount = 0;
      let couponCode: string | null = null;
      let couponAdminDiscount = 0;
      let couponRestaurantDiscount = 0;
      let couponMysqlId: number | null = null;
      let couponOwner = 'admin';
      if (body.coupon_code && String(body.coupon_code).trim()) {
        const code = String(body.coupon_code).trim();
        const coupon = await this.mongo.findOne<{
          mysql_id: number; code?: string; discount?: number; discount_type?: string;
          min_purchase?: number; max_discount?: number; start_date?: Date | string | null;
          expire_date?: Date | string | null; limit?: number | null; total_uses?: number | null;
          status?: boolean | number; mysql_restaurant_id?: number | null;
          discount_owner?: string; admin_discount_amount?: number; restaurant_discount_amount?: number;
        }>('coupons', { code });
        const now2 = new Date();
        const okStatus = !!coupon && (coupon.status === true || coupon.status === 1 || coupon.status === undefined);
        const okStart = !coupon?.start_date || new Date(coupon.start_date) <= now2;
        const okEnd = !coupon?.expire_date || new Date(coupon.expire_date) >= now2;
        const okMin = !coupon?.min_purchase || orderAmount >= Number(coupon.min_purchase);
        const okRest = coupon?.mysql_restaurant_id == null || Number(coupon.mysql_restaurant_id) === Number(body.restaurant_id);
        const okLimit = coupon?.limit == null || Number(coupon.total_uses ?? 0) < Number(coupon.limit);
        if (coupon && okStatus && okStart && okEnd && okMin && okRest && okLimit) {
          const dType = String(coupon.discount_type ?? 'percentage');
          let d = dType === 'percent' || dType === 'percentage'
            ? (orderAmount * Number(coupon.discount ?? 0)) / 100
            : Number(coupon.discount ?? 0);
          const maxD = Number(coupon.max_discount ?? 0);
          if (maxD > 0) d = Math.min(d, maxD);
          couponDiscount = Math.min(Math.round(d * 100) / 100, orderAmount);
          couponCode = code;
          couponMysqlId = Number(coupon.mysql_id);
          couponOwner = ['admin', 'restaurant', 'shared'].includes(String(coupon.discount_owner)) ? String(coupon.discount_owner) : 'admin';
          if (couponOwner === 'restaurant') {
            couponRestaurantDiscount = couponDiscount;
          } else if (couponOwner === 'shared') {
            const cfgA = Math.max(0, Number(coupon.admin_discount_amount ?? 0));
            const cfgR = Math.max(0, Number(coupon.restaurant_discount_amount ?? 0));
            const tot = cfgA + cfgR;
            const aShare = tot > 0 ? Math.round(((couponDiscount * cfgA) / tot) * 100) / 100 : couponDiscount;
            couponAdminDiscount = aShare;
            couponRestaurantDiscount = Math.round((couponDiscount - aShare) * 100) / 100;
          } else {
            couponAdminDiscount = couponDiscount;
          }
        }
      }

      // ── Delivery charge — distance-slab engine (User Delivery Charges) ──
      // The customer fee comes from the configured distance slabs + surge +
      // surcharges + free-delivery threshold (GST applied). Take-away = ₹0.
      // If no slab covers the distance, fall back to the restaurant flat fee.
      let deliveryCharge = 0;
      let deliveryGst = 0;
      // Take Away and Dine In are collected/eaten at the restaurant — no delivery
      // leg, so they carry no delivery charge. Only Home Delivery is charged.
      if (body.order_type !== 'take_away' && body.order_type !== 'dine_in') {
        // Distance: prefer what the app sent, else compute from coordinates.
        let distanceKm = body.distance != null && Number.isFinite(Number(body.distance)) ? Math.max(0, Number(body.distance)) : NaN;
        if (Number.isNaN(distanceKm)) {
          const rLat = Number(restaurant.latitude), rLng = Number(restaurant.longitude);
          const uLat = Number(body.latitude), uLng = Number(body.longitude);
          distanceKm = [rLat, rLng, uLat, uLng].every((n) => Number.isFinite(n)) ? haversineKm(rLat, rLng, uLat, uLng) : 0;
        }
        try {
          const dc = await this.userCharges.calculate({ distance_km: distanceKm, order_value: orderAmount, when: body.schedule_at });
          if (dc.free_delivery) {
            deliveryCharge = 0;
          } else if (dc.matched_slab) {
            deliveryCharge = Number((dc as { subtotal?: number }).subtotal ?? 0);
            deliveryGst = Number(dc.gst_amount ?? 0);
          } else {
            // No active slab for this distance — fall back to the flat fee.
            deliveryCharge = Number(restaurant.minimum_shipping_charge ?? 0);
          }
        } catch {
          deliveryCharge = Number(restaurant.minimum_shipping_charge ?? 0);
        }
      }
      // Delivery GST rolls into the order's tax so the invoice CGST/SGST covers it.
      totalTax = Math.round((totalTax + deliveryGst) * 100) / 100;
      // Platform/packaging/convenience fees — the SAME flat value the customer
      // app shows from config, so the displayed total matches what we charge.
      const addChargeRows = await this.mongo.findMany<AdditionalChargeRow>('additional_user_charges', {});
      const additionalCharge = computeFlatAdditionalCharge(addChargeRows).amount;
      const finalAmount = Math.round((orderAmount - couponDiscount + totalTax + deliveryCharge + additionalCharge) * 100) / 100;
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

      // Resolve delivery_address from request body OR the customer's saved
      // default address — otherwise the Flutter detail screen renders
      // "Name : (null)" because order.deliveryAddress is missing.
      let deliveryAddress: Record<string, unknown> | null = null;
      if (body.contact_person_name || body.address || body.latitude) {
        deliveryAddress = {
          contact_person_name: body.contact_person_name ?? null,
          contact_person_number: body.contact_person_number ?? null,
          address_type: body.address_type ?? 'home',
          address: body.address ?? null,
          road: body.road ?? null,
          house: body.house ?? null,
          floor: body.floor ?? null,
          latitude: body.latitude ?? null,
          longitude: body.longitude ?? null,
        };
      } else if (body.delivery_address_id != null) {
        const addr = await this.mongo.findByMysqlId<Record<string, unknown>>(
          'customer_addresses', Number(body.delivery_address_id),
        );
        if (addr) {
          deliveryAddress = {
            contact_person_name: addr.contact_person_name ?? null,
            contact_person_number: addr.contact_person_number ?? null,
            address_type: addr.address_type ?? 'home',
            address: addr.address ?? null,
            road: addr.road ?? null,
            house: addr.house ?? null,
            floor: addr.floor ?? null,
            latitude: addr.latitude ?? null,
            longitude: addr.longitude ?? null,
          };
        }
      }
      // Final fallback: pull the customer's default saved address.
      if (!deliveryAddress) {
        const matches = await this.mongo.findMany<Record<string, unknown>>(
          'customer_addresses',
          { $or: [{ user_id: Number(userId) }, { mysql_user_id: Number(userId) }] },
          { sort: { is_default: -1, mysql_id: -1 }, limit: 1 },
        );
        const defaultAddr = matches[0] ?? null;
        if (defaultAddr) {
          deliveryAddress = {
            contact_person_name: defaultAddr.contact_person_name ?? null,
            contact_person_number: defaultAddr.contact_person_number ?? null,
            address_type: defaultAddr.address_type ?? 'home',
            address: defaultAddr.address ?? null,
            road: defaultAddr.road ?? null,
            house: defaultAddr.house ?? null,
            floor: defaultAddr.floor ?? null,
            latitude: defaultAddr.latitude ?? null,
            longitude: defaultAddr.longitude ?? null,
          };
        }
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
        coupon_discount_amount: couponDiscount,
        coupon_code: couponCode,
        discount_owner: couponCode ? couponOwner : null,
        admin_discount_amount: couponAdminDiscount,
        additional_charge: additionalCharge,
        restaurant_discount_amount: couponRestaurantDiscount,
        otp,
        pending: now,
        items,
        // Customer app sends cutlery as 1 / 0 / "1" / true — normalise to
        // boolean so the order details screen renders Yes/No deterministically.
        cutlery: !!Number(body.cutlery ?? 0) || body.cutlery === true,
        order_note: body.order_note ?? null,
        delivery_address: deliveryAddress,
        created_at: now,
        updated_at: now,
        created_at_legacy: now,
      } as MongoOrder);

      // Count one coupon redemption (atomic) so usage limits hold.
      if (couponMysqlId != null) {
        await this.mongo.increment('coupons', { mysql_id: couponMysqlId }, { total_uses: 1 });
      }

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

      // Decrement stock for limited-stock foods + bump sell_count, so the item
      // goes "out of stock" once depleted and can't be ordered again.
      for (const c of body.cart) {
        const f = foodById.get(Number(c.item_id ?? 0));
        if (!f) continue;
        const qty = Number(c.quantity ?? 1);
        const data: Record<string, unknown> = { sell_count: Number(f.sell_count ?? 0) + qty, updated_at: now };
        if (String(f.stock_type ?? 'unlimited') !== 'unlimited') {
          data.item_stock = Math.max(0, Number(f.item_stock ?? 0) - qty);
        }
        await this.mongo.updateOne('foods', { mysql_id: Number(f.mysql_id) }, data).catch(() => undefined);
      }

      // In-app notification for the restaurant — so the vendor's notification
      // bell shows the new order even without a live FCM push (push needs the
      // FCM server key). Scoped to this restaurant so only its owner sees it.
      try {
        const notifId = await this.mongo.nextMysqlId('notifications');
        await this.mongo.insertOne('notifications', {
          mysql_id: notifId,
          title: 'New order received',
          description: `Order #${orderMysqlId} has just been placed.`,
          mysql_restaurant_id: Number(body.restaurant_id),
          target: 'restaurant',
          order_id: orderMysqlId,
          status: true,
          created_at: now,
          updated_at: now,
        });
      } catch {
        // ignore — notification is non-fatal
      }

      // Real-time FCM push to the restaurant's vendor device — instant
      // new-order alert (sound + popup) without waiting for the 15s poll.
      await this.pushNewOrderToRestaurant(Number(body.restaurant_id), orderMysqlId);

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

  /** Build the delivery_address payload Flutter's order screen expects.
   *  Resolution order: order.delivery_address blob → customer's default
   *  saved address → synthesised stub from the customer's name/phone.
   *  Result always has contact_person_name + contact_person_number so the
   *  detail screen never renders "(null)". */
  private buildDeliveryAddress(
    order: { delivery_address?: unknown },
    defaultAddr: Record<string, unknown> | null,
    customer: { f_name?: string; l_name?: string; phone?: string } | null,
  ): Record<string, unknown> {
    const fromOrder = order.delivery_address as Record<string, unknown> | string | null | undefined;
    const fromOrderObj = fromOrder && typeof fromOrder === 'object' ? fromOrder : {};
    const fromOrderStr = typeof fromOrder === 'string' ? fromOrder : null;
    const customerFullName = customer
      ? `${customer.f_name ?? ''} ${customer.l_name ?? ''}`.trim() || null
      : null;
    return {
      contact_person_name:
        fromOrderObj.contact_person_name
        ?? defaultAddr?.contact_person_name
        ?? customerFullName
        ?? 'Customer',
      contact_person_number:
        fromOrderObj.contact_person_number
        ?? defaultAddr?.contact_person_number
        ?? customer?.phone
        ?? null,
      address_type: fromOrderObj.address_type ?? defaultAddr?.address_type ?? 'home',
      address: fromOrderObj.address ?? defaultAddr?.address ?? fromOrderStr ?? null,
      road: fromOrderObj.road ?? defaultAddr?.road ?? null,
      house: fromOrderObj.house ?? defaultAddr?.house ?? null,
      floor: fromOrderObj.floor ?? defaultAddr?.floor ?? null,
      latitude: fromOrderObj.latitude ?? defaultAddr?.latitude ?? null,
      longitude: fromOrderObj.longitude ?? defaultAddr?.longitude ?? null,
    };
  }

  async trackOrder(orderId: number) {
    if (this.useMongo()) {
      const o = await this.mongo.findByMysqlId<MongoOrder>('orders', orderId);
      if (!o) throw new NotFoundException({ errors: [{ code: 'order_id', message: 'not_found' }] });

      // Flutter customer app's track screen reads track.restaurant.name,
      // track.customer.f_name, track.deliveryMan.f_name, and
      // track.deliveryAddress.contactPersonName as nested objects — not
      // just the IDs. Eagerly fetch each so the detail card renders
      // properly instead of "No restaurant data found" / "Name : (null)".
      const [restaurant, customer, deliveryMan, defaultAddr] = await Promise.all([
        o.mysql_restaurant_id != null
          ? this.mongo.findByMysqlId<{ mysql_id: number; name?: string; phone?: string; email?: string; address?: string; logo?: string; latitude?: number; longitude?: number }>('restaurants', Number(o.mysql_restaurant_id))
          : Promise.resolve(null),
        o.mysql_user_id != null
          ? this.mongo.findByMysqlId<{ mysql_id: number; f_name?: string; l_name?: string; phone?: string; email?: string; image?: string }>('users', Number(o.mysql_user_id))
          : Promise.resolve(null),
        o.mysql_delivery_man_id != null
          ? this.mongo.findByMysqlId<{ mysql_id: number; f_name?: string; l_name?: string; phone?: string; image?: string; latitude?: number; longitude?: number; location?: string }>('delivery_men', Number(o.mysql_delivery_man_id))
          : Promise.resolve(null),
        // Backfill chain — if the order itself doesn't carry a
        // delivery_address blob, fall back to the customer's default saved
        // address so the detail screen still shows a name + phone instead
        // of "(null)".
        o.mysql_user_id != null
          ? this.mongo.findMany<Record<string, unknown>>(
              'customer_addresses',
              { $or: [{ user_id: Number(o.mysql_user_id) }, { mysql_user_id: Number(o.mysql_user_id) }] },
              { sort: { is_default: -1, mysql_id: -1 }, limit: 1 },
            ).then((rows) => rows[0] ?? null)
          : Promise.resolve(null),
      ]);

      const restCover = (restaurant as { cover_photo?: string | null } | null)?.cover_photo ?? null;
      const restaurantPayload = restaurant ? {
        id: Number(restaurant.mysql_id),
        name: restaurant.name ?? 'Restaurant',
        phone: restaurant.phone ?? null,
        email: restaurant.email ?? null,
        address: restaurant.address ?? null,
        logo: restaurant.logo ?? 'default.png',
        // The Flutter app reads *_full_url for the logo / cover image.
        logo_full_url: storageFullUrl('restaurant', restaurant.logo ?? null),
        image_full_url: storageFullUrl('restaurant', restaurant.logo ?? null),
        cover_photo: restCover,
        cover_photo_full_url: storageFullUrl('restaurant/cover', restCover),
        latitude: restaurant.latitude != null ? String(restaurant.latitude) : null,
        longitude: restaurant.longitude != null ? String(restaurant.longitude) : null,
      } : null;
      const customerPayload = customer ? {
        id: Number(customer.mysql_id),
        f_name: customer.f_name ?? null,
        l_name: customer.l_name ?? null,
        phone: customer.phone ?? null,
        email: customer.email ?? null,
        image: customer.image ?? null,
        image_full_url: storageFullUrl('profile', customer.image ?? null),
      } : null;
      const dmRating = deliveryMan as unknown as { avg_rating?: number | null; rating_count?: number | null };
      const dmPayload = deliveryMan ? {
        id: Number(deliveryMan.mysql_id),
        f_name: deliveryMan.f_name ?? null,
        l_name: deliveryMan.l_name ?? null,
        phone: deliveryMan.phone ?? null,
        image: deliveryMan.image ?? null,
        image_full_url: storageFullUrl('delivery-man', deliveryMan.image ?? null),
        avg_rating: dmRating.avg_rating != null ? Number(dmRating.avg_rating) : 0,
        rating_count: dmRating.rating_count != null ? Number(dmRating.rating_count) : 0,
        // Live GPS — drives the moving delivery-man marker on the track map.
        lat: deliveryMan.latitude != null ? String(deliveryMan.latitude) : null,
        lng: deliveryMan.longitude != null ? String(deliveryMan.longitude) : null,
        location: deliveryMan.location ?? null,
      } : null;

      return {
        id: o.mysql_id,
        order_status: o.order_status,
        payment_status: o.payment_status,
        payment_method: o.payment_method,
        order_amount: Number(o.order_amount ?? 0),
        restaurant_id: o.mysql_restaurant_id ?? null,
        delivery_man_id: o.mysql_delivery_man_id ?? null,
        // Nested objects — what the Flutter Tracking screen actually reads
        restaurant: restaurantPayload,
        customer: customerPayload,
        delivery_man: dmPayload,
        deliveryMan: dmPayload, // alias — some Flutter parsers use camelCase
        delivery_address: this.buildDeliveryAddress(o as unknown as { delivery_address?: unknown }, defaultAddr, customer),
        cutlery: !!(o as unknown as { cutlery?: unknown }).cutlery,
        order_note: (o as unknown as { order_note?: string | null }).order_note ?? null,
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
      // Bulk-count items per order in one aggregation so the Flutter list
      // can show "3 items" instead of "0 Item". Default to embedded
      // `items` length, then to the aggregated count, then to 1.
      const orderIds = orders.map((o) => Number(o.mysql_id));
      const countRows = orderIds.length
        ? await this.mongo.aggregate<{ _id: number; count: number }>(
            'order_details',
            [
              { $match: { order_id: { $in: orderIds } } },
              { $group: { _id: '$order_id', count: { $sum: 1 } } },
            ],
          )
        : [];
      const countMap = new Map(countRows.map((r) => [Number(r._id), r.count]));
      return {
        total_size: orders.length,
        limit: 10,
        offset: 1,
        orders: orders.map((o) => {
          const embedded = Array.isArray((o as { items?: unknown[] }).items) ? (o as { items: unknown[] }).items.length : 0;
          const count = embedded || countMap.get(Number(o.mysql_id)) || 1;
          return {
            id: o.mysql_id,
            order_status: o.order_status,
            payment_status: o.payment_status,
            order_amount: Number(o.order_amount ?? 0),
            payment_method: o.payment_method,
            restaurant_id: o.mysql_restaurant_id ?? null,
            created_at: (o as { created_at?: Date | string | null }).created_at ?? o.created_at_legacy ?? null,
            details_count: count,
            cutlery: !!(o as unknown as { cutlery?: unknown }).cutlery,
          };
        }),
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
