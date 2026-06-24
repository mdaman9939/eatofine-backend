/**
 * Canonical coupon validation + discount computation.
 *
 * Extracted so the customer place-order flow (order.service) AND the admin POS
 * (admin.service.createPosOrder) compute the SAME discount the SAME way — they
 * must stay in lockstep or the POS bill / customer total would diverge from
 * what is actually charged + recorded.
 *
 * Takes the MongoDataService instance directly (no Nest DI) so it can be reused
 * from any service without module wiring.
 */
import type { MongoDataService } from '../mongo/mongo-data.service';

interface CouponDoc {
  mysql_id: number;
  code?: string;
  discount?: number;
  discount_type?: string;
  min_purchase?: number;
  max_discount?: number;
  start_date?: Date | string | null;
  expire_date?: Date | string | null;
  limit?: number | null;
  total_uses?: number | null;
  status?: boolean | number;
  mysql_restaurant_id?: number | null;
  discount_owner?: string;
  admin_discount_amount?: number;
  restaurant_discount_amount?: number;
}

export interface CouponComputation {
  applied: boolean;
  couponCode: string | null;
  couponMysqlId: number | null;
  /** Total discount given to the customer. */
  couponDiscount: number;
  /** 'admin' | 'restaurant' | 'shared' — who funds the discount. */
  couponOwner: string;
  /** Eatofine-funded share of the discount. */
  adminDiscount: number;
  /** Restaurant-funded share of the discount. */
  restaurantDiscount: number;
  /** Present when the code was provided but invalid (expired, min not met, …). */
  reason?: string;
}

const EMPTY: CouponComputation = {
  applied: false,
  couponCode: null,
  couponMysqlId: null,
  couponDiscount: 0,
  couponOwner: 'admin',
  adminDiscount: 0,
  restaurantDiscount: 0,
};

/** Validate a coupon code for a restaurant and compute the discount + owner
 *  split for the given order subtotal. Authoritative for both the customer and
 *  POS flows. Never throws — an invalid code returns { applied:false, reason }. */
export async function validateAndComputeCoupon(
  mongo: MongoDataService,
  input: { code?: string | null; orderAmount: number; restaurantId?: number | null },
): Promise<CouponComputation> {
  const code = input.code ? String(input.code).trim() : '';
  if (!code) return { ...EMPTY };
  const orderAmount = Number(input.orderAmount ?? 0);
  const coupon = await mongo.findOne<CouponDoc>('coupons', { code });
  if (!coupon) return { ...EMPTY, reason: 'Invalid coupon code' };

  const now = new Date();
  const okStatus = coupon.status === true || coupon.status === 1 || coupon.status === undefined;
  const okStart = !coupon.start_date || new Date(coupon.start_date) <= now;
  const okEnd = !coupon.expire_date || new Date(coupon.expire_date) >= now;
  const okMin = !coupon.min_purchase || orderAmount >= Number(coupon.min_purchase);
  const okRest = coupon.mysql_restaurant_id == null || input.restaurantId == null
    || Number(coupon.mysql_restaurant_id) === Number(input.restaurantId);
  const okLimit = coupon.limit == null || Number(coupon.total_uses ?? 0) < Number(coupon.limit);
  if (!okStatus) return { ...EMPTY, reason: 'Coupon is inactive' };
  if (!okStart) return { ...EMPTY, reason: 'Coupon is not active yet' };
  if (!okEnd) return { ...EMPTY, reason: 'Coupon has expired' };
  if (!okRest) return { ...EMPTY, reason: 'Coupon is not valid for this restaurant' };
  if (!okMin) return { ...EMPTY, reason: `Minimum order ₹${Number(coupon.min_purchase)} required` };
  if (!okLimit) return { ...EMPTY, reason: 'Coupon usage limit reached' };

  const dType = String(coupon.discount_type ?? 'percentage');
  let d = dType === 'percent' || dType === 'percentage'
    ? (orderAmount * Number(coupon.discount ?? 0)) / 100
    : Number(coupon.discount ?? 0);
  const maxD = Number(coupon.max_discount ?? 0);
  if (maxD > 0) d = Math.min(d, maxD);
  const couponDiscount = Math.min(Math.round(d * 100) / 100, orderAmount);

  const couponOwner = ['admin', 'restaurant', 'shared'].includes(String(coupon.discount_owner))
    ? String(coupon.discount_owner) : 'admin';
  let adminDiscount = 0;
  let restaurantDiscount = 0;
  if (couponOwner === 'restaurant') {
    restaurantDiscount = couponDiscount;
  } else if (couponOwner === 'shared') {
    const cfgA = Math.max(0, Number(coupon.admin_discount_amount ?? 0));
    const cfgR = Math.max(0, Number(coupon.restaurant_discount_amount ?? 0));
    const tot = cfgA + cfgR;
    const aShare = tot > 0 ? Math.round(((couponDiscount * cfgA) / tot) * 100) / 100 : couponDiscount;
    adminDiscount = aShare;
    restaurantDiscount = Math.round((couponDiscount - aShare) * 100) / 100;
  } else {
    adminDiscount = couponDiscount;
  }

  return {
    applied: true,
    couponCode: code,
    couponMysqlId: Number(coupon.mysql_id),
    couponDiscount,
    couponOwner,
    adminDiscount,
    restaurantDiscount,
  };
}

/** Atomically count a redemption. Call AFTER the order is created. */
export async function incrementCouponUses(mongo: MongoDataService, couponMysqlId: number | null): Promise<void> {
  if (couponMysqlId != null) {
    await mongo.increment('coupons', { mysql_id: Number(couponMysqlId) }, { total_uses: 1 });
  }
}
