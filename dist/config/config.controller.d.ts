import type { Request } from 'express';
import { BusinessSettingsService } from '../business-settings/business-settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';
import { ZoneService } from '../zone/zone.service';
export declare class ConfigController {
    private readonly bs;
    private readonly prisma;
    private readonly mongo;
    private readonly zones;
    constructor(bs: BusinessSettingsService, prisma: PrismaService, mongo: MongoDataService, zones: ZoneService);
    private useMongo;
    getConfig(req: Request): Promise<{
        business_name: string | null;
        logo: string | null;
        logo_full_url: string | null;
        address: string | null;
        phone: string | null;
        email: string | null;
        country: string;
        default_location: {
            lat: string;
            lng: string;
        };
        currency_symbol: string;
        currency_symbol_direction: string;
        app_minimum_version_android: number;
        app_url_android: string | null;
        app_minimum_version_ios: number;
        app_url_ios: string | null;
        customer_verification: boolean;
        schedule_order: boolean;
        order_delivery_verification: boolean;
        cash_on_delivery: boolean;
        digital_payment: boolean;
        demo: boolean;
        maintenance_mode: boolean;
        order_confirmation_model: string;
        popular_food: number;
        popular_restaurant: number;
        new_restaurant: number;
        most_reviewed_foods: number;
        show_dm_earning: boolean;
        canceled_by_deliveryman: boolean;
        canceled_by_restaurant: boolean;
        timeformat: string;
        language: {
            key: string;
            value: string;
        }[];
        toggle_veg_non_veg: boolean;
        toggle_dm_registration: boolean;
        toggle_restaurant_registration: boolean;
        schedule_order_slot_duration: number;
        subscription_status: number;
        subscription_frequencies: string;
        subscription_can_pause: number;
        subscription_max_per_customer: number;
        subscription_min_days: number;
        digit_after_decimal_point: number;
        loyalty_point_exchange_rate: number;
        loyalty_point_item_purchase_point: number;
        loyalty_point_status: number;
        minimum_point_to_transfer: number;
        customer_wallet_status: number;
        ref_earning_status: number;
        ref_earning_exchange_rate: number;
        dm_tips_status: number;
        theme: number;
        social_media: unknown[];
        social_login: {
            login_medium: string;
            status: boolean;
        }[];
        business_plan: {
            commission: number;
            subscription: number;
        };
        admin_commission: number;
        footer_text: string;
        fav_icon: string | null;
        fav_icon_full_url: string | null;
        refund_active_status: boolean;
        additional_charge_status: number;
        additional_charge_name: string;
        additional_charge: number;
        take_away: boolean;
        dine_in: boolean;
        dine_in_order_option: number;
        repeat_order_option: boolean;
        home_delivery: boolean;
        active_payment_method_list: {
            gateway: string;
            gateway_title: string;
            gateway_image_full_url: string;
        }[];
        min_amount_to_pay_restaurant: number;
        digital_payment_info: {
            digital_payment: boolean;
            plugin_payment_gateways: boolean;
            default_payment_gateways: boolean;
        };
        banner_data: {
            promotional_banner_image: string;
            promotional_banner_title: string;
            promotional_banner_image_full_url: string | null;
        } | {
            promotional_banner_image: null;
            promotional_banner_title: null;
            promotional_banner_image_full_url: null;
        };
        instant_order: boolean;
        country_picker_status: number;
        guest_checkout_status: number;
        offline_payment_status: number;
        centralize_login: {
            manual_login_status: number;
            otp_login_status: number;
            social_login_status: number;
            google_login_status: number;
            facebook_login_status: number;
            apple_login_status: number;
            email_verification_status: number;
            phone_verification_status: number;
        };
        system_tax_type: string | null;
        system_tax_include_status: number;
        is_sms_active: boolean;
        is_mail_active: boolean;
        openai_status: number;
        invoice_settings: {
            invoice_logo_full_url: string | null;
        };
        privacy_policy: string | null;
        terms_and_conditions: string | null;
        about_us: string | null;
        refund_policy: string | null;
        cancellation_policy: string | null;
        shipping_policy: string | null;
    }>;
    placeAutocomplete(searchText?: string): {
        suggestions: {
            placePrediction: {
                text: {
                    text: string;
                    matches: {
                        endOffset: number;
                    }[];
                };
                placeId: string;
                place: string;
                types: string[];
                structuredFormat: {
                    mainText: {
                        text: string;
                        matches: {
                            endOffset: number;
                        }[];
                    };
                    secondaryText: {
                        text: string;
                    };
                };
            };
        }[];
    };
    placeDetails(placeid?: string): {
        status: string;
        result: {
            place_id: string;
            formatted_address: string;
            geometry: {
                location: {
                    lat: number;
                    lng: number;
                };
            };
            name: string;
            types: string[];
        };
    };
    geocode(latStr?: string, lngStr?: string): {
        status: string;
        results: {
            formatted_address: string;
            geometry: {
                location: {
                    lat: number;
                    lng: number;
                };
            };
            place_id: string;
        }[];
    };
    distance(oLatStr?: string, oLngStr?: string, dLatStr?: string, dLngStr?: string): {
        distanceMeters: number;
        duration: string;
    };
    getZoneId(latStr?: string, lngStr?: string): Promise<{
        zone_id: string;
        zone_data: {
            id: number;
            name: string | null;
        }[];
    }>;
}
