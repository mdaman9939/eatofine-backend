"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAndComputeCoupon = validateAndComputeCoupon;
exports.incrementCouponUses = incrementCouponUses;
const EMPTY = {
    applied: false,
    couponCode: null,
    couponMysqlId: null,
    couponDiscount: 0,
    couponOwner: 'admin',
    adminDiscount: 0,
    restaurantDiscount: 0,
};
async function validateAndComputeCoupon(mongo, input) {
    const code = input.code ? String(input.code).trim() : '';
    if (!code)
        return { ...EMPTY };
    const orderAmount = Number(input.orderAmount ?? 0);
    const coupon = await mongo.findOne('coupons', { code });
    if (!coupon)
        return { ...EMPTY, reason: 'Invalid coupon code' };
    const now = new Date();
    const okStatus = coupon.status === true || coupon.status === 1 || coupon.status === undefined;
    const okStart = !coupon.start_date || new Date(coupon.start_date) <= now;
    const okEnd = !coupon.expire_date || new Date(coupon.expire_date) >= now;
    const okMin = !coupon.min_purchase || orderAmount >= Number(coupon.min_purchase);
    const okRest = coupon.mysql_restaurant_id == null || input.restaurantId == null
        || Number(coupon.mysql_restaurant_id) === Number(input.restaurantId);
    const okLimit = coupon.limit == null || Number(coupon.total_uses ?? 0) < Number(coupon.limit);
    if (!okStatus)
        return { ...EMPTY, reason: 'Coupon is inactive' };
    if (!okStart)
        return { ...EMPTY, reason: 'Coupon is not active yet' };
    if (!okEnd)
        return { ...EMPTY, reason: 'Coupon has expired' };
    if (!okRest)
        return { ...EMPTY, reason: 'Coupon is not valid for this restaurant' };
    if (!okMin)
        return { ...EMPTY, reason: `Minimum order ₹${Number(coupon.min_purchase)} required` };
    if (!okLimit)
        return { ...EMPTY, reason: 'Coupon usage limit reached' };
    const dType = String(coupon.discount_type ?? 'percentage');
    let d = dType === 'percent' || dType === 'percentage'
        ? (orderAmount * Number(coupon.discount ?? 0)) / 100
        : Number(coupon.discount ?? 0);
    const maxD = Number(coupon.max_discount ?? 0);
    if (maxD > 0)
        d = Math.min(d, maxD);
    const couponDiscount = Math.min(Math.round(d * 100) / 100, orderAmount);
    const couponOwner = ['admin', 'restaurant', 'shared'].includes(String(coupon.discount_owner))
        ? String(coupon.discount_owner) : 'admin';
    let adminDiscount = 0;
    let restaurantDiscount = 0;
    if (couponOwner === 'restaurant') {
        restaurantDiscount = couponDiscount;
    }
    else if (couponOwner === 'shared') {
        const cfgA = Math.max(0, Number(coupon.admin_discount_amount ?? 0));
        const cfgR = Math.max(0, Number(coupon.restaurant_discount_amount ?? 0));
        const tot = cfgA + cfgR;
        const aShare = tot > 0 ? Math.round(((couponDiscount * cfgA) / tot) * 100) / 100 : couponDiscount;
        adminDiscount = aShare;
        restaurantDiscount = Math.round((couponDiscount - aShare) * 100) / 100;
    }
    else {
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
async function incrementCouponUses(mongo, couponMysqlId) {
    if (couponMysqlId != null) {
        await mongo.increment('coupons', { mysql_id: Number(couponMysqlId) }, { total_uses: 1 });
    }
}
//# sourceMappingURL=coupon.js.map