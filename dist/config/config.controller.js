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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigController = void 0;
const common_1 = require("@nestjs/common");
const business_settings_service_1 = require("../business-settings/business-settings.service");
const prisma_service_1 = require("../prisma/prisma.service");
const mongo_data_service_1 = require("../mongo/mongo-data.service");
const zone_service_1 = require("../zone/zone.service");
const additional_charge_1 = require("../common/additional-charge");
let ConfigController = class ConfigController {
    bs;
    prisma;
    mongo;
    zones;
    constructor(bs, prisma, mongo, zones) {
        this.bs = bs;
        this.prisma = prisma;
        this.mongo = mongo;
        this.zones = zones;
    }
    useMongo() {
        const v = (process.env.USE_MONGO_CONFIG ?? '1').toLowerCase();
        return v === '1' || v === 'true' || v === 'yes';
    }
    async getConfig(req) {
        const base = `${req.protocol}://${req.get('host')}/storage`;
        const [logo, favIcon, banner, currency] = await Promise.all([
            this.bs.get('logo'),
            this.bs.get('fav_icon'),
            this.bs.getJson('promotional_banner'),
            (async () => {
                const code = await this.bs.get('currency');
                if (!code)
                    return null;
                if (this.useMongo()) {
                    return this.mongo.findOne('currencies', { currency_code: code });
                }
                return this.prisma.currencies.findFirst({ where: { currency_code: code } });
            })(),
        ]);
        const fullUrl = (folder, file) => file ? (/^https?:\/\//i.test(file) ? file : `${base}/${folder}/${file}`) : null;
        const addChargeRows = this.useMongo()
            ? await this.mongo.findMany('additional_user_charges', {})
            : [];
        const addCharge = (0, additional_charge_1.computeFlatAdditionalCharge)(addChargeRows);
        return {
            business_name: await this.bs.get('business_name'),
            logo,
            logo_full_url: fullUrl('business', logo),
            address: await this.bs.get('address'),
            phone: await this.bs.get('phone'),
            email: await this.bs.get('email_address'),
            country: await this.bs.get('country') || 'IN',
            default_location: {
                lat: (await this.bs.get('default_location_lat')) ?? '0',
                lng: (await this.bs.get('default_location_lng')) ?? '0',
            },
            currency_symbol: currency?.currency_symbol ?? '$',
            currency_symbol_direction: 'right',
            app_minimum_version_android: await this.bs.getInt('app_minimum_version_android'),
            app_url_android: await this.bs.get('app_url_android'),
            app_minimum_version_ios: await this.bs.getInt('app_minimum_version_ios'),
            app_url_ios: await this.bs.get('app_url_ios'),
            customer_verification: await this.bs.getBool('customer_verification'),
            schedule_order: await this.bs.getBool('schedule_order'),
            order_delivery_verification: await this.bs.getBool('order_delivery_verification'),
            cash_on_delivery: await this.bs.getStatus('cash_on_delivery'),
            digital_payment: await this.bs.getStatus('digital_payment'),
            demo: false,
            maintenance_mode: await this.bs.getBool('maintenance_mode'),
            order_confirmation_model: (await this.bs.get('order_confirmation_model')) ?? 'restaurant',
            popular_food: await this.bs.getInt('popular_food', 1),
            popular_restaurant: await this.bs.getInt('popular_restaurant', 1),
            new_restaurant: await this.bs.getInt('new_restaurant', 1),
            most_reviewed_foods: await this.bs.getInt('most_reviewed_foods', 1),
            show_dm_earning: await this.bs.getBool('show_dm_earning'),
            canceled_by_deliveryman: await this.bs.getBool('canceled_by_deliveryman'),
            canceled_by_restaurant: await this.bs.getBool('canceled_by_restaurant'),
            timeformat: (await this.bs.get('timeformat')) ?? '24',
            language: [{ key: 'en', value: 'English' }],
            toggle_veg_non_veg: await this.bs.getBool('toggle_veg_non_veg'),
            toggle_dm_registration: await this.bs.getBool('toggle_dm_registration'),
            toggle_restaurant_registration: await this.bs.getBool('toggle_restaurant_registration'),
            schedule_order_slot_duration: await this.bs.getInt('schedule_order_slot_duration'),
            subscription_status: await this.bs.getInt('subscription_status', 1),
            subscription_frequencies: (await this.bs.get('subscription_frequencies')) ?? 'daily,weekly',
            subscription_can_pause: await this.bs.getInt('subscription_can_pause', 1),
            subscription_max_per_customer: await this.bs.getInt('subscription_max_per_customer'),
            subscription_min_days: await this.bs.getInt('subscription_min_days', 1),
            digit_after_decimal_point: await this.bs.getInt('digit_after_decimal_point', 2),
            loyalty_point_exchange_rate: await this.bs.getInt('loyalty_point_exchange_rate'),
            loyalty_point_item_purchase_point: await this.bs.getInt('loyalty_point_item_purchase_point'),
            loyalty_point_status: await this.bs.getInt('loyalty_point_status'),
            minimum_point_to_transfer: await this.bs.getInt('minimum_point_to_transfer'),
            customer_wallet_status: await this.bs.getInt('customer_wallet_status'),
            ref_earning_status: await this.bs.getInt('ref_earning_status'),
            ref_earning_exchange_rate: await this.bs.getInt('ref_earning_exchange_rate'),
            dm_tips_status: await this.bs.getInt('dm_tips_status'),
            theme: await this.bs.getInt('theme', 1),
            social_media: (await this.bs.getJson('social_media')) ?? [],
            social_login: [
                { login_medium: 'google', status: await this.bs.getStatus('google_social_login') },
                { login_medium: 'facebook', status: await this.bs.getStatus('facebook_social_login') },
            ],
            business_plan: { commission: 1, subscription: 0 },
            admin_commission: await this.bs.getInt('admin_commission'),
            footer_text: (await this.bs.get('footer_text')) ?? 'Footer Text',
            fav_icon: favIcon,
            fav_icon_full_url: fullUrl('business', favIcon),
            refund_active_status: await this.bs.getBool('refund_active_status'),
            additional_charge_status: addCharge.amount > 0 ? 1 : 0,
            additional_charge_name: addCharge.name,
            additional_charge: addCharge.amount,
            take_away: await this.bs.getBool('take_away'),
            dine_in: await this.bs.getBoolDefault('dine_in', true),
            dine_in_order_option: (await this.bs.getBoolDefault('dine_in', true)) ? 1 : 0,
            repeat_order_option: await this.bs.getBool('repeat_order_option'),
            home_delivery: await this.bs.getBool('home_delivery'),
            active_payment_method_list: [
                { gateway: 'razor_pay', gateway_title: 'Razorpay', gateway_image_full_url: 'https://images.unsplash.com/photo-1556742502-ec7c0e009f34?w=200&h=200&fit=crop&q=80' },
                { gateway: 'stripe', gateway_title: 'Credit / Debit Card', gateway_image_full_url: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=200&h=200&fit=crop&q=80' },
                { gateway: 'paystack', gateway_title: 'Paystack', gateway_image_full_url: 'https://images.unsplash.com/photo-1601597111158-2fceff292cdc?w=200&h=200&fit=crop&q=80' },
            ],
            min_amount_to_pay_restaurant: await this.bs.getInt('min_amount_to_pay_restaurant', 100),
            digital_payment_info: {
                digital_payment: true,
                plugin_payment_gateways: false,
                default_payment_gateways: true,
            },
            banner_data: banner
                ? {
                    promotional_banner_image: banner.promotional_banner_image,
                    promotional_banner_title: banner.promotional_banner_title,
                    promotional_banner_image_full_url: fullUrl('banner', banner.promotional_banner_image),
                }
                : { promotional_banner_image: null, promotional_banner_title: null, promotional_banner_image_full_url: null },
            instant_order: await this.bs.getBool('instant_order'),
            country_picker_status: await this.bs.getInt('country_picker_status', 1),
            guest_checkout_status: await this.bs.getInt('guest_checkout_status'),
            offline_payment_status: await this.bs.getInt('offline_payment_status'),
            centralize_login: {
                manual_login_status: 1,
                otp_login_status: await this.bs.getInt('otp_login_status'),
                social_login_status: 0,
                google_login_status: 0,
                facebook_login_status: 0,
                apple_login_status: 0,
                email_verification_status: 0,
                phone_verification_status: 0,
            },
            system_tax_type: await this.bs.get('system_tax_type'),
            system_tax_include_status: await this.bs.getInt('system_tax_include_status'),
            is_sms_active: false,
            is_mail_active: false,
            openai_status: await this.bs.getInt('openai_status'),
            invoice_settings: { invoice_logo_full_url: fullUrl('business', logo) },
            privacy_policy: await this.bs.get('privacy_policy'),
            terms_and_conditions: await this.bs.get('terms_and_conditions'),
            about_us: await this.bs.get('about_us'),
            refund_policy: await this.bs.get('refund_policy'),
            cancellation_policy: await this.bs.get('cancellation_policy'),
            shipping_policy: await this.bs.get('shipping_policy'),
        };
    }
    placeAutocomplete(searchText) {
        const q = (searchText ?? '').trim() || 'Demo location';
        const places = [
            { name: q, locality: 'Sector 14, Dwarka', city: 'New Delhi' },
            { name: `${q} Mall`, locality: 'Sector 12, Dwarka', city: 'New Delhi' },
            { name: `${q} Plaza`, locality: 'NIT Faridabad', city: 'Faridabad' },
            { name: `${q} Market`, locality: 'Connaught Place', city: 'New Delhi' },
        ];
        return {
            suggestions: places.map((p, i) => {
                const id = `stub-${Date.now()}-${i}`;
                const full = `${p.name}, ${p.locality}, ${p.city}`;
                return {
                    placePrediction: {
                        text: { text: full, matches: [{ endOffset: q.length }] },
                        placeId: id,
                        place: `places/${id}`,
                        types: ['establishment', 'point_of_interest'],
                        structuredFormat: {
                            mainText: { text: p.name, matches: [{ endOffset: q.length }] },
                            secondaryText: { text: `${p.locality}, ${p.city}` },
                        },
                    },
                };
            }),
        };
    }
    placeDetails(placeid) {
        const lat = 28.601;
        const lng = 77.052;
        return {
            status: 'OK',
            result: {
                place_id: placeid ?? 'stub-place',
                formatted_address: 'Sector 14, Dwarka, New Delhi 110078, India',
                geometry: { location: { lat, lng } },
                name: 'Demo location',
                types: ['establishment'],
            },
        };
    }
    geocode(latStr, lngStr) {
        const lat = parseFloat(latStr ?? '');
        const lng = parseFloat(lngStr ?? '');
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return { status: 'ZERO_RESULTS', results: [] };
        }
        const region = lat > 28.55
            ? lng < 77.15
                ? 'Dwarka'
                : 'New Delhi'
            : 'Faridabad';
        const formatted = `Near ${lat.toFixed(4)}, ${lng.toFixed(4)}, ${region}, India`;
        return {
            status: 'OK',
            results: [
                {
                    formatted_address: formatted,
                    geometry: { location: { lat, lng } },
                    place_id: `geo-${lat.toFixed(4)}-${lng.toFixed(4)}`,
                },
            ],
        };
    }
    distance(oLatStr, oLngStr, dLatStr, dLngStr) {
        const oLat = parseFloat(oLatStr ?? '');
        const oLng = parseFloat(oLngStr ?? '');
        const dLat = parseFloat(dLatStr ?? '');
        const dLng = parseFloat(dLngStr ?? '');
        if (!Number.isFinite(oLat) ||
            !Number.isFinite(oLng) ||
            !Number.isFinite(dLat) ||
            !Number.isFinite(dLng)) {
            return { distanceMeters: 0, duration: '0s' };
        }
        const distanceMeters = haversineMeters(oLat, oLng, dLat, dLng);
        const seconds = Math.round((distanceMeters / 1000) * (3600 / 25));
        return {
            distanceMeters: Math.round(distanceMeters),
            duration: `${seconds}s`,
        };
    }
    async getZoneId(latStr, lngStr) {
        const lat = parseFloat(latStr ?? '');
        const lng = parseFloat(lngStr ?? '');
        const { zones } = await this.zones.classifyPoint(lat, lng);
        return {
            zone_id: JSON.stringify(zones.map((z) => z.id)),
            zone_data: zones.map((z) => ({ id: z.id, name: z.name })),
        };
    }
};
exports.ConfigController = ConfigController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConfigController.prototype, "getConfig", null);
__decorate([
    (0, common_1.Get)('place-api-autocomplete'),
    __param(0, (0, common_1.Query)('search_text')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ConfigController.prototype, "placeAutocomplete", null);
__decorate([
    (0, common_1.Get)('place-api-details'),
    __param(0, (0, common_1.Query)('placeid')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ConfigController.prototype, "placeDetails", null);
__decorate([
    (0, common_1.Get)('geocode-api'),
    __param(0, (0, common_1.Query)('lat')),
    __param(1, (0, common_1.Query)('lng')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ConfigController.prototype, "geocode", null);
__decorate([
    (0, common_1.Get)('distance-api'),
    __param(0, (0, common_1.Query)('origin_lat')),
    __param(1, (0, common_1.Query)('origin_lng')),
    __param(2, (0, common_1.Query)('destination_lat')),
    __param(3, (0, common_1.Query)('destination_lng')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], ConfigController.prototype, "distance", null);
__decorate([
    (0, common_1.Get)('get-zone-id'),
    __param(0, (0, common_1.Query)('lat')),
    __param(1, (0, common_1.Query)('lng')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ConfigController.prototype, "getZoneId", null);
exports.ConfigController = ConfigController = __decorate([
    (0, common_1.Controller)('config'),
    __metadata("design:paramtypes", [business_settings_service_1.BusinessSettingsService,
        prisma_service_1.PrismaService,
        mongo_data_service_1.MongoDataService,
        zone_service_1.ZoneService])
], ConfigController);
function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}
//# sourceMappingURL=config.controller.js.map