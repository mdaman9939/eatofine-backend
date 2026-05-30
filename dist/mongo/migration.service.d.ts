import { Model } from 'mongoose';
import { PrismaService } from '../prisma/prisma.service';
import { UserDocument } from './schemas/user.schema';
import { VendorDocument } from './schemas/vendor.schema';
import { RestaurantDocument } from './schemas/restaurant.schema';
import { FoodDocument } from './schemas/food.schema';
import { DeliveryManDocument } from './schemas/delivery-man.schema';
import { OrderDocument } from './schemas/order.schema';
import { CategoryDocument } from './schemas/category.schema';
import { CuisineDocument } from './schemas/cuisine.schema';
import { BannerDocument } from './schemas/banner.schema';
export interface MigrationStep {
    collection: string;
    mysql_count: number;
    inserted: number;
    skipped: number;
    errors: string[];
}
export interface MigrationReport {
    started_at: string;
    finished_at: string;
    duration_ms: number;
    steps: MigrationStep[];
    total_inserted: number;
    total_skipped: number;
}
export declare class MigrationService {
    private readonly prisma;
    private readonly userModel;
    private readonly vendorModel;
    private readonly restaurantModel;
    private readonly foodModel;
    private readonly dmModel;
    private readonly orderModel;
    private readonly categoryModel;
    private readonly cuisineModel;
    private readonly bannerModel;
    private readonly log;
    constructor(prisma: PrismaService, userModel: Model<UserDocument>, vendorModel: Model<VendorDocument>, restaurantModel: Model<RestaurantDocument>, foodModel: Model<FoodDocument>, dmModel: Model<DeliveryManDocument>, orderModel: Model<OrderDocument>, categoryModel: Model<CategoryDocument>, cuisineModel: Model<CuisineDocument>, bannerModel: Model<BannerDocument>);
    runAll(): Promise<MigrationReport>;
    migrateUsers(): Promise<MigrationStep>;
    migrateVendors(): Promise<MigrationStep>;
    migrateDeliveryMen(): Promise<MigrationStep>;
    migrateRestaurants(): Promise<MigrationStep>;
    migrateFoods(): Promise<MigrationStep>;
    migrateOrders(): Promise<MigrationStep>;
    migrateCategories(): Promise<MigrationStep>;
    migrateCuisines(): Promise<MigrationStep>;
    migrateBanners(): Promise<MigrationStep>;
    private runStep;
    private tryParseJSON;
    counts(): Promise<{
        users: number;
        vendors: number;
        delivery_men: number;
        restaurants: number;
        foods: number;
        orders: number;
        categories: number;
        cuisines: number;
        banners: number;
    }>;
}
