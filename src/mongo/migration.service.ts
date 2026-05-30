import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../prisma/prisma.service';
import { User, UserDocument } from './schemas/user.schema';
import { Vendor, VendorDocument } from './schemas/vendor.schema';
import { Restaurant, RestaurantDocument } from './schemas/restaurant.schema';
import { Food, FoodDocument } from './schemas/food.schema';
import { DeliveryMan, DeliveryManDocument } from './schemas/delivery-man.schema';
import { Order, OrderDocument } from './schemas/order.schema';
import { Category, CategoryDocument } from './schemas/category.schema';
import { Cuisine, CuisineDocument } from './schemas/cuisine.schema';
import { Banner, BannerDocument } from './schemas/banner.schema';

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

@Injectable()
export class MigrationService {
  private readonly log = new Logger('Migration');

  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Vendor.name) private readonly vendorModel: Model<VendorDocument>,
    @InjectModel(Restaurant.name) private readonly restaurantModel: Model<RestaurantDocument>,
    @InjectModel(Food.name) private readonly foodModel: Model<FoodDocument>,
    @InjectModel(DeliveryMan.name) private readonly dmModel: Model<DeliveryManDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Cuisine.name) private readonly cuisineModel: Model<CuisineDocument>,
    @InjectModel(Banner.name) private readonly bannerModel: Model<BannerDocument>,
  ) {}

  /** Migrate all six core collections. Idempotent: re-running upserts by mysql_id. */
  async runAll(): Promise<MigrationReport> {
    const startedAt = new Date();
    const steps: MigrationStep[] = [];

    steps.push(await this.migrateUsers());
    steps.push(await this.migrateVendors());
    steps.push(await this.migrateDeliveryMen());
    steps.push(await this.migrateRestaurants());
    steps.push(await this.migrateFoods());
    steps.push(await this.migrateOrders());
    steps.push(await this.migrateCategories());
    steps.push(await this.migrateCuisines());
    steps.push(await this.migrateBanners());

    const finishedAt = new Date();
    const totalInserted = steps.reduce((s, x) => s + x.inserted, 0);
    const totalSkipped = steps.reduce((s, x) => s + x.skipped, 0);

    return {
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      duration_ms: finishedAt.getTime() - startedAt.getTime(),
      steps,
      total_inserted: totalInserted,
      total_skipped: totalSkipped,
    };
  }

  /** Migrate users → MongoDB users collection. Uses SELECT * so it works
   * regardless of which optional columns are or aren't present in MySQL. */
  async migrateUsers(): Promise<MigrationStep> {
    return this.runStep('users', async () => {
      const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT * FROM users`,
      );
      let inserted = 0;
      let skipped = 0;
      for (const r of rows) {
        const mysqlId = Number(r.id);
        try {
          // Pluck the canonical fields, then dump everything else into legacy.
          const {
            id, f_name, l_name, email, phone, password, status, image,
            ref_code, is_phone_verified, is_email_verified,
            ...rest
          } = r;
          void id; // unused — same as mysqlId
          await this.userModel.updateOne(
            { mysql_id: mysqlId },
            {
              $set: {
                mysql_id: mysqlId,
                f_name: f_name as string,
                l_name: l_name as string,
                email: (email as string)?.toLowerCase(),
                phone: phone as string,
                password: password as string,
                status: status === null || status === undefined ? true : !!status,
                image: image as string,
                ref_code: ref_code as string,
                is_phone_verified: !!is_phone_verified,
                is_email_verified: !!is_email_verified,
                legacy: rest,
              },
            },
            { upsert: true },
          );
          inserted++;
        } catch (e: unknown) {
          skipped++;
          this.log.warn(`user #${mysqlId}: ${(e as Error).message}`);
        }
      }
      return { inserted, skipped, mysql_count: rows.length };
    });
  }

  async migrateVendors(): Promise<MigrationStep> {
    return this.runStep('vendors', async () => {
      const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT id, f_name, l_name, email, phone, password, status, image,
                created_at, updated_at
         FROM vendors`,
      );
      let inserted = 0;
      let skipped = 0;
      for (const r of rows) {
        const mysqlId = Number(r.id);
        try {
          await this.vendorModel.updateOne(
            { mysql_id: mysqlId },
            {
              $set: {
                mysql_id: mysqlId,
                f_name: r.f_name as string,
                l_name: r.l_name as string,
                email: (r.email as string)?.toLowerCase(),
                phone: r.phone as string,
                password: r.password as string,
                status: !!r.status,
                image: r.image as string,
                legacy: {
                  created_at: r.created_at,
                  updated_at: r.updated_at,
                },
              },
            },
            { upsert: true },
          );
          inserted++;
        } catch (e: unknown) {
          skipped++;
          this.log.warn(`vendor #${mysqlId}: ${(e as Error).message}`);
        }
      }
      return { inserted, skipped, mysql_count: rows.length };
    });
  }

  async migrateDeliveryMen(): Promise<MigrationStep> {
    return this.runStep('delivery_men', async () => {
      const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT id, f_name, l_name, email, phone, password, status, image,
                application_status, zone_id, created_at, updated_at
         FROM delivery_men`,
      );
      let inserted = 0;
      let skipped = 0;
      for (const r of rows) {
        const mysqlId = Number(r.id);
        try {
          await this.dmModel.updateOne(
            { mysql_id: mysqlId },
            {
              $set: {
                mysql_id: mysqlId,
                f_name: r.f_name as string,
                l_name: r.l_name as string,
                email: (r.email as string)?.toLowerCase(),
                phone: r.phone as string,
                password: r.password as string,
                status: !!r.status,
                image: r.image as string,
                application_status: r.application_status as string,
                mysql_zone_id: r.zone_id ? Number(r.zone_id) : undefined,
                legacy: { created_at: r.created_at, updated_at: r.updated_at },
              },
            },
            { upsert: true },
          );
          inserted++;
        } catch (e: unknown) {
          skipped++;
          this.log.warn(`dm #${mysqlId}: ${(e as Error).message}`);
        }
      }
      return { inserted, skipped, mysql_count: rows.length };
    });
  }

  async migrateRestaurants(): Promise<MigrationStep> {
    return this.runStep('restaurants', async () => {
      const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT r.id, r.name, r.email, r.phone, r.address, r.latitude, r.longitude,
                r.vendor_id, r.zone_id, r.logo, r.cover_photo, r.comission,
                r.minimum_order, r.restaurant_model, r.status, r.active,
                r.created_at, r.updated_at,
                COALESCE((SELECT COUNT(*) FROM orders o WHERE o.restaurant_id = r.id), 0) AS order_count
         FROM restaurants r`,
      );
      let inserted = 0;
      let skipped = 0;
      for (const r of rows) {
        const mysqlId = Number(r.id);
        try {
          await this.restaurantModel.updateOne(
            { mysql_id: mysqlId },
            {
              $set: {
                mysql_id: mysqlId,
                name: r.name as string,
                email: (r.email as string)?.toLowerCase(),
                phone: r.phone as string,
                address: r.address as string,
                latitude: r.latitude ? Number(r.latitude) : undefined,
                longitude: r.longitude ? Number(r.longitude) : undefined,
                mysql_vendor_id: r.vendor_id ? Number(r.vendor_id) : undefined,
                mysql_zone_id: r.zone_id ? Number(r.zone_id) : undefined,
                logo: r.logo as string,
                cover_photo: r.cover_photo as string,
                comission: r.comission ? Number(r.comission) : undefined,
                minimum_order: r.minimum_order ? Number(r.minimum_order) : undefined,
                restaurant_model: r.restaurant_model as string,
                status: !!r.status,
                active: !!r.active,
                order_count: Number(r.order_count ?? 0),
                legacy: { created_at: r.created_at, updated_at: r.updated_at },
              },
            },
            { upsert: true },
          );
          inserted++;
        } catch (e: unknown) {
          skipped++;
          this.log.warn(`restaurant #${mysqlId}: ${(e as Error).message}`);
        }
      }
      return { inserted, skipped, mysql_count: rows.length };
    });
  }

  async migrateFoods(): Promise<MigrationStep> {
    return this.runStep('foods', async () => {
      const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT id, name, description, image, restaurant_id, category_id,
                price, discount, discount_type, veg, status, recommended,
                avg_rating, order_count, item_stock, stock_type,
                variations, add_ons, created_at, updated_at
         FROM food`,
      );
      let inserted = 0;
      let skipped = 0;
      for (const r of rows) {
        const mysqlId = Number(r.id);
        try {
          await this.foodModel.updateOne(
            { mysql_id: mysqlId },
            {
              $set: {
                mysql_id: mysqlId,
                name: r.name as string,
                description: r.description as string,
                image: r.image as string,
                mysql_restaurant_id: r.restaurant_id ? Number(r.restaurant_id) : undefined,
                mysql_category_id: r.category_id ? Number(r.category_id) : undefined,
                price: r.price ? Number(r.price) : undefined,
                discount: r.discount ? Number(r.discount) : undefined,
                discount_type: r.discount_type as string,
                veg: !!r.veg,
                status: !!r.status,
                recommended: !!r.recommended,
                avg_rating: r.avg_rating ? Number(r.avg_rating) : undefined,
                order_count: r.order_count ? Number(r.order_count) : 0,
                item_stock: r.item_stock ? Number(r.item_stock) : undefined,
                stock_type: r.stock_type as string,
                variations: this.tryParseJSON(r.variations),
                add_ons: this.tryParseJSON(r.add_ons),
                legacy: { created_at: r.created_at, updated_at: r.updated_at },
              },
            },
            { upsert: true },
          );
          inserted++;
        } catch (e: unknown) {
          skipped++;
          this.log.warn(`food #${mysqlId}: ${(e as Error).message}`);
        }
      }
      return { inserted, skipped, mysql_count: rows.length };
    });
  }

  async migrateOrders(): Promise<MigrationStep> {
    return this.runStep('orders', async () => {
      const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT id, user_id, restaurant_id, delivery_man_id,
                order_status, payment_status, payment_method, order_type,
                order_amount, total_tax_amount, delivery_charge,
                coupon_discount_amount, additional_charge, restaurant_discount_amount,
                created_at, delivered
         FROM orders`,
      );
      // Bulk-fetch order items grouped by order_id to avoid N+1 queries.
      const itemRows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT order_id, food_id, food_details, quantity, price,
                discount_on_food, discount_type, variation, add_ons, tax_amount
         FROM order_details`,
      );
      const itemsByOrder = new Map<number, Array<Record<string, unknown>>>();
      for (const item of itemRows) {
        const oid = Number(item.order_id);
        if (!itemsByOrder.has(oid)) itemsByOrder.set(oid, []);
        itemsByOrder.get(oid)!.push({
          mysql_food_id: item.food_id ? Number(item.food_id) : undefined,
          food_details: this.tryParseJSON(item.food_details),
          quantity: Number(item.quantity ?? 0),
          price: Number(item.price ?? 0),
          discount_on_food: Number(item.discount_on_food ?? 0),
          discount_type: item.discount_type,
          variation: this.tryParseJSON(item.variation),
          add_ons: this.tryParseJSON(item.add_ons),
          tax_amount: Number(item.tax_amount ?? 0),
        });
      }

      let inserted = 0;
      let skipped = 0;
      for (const r of rows) {
        const mysqlId = Number(r.id);
        try {
          await this.orderModel.updateOne(
            { mysql_id: mysqlId },
            {
              $set: {
                mysql_id: mysqlId,
                mysql_user_id: r.user_id ? Number(r.user_id) : undefined,
                mysql_restaurant_id: r.restaurant_id ? Number(r.restaurant_id) : undefined,
                mysql_delivery_man_id: r.delivery_man_id ? Number(r.delivery_man_id) : undefined,
                order_status: r.order_status as string,
                payment_status: r.payment_status as string,
                payment_method: r.payment_method as string,
                order_type: r.order_type as string,
                order_amount: r.order_amount ? Number(r.order_amount) : 0,
                total_tax_amount: r.total_tax_amount ? Number(r.total_tax_amount) : 0,
                delivery_charge: r.delivery_charge ? Number(r.delivery_charge) : 0,
                coupon_discount_amount: r.coupon_discount_amount ? Number(r.coupon_discount_amount) : 0,
                additional_charge: r.additional_charge ? Number(r.additional_charge) : 0,
                restaurant_discount_amount: r.restaurant_discount_amount ? Number(r.restaurant_discount_amount) : 0,
                items: itemsByOrder.get(mysqlId) ?? [],
                created_at_legacy: r.created_at ? new Date(r.created_at as string) : undefined,
                delivered: r.delivered ? new Date(r.delivered as string) : undefined,
              },
            },
            { upsert: true },
          );
          inserted++;
        } catch (e: unknown) {
          skipped++;
          this.log.warn(`order #${mysqlId}: ${(e as Error).message}`);
        }
      }
      return { inserted, skipped, mysql_count: rows.length };
    });
  }

  // ── Phase 2 — Catalog migrations ──────────────────────────────
  async migrateCategories(): Promise<MigrationStep> {
    return this.runStep('categories', async () => {
      const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT * FROM categories`,
      );
      let inserted = 0;
      let skipped = 0;
      for (const r of rows) {
        const mysqlId = Number(r.id);
        try {
          const { id, name, image, parent_id, position, priority, status, ...rest } = r;
          void id;
          await this.categoryModel.updateOne(
            { mysql_id: mysqlId },
            {
              $set: {
                mysql_id: mysqlId,
                name: name as string,
                image: image as string,
                parent_id: parent_id !== null && parent_id !== undefined ? Number(parent_id) : 0,
                position: position !== null && position !== undefined ? Number(position) : 0,
                priority: priority !== null && priority !== undefined ? Number(priority) : 0,
                status: status === null || status === undefined ? true : !!status,
                legacy: rest,
              },
            },
            { upsert: true },
          );
          inserted++;
        } catch (e: unknown) {
          skipped++;
          this.log.warn(`category #${mysqlId}: ${(e as Error).message}`);
        }
      }
      return { inserted, skipped, mysql_count: rows.length };
    });
  }

  async migrateCuisines(): Promise<MigrationStep> {
    return this.runStep('cuisines', async () => {
      const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT * FROM cuisines`,
      );
      let inserted = 0;
      let skipped = 0;
      for (const r of rows) {
        const mysqlId = Number(r.id);
        try {
          const { id, name, image, status, ...rest } = r;
          void id;
          await this.cuisineModel.updateOne(
            { mysql_id: mysqlId },
            {
              $set: {
                mysql_id: mysqlId,
                name: name as string,
                image: image as string,
                status: status === null || status === undefined ? true : !!status,
                legacy: rest,
              },
            },
            { upsert: true },
          );
          inserted++;
        } catch (e: unknown) {
          skipped++;
          this.log.warn(`cuisine #${mysqlId}: ${(e as Error).message}`);
        }
      }
      return { inserted, skipped, mysql_count: rows.length };
    });
  }

  async migrateBanners(): Promise<MigrationStep> {
    return this.runStep('banners', async () => {
      const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT * FROM banners`,
      );
      let inserted = 0;
      let skipped = 0;
      for (const r of rows) {
        const mysqlId = Number(r.id);
        try {
          const { id, title, type, image, data, zone_id, status, ...rest } = r;
          void id;
          await this.bannerModel.updateOne(
            { mysql_id: mysqlId },
            {
              $set: {
                mysql_id: mysqlId,
                title: title as string,
                type: type as string,
                image: image as string,
                data: this.tryParseJSON(data),
                zone_id: zone_id !== null && zone_id !== undefined ? Number(zone_id) : undefined,
                status: status === null || status === undefined ? true : !!status,
                legacy: rest,
              },
            },
            { upsert: true },
          );
          inserted++;
        } catch (e: unknown) {
          skipped++;
          this.log.warn(`banner #${mysqlId}: ${(e as Error).message}`);
        }
      }
      return { inserted, skipped, mysql_count: rows.length };
    });
  }

  private async runStep(
    collection: string,
    fn: () => Promise<{ inserted: number; skipped: number; mysql_count: number }>,
  ): Promise<MigrationStep> {
    const errors: string[] = [];
    try {
      this.log.log(`Migrating ${collection}...`);
      const r = await fn();
      this.log.log(
        `${collection}: ${r.inserted} upserted, ${r.skipped} skipped (mysql had ${r.mysql_count})`,
      );
      return { collection, inserted: r.inserted, skipped: r.skipped, mysql_count: r.mysql_count, errors };
    } catch (e: unknown) {
      const msg = (e as Error).message;
      this.log.error(`${collection} FAILED: ${msg}`);
      errors.push(msg);
      return { collection, inserted: 0, skipped: 0, mysql_count: 0, errors };
    }
  }

  private tryParseJSON(value: unknown): unknown {
    if (value === null || value === undefined) return undefined;
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  /** Count documents in each MongoDB collection — for quick verification. */
  async counts() {
    const [users, vendors, deliveryMen, restaurants, foods, orders, categories, cuisines, banners] = await Promise.all([
      this.userModel.countDocuments(),
      this.vendorModel.countDocuments(),
      this.dmModel.countDocuments(),
      this.restaurantModel.countDocuments(),
      this.foodModel.countDocuments(),
      this.orderModel.countDocuments(),
      this.categoryModel.countDocuments(),
      this.cuisineModel.countDocuments(),
      this.bannerModel.countDocuments(),
    ]);
    return {
      users, vendors, delivery_men: deliveryMen, restaurants, foods, orders,
      categories, cuisines, banners,
    };
  }
}
