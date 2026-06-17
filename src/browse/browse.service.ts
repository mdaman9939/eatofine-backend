import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';
import { storageFullUrl } from '../common/storage-url';

interface MongoRestaurantDoc {
  mysql_id?: number;
  name?: string;
  phone?: string;
  email?: string;
  logo?: string;
  cover_photo?: string;
  latitude?: number | string;
  longitude?: number | string;
  address?: string;
  minimum_order?: number;
  delivery_time?: string;
  rating?: string | number;
  avg_rating?: number;
  rating_count?: number;
  free_delivery?: boolean;
  delivery?: boolean;
  take_away?: boolean;
  is_dine_in_active?: boolean;
  veg?: boolean;
  non_veg?: boolean;
  minimum_shipping_charge?: number;
  schedule_order?: boolean;
  status?: boolean;
  active?: boolean;
  mysql_zone_id?: number;
  mysql_vendor_id?: number;
  opening_time?: Date | string | null;
  closeing_time?: Date | string | null;
  food_section?: boolean;
  open?: number;
  order_count?: number;
  comission?: number;
  restaurant_model?: string;
}

interface MongoFoodDoc {
  mysql_id?: number;
  name?: string;
  description?: string;
  image?: string;
  mysql_category_id?: number;
  category_ids?: string | unknown;
  variations?: unknown;
  add_ons?: unknown;
  attributes?: unknown;
  choice_options?: unknown;
  price?: number;
  tax?: number;
  tax_type?: string;
  discount?: number;
  discount_type?: string;
  veg?: boolean;
  status?: boolean;
  mysql_restaurant_id?: number;
  avg_rating?: number;
  rating_count?: number;
  recommended?: boolean;
  order_count?: number;
}

interface MongoCategoryDoc {
  mysql_id?: number;
  name?: string;
  image?: string;
  parent_id?: number;
}

@Injectable()
export class BrowseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mongo: MongoDataService,
  ) {}

  /** Feature flag â€” when "1", browse reads route to MongoDB instead of MySQL. */
  private useMongo(): boolean {
    const v = (process.env.USE_MONGO_BROWSE ?? '1').toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }

  private fullUrl(folder: string, file?: string | null) {
    return storageFullUrl(folder, file);
  }

  private mapRestaurant(r: {
    id: bigint;
    name: string;
    phone: string;
    email: string | null;
    logo: string | null;
    cover_photo: string | null;
    latitude: string | null;
    longitude: string | null;
    address: string | null;
    minimum_order: number | { toString(): string };
    delivery_time: string | null;
    rating: string | null;
    avg_rating?: number;
    rating_count?: number;
    free_delivery: boolean;
    delivery: boolean;
    take_away: boolean;
    is_dine_in_active?: boolean;
    veg: boolean;
    non_veg: boolean;
    minimum_shipping_charge: number | { toString(): string };
    schedule_order: boolean;
    status: boolean;
    active: boolean;
    zone_id: bigint | null;
    vendor_id: bigint;
    opening_time: Date | null;
    closeing_time: Date | null;
    food_section: boolean;
    open?: number;
  }) {
    return {
      id: r.id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      logo: r.logo,
      logo_full_url: this.fullUrl('restaurant', r.logo),
      cover_photo: r.cover_photo,
      cover_photo_full_url: this.fullUrl('restaurant/cover', r.cover_photo),
      latitude: r.latitude,
      longitude: r.longitude,
      address: r.address,
      minimum_order: Number(r.minimum_order ?? 0),
      delivery_time: r.delivery_time ?? '30-40',
      avg_rating: r.avg_rating ?? 0,
      rating_count: r.rating_count ?? 0,
      free_delivery: r.free_delivery ? 1 : 0,
      delivery: r.delivery ? 1 : 0,
      take_away: r.take_away ? 1 : 0,
      // The customer app reads this as a boolean (isActiveDineIn) and gates the
      // "Dine In" checkout option on it. Default ON unless a restaurant has
      // explicitly opted out (is_dine_in_active === false from the vendor app).
      is_dine_in_active: r.is_dine_in_active === false ? false : true,
      veg: r.veg ? 1 : 0,
      non_veg: r.non_veg ? 1 : 0,
      minimum_shipping_charge: Number(r.minimum_shipping_charge ?? 0),
      schedule_order: r.schedule_order ? 1 : 0,
      status: r.status ? 1 : 0,
      // Flutter restaurant cards gate navigation on restaurant_status (== 1).
      // Without it the field is null and tapping a card does nothing / shows
      // "Restaurant is not available". Browse only returns live restaurants,
      // so mirror status here.
      restaurant_status: r.status ? 1 : 0,
      active: r.active ? 1 : 0,
      open: r.open ?? 1,
      zone_id: r.zone_id,
      vendor_id: r.vendor_id,
      opening_time: r.opening_time,
      closeing_time: r.closeing_time,
      food_section: r.food_section ? 1 : 0,
    };
  }

  /** Map MongoDB restaurant doc â†’ response shape (mirrors mapRestaurant).
   *  When the restaurant has no logo, fall back to the owner's (vendor)
   *  profile image so the card/header still shows the photo they uploaded. */
  private mapRestaurantMongo(r: MongoRestaurantDoc, vendorImage?: string | null) {
    const logo = r.logo ?? null;
    const logoUrl = this.fullUrl('restaurant', logo) ?? this.fullUrl('profile', vendorImage ?? null);
    return {
      id: Number(r.mysql_id ?? 0),
      name: r.name ?? null,
      phone: r.phone ?? null,
      email: r.email ?? null,
      logo: logo ?? vendorImage ?? null,
      logo_full_url: logoUrl,
      cover_photo: r.cover_photo ?? null,
      cover_photo_full_url: this.fullUrl('restaurant/cover', r.cover_photo ?? null),
      latitude: r.latitude != null ? String(r.latitude) : null,
      longitude: r.longitude != null ? String(r.longitude) : null,
      address: r.address ?? null,
      minimum_order: Number(r.minimum_order ?? 0),
      delivery_time: r.delivery_time ?? '30-40',
      avg_rating: r.avg_rating ?? 0,
      rating_count: r.rating_count ?? 0,
      free_delivery: r.free_delivery ? 1 : 0,
      delivery: r.delivery ? 1 : 0,
      take_away: r.take_away ? 1 : 0,
      // The customer app reads this as a boolean (isActiveDineIn) and gates the
      // "Dine In" checkout option on it. Default ON unless a restaurant has
      // explicitly opted out (is_dine_in_active === false from the vendor app).
      is_dine_in_active: r.is_dine_in_active === false ? false : true,
      veg: r.veg ? 1 : 0,
      non_veg: r.non_veg ? 1 : 0,
      minimum_shipping_charge: Number(r.minimum_shipping_charge ?? 0),
      schedule_order: r.schedule_order ? 1 : 0,
      status: r.status ? 1 : 0,
      // Flutter restaurant cards gate navigation on restaurant_status (== 1).
      // Without it the field is null and tapping a card does nothing / shows
      // "Restaurant is not available". Browse only returns live restaurants,
      // so mirror status here.
      restaurant_status: r.status ? 1 : 0,
      active: r.active ? 1 : 0,
      open: r.open ?? 1,
      zone_id: r.mysql_zone_id != null ? Number(r.mysql_zone_id) : null,
      vendor_id: Number(r.mysql_vendor_id ?? 0),
      opening_time: r.opening_time ?? null,
      closeing_time: r.closeing_time ?? null,
      food_section: r.food_section ? 1 : 0,
    };
  }

  /** Batch-fetch owner (vendor) images for a set of restaurants, so list cards
   *  can fall back to the vendor's photo when a restaurant has no logo. */
  private async vendorImageMap(restaurants: MongoRestaurantDoc[]): Promise<Map<number, string | null>> {
    const ids = Array.from(new Set(
      restaurants.filter((r) => !r.logo && r.mysql_vendor_id).map((r) => Number(r.mysql_vendor_id)),
    ));
    if (ids.length === 0) return new Map();
    const vendors = await this.mongo.findMany<{ mysql_id: number; image?: string | null }>(
      'vendors',
      { mysql_id: { $in: ids } },
      { projection: { mysql_id: 1, image: 1 } as Record<string, 0 | 1> },
    );
    return new Map(vendors.map((v) => [Number(v.mysql_id), v.image ?? null]));
  }

  private mapFood(
    f: {
      id: bigint;
      name: string | null;
      description: string | null;
      image: string | null;
      category_id: bigint | null;
      category_ids: string | null;
      variations: string | null;
      add_ons: string | null;
      attributes: string | null;
      choice_options: string | null;
      price: number | { toString(): string };
      tax: number | { toString(): string };
      tax_type: string;
      discount: number | { toString(): string };
      discount_type: string;
      veg: boolean;
      status: boolean;
      restaurant_id: bigint;
      avg_rating: number;
      rating_count: number;
      recommended: boolean;
    },
    restaurantName?: string,
  ) {
    const safeParse = (s: string | null) => {
      if (!s) return [];
      try {
        return JSON.parse(s);
      } catch {
        return [];
      }
    };
    return {
      id: f.id,
      name: f.name,
      description: f.description,
      image: f.image,
      image_full_url: this.fullUrl('product', f.image),
      category_id: f.category_id,
      category_ids: safeParse(f.category_ids),
      variations: safeParse(f.variations),
      add_ons: safeParse(f.add_ons),
      attributes: safeParse(f.attributes),
      choice_options: safeParse(f.choice_options),
      price: Number(f.price),
      tax: Number(f.tax),
      tax_type: f.tax_type,
      discount: Number(f.discount),
      discount_type: f.discount_type,
      veg: f.veg ? 1 : 0,
      status: f.status ? 1 : 0,
      restaurant_id: f.restaurant_id,
      restaurant_name: restaurantName ?? null,
      avg_rating: f.avg_rating,
      rating_count: f.rating_count,
      recommended: f.recommended ? 1 : 0,
    };
  }

  /** Map MongoDB food doc â†’ response shape (mirrors mapFood). */
  private mapFoodMongo(f: MongoFoodDoc, restaurantName?: string) {
    const safeParse = (s: unknown): unknown => {
      if (s == null) return [];
      if (typeof s !== 'string') return s;
      try {
        return JSON.parse(s);
      } catch {
        return [];
      }
    };
    return {
      id: Number(f.mysql_id ?? 0),
      name: f.name ?? null,
      description: f.description ?? null,
      image: f.image ?? null,
      image_full_url: this.fullUrl('product', f.image ?? null),
      category_id: f.mysql_category_id != null ? Number(f.mysql_category_id) : null,
      category_ids: safeParse(f.category_ids),
      variations: safeParse(f.variations),
      add_ons: safeParse(f.add_ons),
      attributes: safeParse(f.attributes),
      choice_options: safeParse(f.choice_options),
      price: Number(f.price ?? 0),
      tax: Number(f.tax ?? 0),
      tax_type: f.tax_type ?? 'percent',
      discount: Number(f.discount ?? 0),
      discount_type: f.discount_type ?? 'percent',
      veg: f.veg ? 1 : 0,
      status: f.status ? 1 : 0,
      restaurant_id: Number(f.mysql_restaurant_id ?? 0),
      restaurant_name: restaurantName ?? null,
      avg_rating: Number(f.avg_rating ?? 0),
      rating_count: Number(f.rating_count ?? 0),
      recommended: f.recommended ? 1 : 0,
    };
  }

  async getRestaurants(opts: { zoneId?: number; limit: number; offset: number; filter?: string }) {
    if (this.useMongo()) {
      const filter: Record<string, unknown> = { status: true, active: true };
      if (opts.zoneId) filter.mysql_zone_id = Number(opts.zoneId);
      const total = await this.mongo.count('restaurants', filter);
      const rows = await this.mongo.findMany<MongoRestaurantDoc>('restaurants', filter, {
        limit: opts.limit,
        skip: Math.max(0, (opts.offset - 1) * opts.limit),
        sort: { mysql_id: 1 },
      });
      const vendorImg = await this.vendorImageMap(rows);
      return {
        filter_data: opts.filter ?? 'all',
        total_size: total,
        limit: String(opts.limit),
        offset: String(opts.offset),
        restaurants: rows.map((r) => this.mapRestaurantMongo(r, vendorImg.get(Number(r.mysql_vendor_id ?? 0)))),
      };
    }
    const where: { status: boolean; active?: boolean; zone_id?: bigint } = { status: true, active: true };
    if (opts.zoneId) where.zone_id = BigInt(opts.zoneId);
    const total = await this.prisma.restaurants.count({ where });
    const rows = await this.prisma.restaurants.findMany({
      where,
      take: opts.limit,
      skip: Math.max(0, (opts.offset - 1) * opts.limit),
      orderBy: { id: 'asc' },
    });
    return {
      filter_data: opts.filter ?? 'all',
      total_size: total,
      limit: String(opts.limit),
      offset: String(opts.offset),
      restaurants: rows.map((r) => this.mapRestaurant(r)),
    };
  }

  async getRestaurantsLatest(zoneId?: number, limit = 10, offset = 1) {
    if (this.useMongo()) {
      return this.queryRestaurantsOrderedMongo(zoneId, limit, offset, { mysql_id: -1 });
    }
    return this.queryRestaurantsOrdered(zoneId, limit, offset, { id: 'desc' });
  }

  async getRestaurantsPopular(zoneId?: number, limit = 10, offset = 1) {
    if (this.useMongo()) {
      return this.queryRestaurantsOrderedMongo(zoneId, limit, offset, { order_count: -1 });
    }
    return this.queryRestaurantsOrdered(zoneId, limit, offset, { order_count: 'desc' });
  }

  private async queryRestaurantsOrderedMongo(
    zoneId: number | undefined,
    limit: number,
    offset: number,
    sort: Record<string, 1 | -1>,
  ) {
    const filter: Record<string, unknown> = { status: true, active: true };
    if (zoneId) filter.mysql_zone_id = Number(zoneId);
    const total = await this.mongo.count('restaurants', filter);
    const rows = await this.mongo.findMany<MongoRestaurantDoc>('restaurants', filter, {
      limit,
      skip: Math.max(0, (offset - 1) * limit),
      sort,
    });
    return {
      total_size: total,
      limit: String(limit),
      offset: String(offset),
      restaurants: rows.map((r) => this.mapRestaurantMongo(r)),
    };
  }

  private async queryRestaurantsOrdered(
    zoneId: number | undefined,
    limit: number,
    offset: number,
    orderBy: Record<string, 'asc' | 'desc'>,
  ) {
    const where: { status: boolean; active?: boolean; zone_id?: bigint } = { status: true, active: true };
    if (zoneId) where.zone_id = BigInt(zoneId);
    const total = await this.prisma.restaurants.count({ where });
    const rows = await this.prisma.restaurants.findMany({
      where,
      take: limit,
      skip: Math.max(0, (offset - 1) * limit),
      orderBy,
    });
    return {
      total_size: total,
      limit: String(limit),
      offset: String(offset),
      restaurants: rows.map((r) => this.mapRestaurant(r)),
    };
  }

  async getRestaurantDetails(idOrSlug: number | string) {
    const numeric = /^\d+$/.test(String(idOrSlug)) ? Number(idOrSlug) : null;
    if (this.useMongo()) {
      const r = numeric !== null
        ? await this.mongo.findByMysqlId<MongoRestaurantDoc>('restaurants', numeric)
        : await this.mongo.findOne<MongoRestaurantDoc>('restaurants', { slug: String(idOrSlug) });
      if (!r) return null;
      const id = Number(r.mysql_id);
      const vendor = r.mysql_vendor_id
        ? await this.mongo.findByMysqlId<{ mysql_id: number; image?: string | null }>('vendors', Number(r.mysql_vendor_id))
        : null;
      const foods = await this.mongo.findMany<MongoFoodDoc>(
        'foods',
        { mysql_restaurant_id: Number(id), status: true },
        { sort: { mysql_id: 1 } },
      );
      const categoryIdsRaw = foods
        .map((f) => f.mysql_category_id)
        .filter((cid): cid is number => cid != null);
      const uniqueCatIds = Array.from(new Set(categoryIdsRaw.map((n) => Number(n))));
      const cats = uniqueCatIds.length
        ? await this.mongo.findMany<MongoCategoryDoc>('categories', {
            mysql_id: { $in: uniqueCatIds },
          })
        : [];
      return {
        ...this.mapRestaurantMongo(r, vendor?.image),
        foods: foods.map((f) => this.mapFoodMongo(f, r.name)),
        categories: cats.map((c) => ({
          id: Number(c.mysql_id ?? 0),
          name: c.name ?? null,
          image: c.image ?? null,
          image_full_url: this.fullUrl('category', c.image ?? null),
          parent_id: c.parent_id ?? 0,
        })),
      };
    }
    if (numeric === null) return null; // MySQL fallback only resolves numeric ids
    const r = await this.prisma.restaurants.findUnique({ where: { id: BigInt(numeric) } });
    if (!r) return null;
    const foods = await this.prisma.food.findMany({
      where: { restaurant_id: r.id, status: true },
      orderBy: { id: 'asc' },
    });
    const categoryIdsRaw = foods
      .map((f) => f.category_id)
      .filter((cid): cid is bigint => cid !== null);
    const uniqueCatIds = Array.from(new Set(categoryIdsRaw.map((bi) => Number(bi))));
    const cats = uniqueCatIds.length
      ? await this.prisma.categories.findMany({ where: { id: { in: uniqueCatIds.map((n) => BigInt(n)) } } })
      : [];
    return {
      ...this.mapRestaurant(r),
      foods: foods.map((f) => this.mapFood(f, r.name)),
      categories: cats.map((c) => ({
        id: c.id,
        name: c.name,
        image: c.image,
        image_full_url: this.fullUrl('category', c.image),
        parent_id: c.parent_id ?? 0,
      })),
    };
  }

  async getProductsLatest(zoneId?: number, limit = 10, offset = 1) {
    if (this.useMongo()) {
      return this.queryFoodsOrderedMongo(zoneId, limit, offset, { mysql_id: -1 });
    }
    return this.queryFoodsOrdered(zoneId, limit, offset, { id: 'desc' });
  }
  async getProductsPopular(zoneId?: number, limit = 10, offset = 1) {
    if (this.useMongo()) {
      return this.queryFoodsOrderedMongo(zoneId, limit, offset, { order_count: -1 });
    }
    return this.queryFoodsOrdered(zoneId, limit, offset, { order_count: 'desc' });
  }
  async getProductsRecommended(zoneId?: number, limit = 10, offset = 1) {
    if (this.useMongo()) {
      return this.queryFoodsOrderedMongo(zoneId, limit, offset, { mysql_id: 1 }, { recommended: true });
    }
    return this.queryFoodsOrdered(zoneId, limit, offset, { id: 'asc' }, { recommended: true });
  }
  async getProductsMostReviewed(zoneId?: number, limit = 10, offset = 1) {
    if (this.useMongo()) {
      return this.queryFoodsOrderedMongo(zoneId, limit, offset, { rating_count: -1 });
    }
    return this.queryFoodsOrdered(zoneId, limit, offset, { rating_count: 'desc' });
  }

  private async queryFoodsOrderedMongo(
    zoneId: number | undefined,
    limit: number,
    offset: number,
    sort: Record<string, 1 | -1>,
    extraFilter: Record<string, unknown> = {},
  ) {
    const restaurantFilter: Record<string, unknown> = { status: true, active: true };
    if (zoneId) restaurantFilter.mysql_zone_id = Number(zoneId);
    const restaurants = await this.mongo.findMany<MongoRestaurantDoc>(
      'restaurants',
      restaurantFilter,
      { projection: { mysql_id: 1, name: 1 } },
    );
    const restaurantNameById = new Map<number, string | undefined>(
      restaurants.map((r) => [Number(r.mysql_id ?? 0), r.name]),
    );
    const restaurantIds = restaurants.map((r) => Number(r.mysql_id ?? 0));
    const foodFilter: Record<string, unknown> = {
      status: true,
      mysql_restaurant_id: { $in: restaurantIds },
      ...extraFilter,
    };
    const total = await this.mongo.count('foods', foodFilter);
    const rows = await this.mongo.findMany<MongoFoodDoc>('foods', foodFilter, {
      limit,
      skip: Math.max(0, (offset - 1) * limit),
      sort,
    });
    return {
      total_size: total,
      limit: String(limit),
      offset: String(offset),
      products: rows.map((f) =>
        this.mapFoodMongo(f, restaurantNameById.get(Number(f.mysql_restaurant_id ?? 0)) ?? undefined),
      ),
    };
  }

  private async queryFoodsOrdered(
    zoneId: number | undefined,
    limit: number,
    offset: number,
    orderBy: Record<string, 'asc' | 'desc'>,
    extraWhere: Record<string, unknown> = {},
  ) {
    const restaurantWhere: { status: boolean; active?: boolean; zone_id?: bigint } = {
      status: true,
      active: true,
    };
    if (zoneId) restaurantWhere.zone_id = BigInt(zoneId);
    const restaurants = await this.prisma.restaurants.findMany({
      where: restaurantWhere,
      select: { id: true, name: true },
    });
    const restaurantNameById = new Map(restaurants.map((r) => [r.id, r.name]));
    const restaurantIds = restaurants.map((r) => r.id);
    const total = await this.prisma.food.count({
      where: { status: true, restaurant_id: { in: restaurantIds }, ...extraWhere },
    });
    const rows = await this.prisma.food.findMany({
      where: { status: true, restaurant_id: { in: restaurantIds }, ...extraWhere },
      take: limit,
      skip: Math.max(0, (offset - 1) * limit),
      orderBy,
    });
    return {
      total_size: total,
      limit: String(limit),
      offset: String(offset),
      products: rows.map((f) => this.mapFood(f, restaurantNameById.get(f.restaurant_id) ?? undefined)),
    };
  }

  async getProductDetails(id: number) {
    if (this.useMongo()) {
      const f = await this.mongo.findByMysqlId<MongoFoodDoc>('foods', Number(id));
      if (!f) return null;
      const r = f.mysql_restaurant_id != null
        ? await this.mongo.findByMysqlId<MongoRestaurantDoc>('restaurants', Number(f.mysql_restaurant_id))
        : null;
      return this.mapFoodMongo(f, r?.name);
    }
    const f = await this.prisma.food.findUnique({ where: { id: BigInt(id) } });
    if (!f) return null;
    const r = await this.prisma.restaurants.findUnique({ where: { id: f.restaurant_id } });
    return this.mapFood(f, r?.name);
  }

  async getCategoryProducts(categoryId: number, limit = 10, offset = 1) {
    if (this.useMongo()) {
      const filter: Record<string, unknown> = { status: true, mysql_category_id: Number(categoryId) };
      const total = await this.mongo.count('foods', filter);
      const rows = await this.mongo.findMany<MongoFoodDoc>('foods', filter, {
        limit,
        skip: Math.max(0, (offset - 1) * limit),
      });
      return {
        total_size: total,
        limit: String(limit),
        offset: String(offset),
        products: rows.map((f) => this.mapFoodMongo(f)),
      };
    }
    const where = { status: true, category_id: BigInt(categoryId) };
    const total = await this.prisma.food.count({ where });
    const rows = await this.prisma.food.findMany({
      where,
      take: limit,
      skip: Math.max(0, (offset - 1) * limit),
    });
    return {
      total_size: total,
      limit: String(limit),
      offset: String(offset),
      products: rows.map((f) => this.mapFood(f)),
    };
  }

  async getCategoryRestaurants(categoryId: number, limit = 10, offset = 1) {
    if (this.useMongo()) {
      // Pull the category's FULL food docs (not just restaurant ids) so we can
      // both (a) pick the restaurants that actually serve this category and
      // (b) attach each restaurant's foods for the card preview. Without the
      // foods array the customer app shows "No food available" on every card.
      const foods = await this.mongo.findMany<MongoFoodDoc>(
        'foods',
        { status: true, mysql_category_id: Number(categoryId) },
      );
      const foodsByRestaurant = new Map<number, MongoFoodDoc[]>();
      for (const f of foods) {
        const rid = Number(f.mysql_restaurant_id ?? 0);
        if (!rid) continue;
        const arr = foodsByRestaurant.get(rid) ?? [];
        arr.push(f);
        foodsByRestaurant.set(rid, arr);
      }
      const restaurantIds = Array.from(foodsByRestaurant.keys());
      const filter: Record<string, unknown> = {
        status: true,
        mysql_id: { $in: restaurantIds },
      };
      const total = await this.mongo.count('restaurants', filter);
      const rows = await this.mongo.findMany<MongoRestaurantDoc>('restaurants', filter, {
        limit,
        skip: Math.max(0, (offset - 1) * limit),
      });
      const vendorImg = await this.vendorImageMap(rows);
      return {
        total_size: total,
        limit: String(limit),
        offset: String(offset),
        restaurants: rows.map((r) => {
          const rid = Number(r.mysql_id ?? 0);
          const rFoods = foodsByRestaurant.get(rid) ?? [];
          return {
            ...this.mapRestaurantMongo(r, vendorImg.get(Number(r.mysql_vendor_id ?? 0))),
            foods_count: rFoods.length,
            foods: rFoods.slice(0, 10).map((f) => this.mapFoodMongo(f, r.name ?? undefined)),
          };
        }),
      };
    }
    const foods = await this.prisma.food.findMany({
      where: { status: true, category_id: BigInt(categoryId) },
      select: { restaurant_id: true },
    });
    const countByRestaurant = new Map<string, number>();
    for (const f of foods) {
      const key = String(f.restaurant_id);
      countByRestaurant.set(key, (countByRestaurant.get(key) ?? 0) + 1);
    }
    const restaurantIds = Array.from(new Set(foods.map((f) => f.restaurant_id)));
    const where = { status: true, id: { in: restaurantIds } };
    const total = await this.prisma.restaurants.count({ where });
    const rows = await this.prisma.restaurants.findMany({
      where,
      take: limit,
      skip: Math.max(0, (offset - 1) * limit),
    });
    return {
      total_size: total,
      limit: String(limit),
      offset: String(offset),
      restaurants: rows.map((r) => ({
        ...this.mapRestaurant(r),
        foods_count: countByRestaurant.get(String(r.id)) ?? 0,
      })),
    };
  }
}
