import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category, CategoryDocument } from '../mongo/schemas/category.schema';
import { Cuisine, CuisineDocument } from '../mongo/schemas/cuisine.schema';
import { Banner, BannerDocument } from '../mongo/schemas/banner.schema';
import { MongoDataService } from '../mongo/mongo-data.service';

// Mongoose-backed implementation of the catalog endpoints. The shape of
// every method's return value is intentionally identical to the existing
// MySQL `CatalogService` so the controllers / mobile apps don't need to
// change a single line.

@Injectable()
export class CatalogMongoService {
  constructor(
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Cuisine.name) private readonly cuisineModel: Model<CuisineDocument>,
    @InjectModel(Banner.name) private readonly bannerModel: Model<BannerDocument>,
    private readonly mongo: MongoDataService,
  ) {}

  private storageBase(): string {
    return process.env.STORAGE_BASE_URL ?? 'http://127.0.0.1:3000/storage';
  }

  private fullUrl(folder: string, file?: string | null) {
    return file ? `${this.storageBase()}/${folder}/${file}` : null;
  }

  async listCategories() {
    // Top-level categories only (position = 0, status = true)
    const cats = await this.categoryModel
      .find({ status: true, position: 0 })
      .lean();

    const ids = cats.map((c) => c.mysql_id).filter((x): x is number => x !== undefined);
    // Count children per parent in one query
    const childCounts = await this.categoryModel.aggregate<{ _id: number; count: number }>([
      { $match: { parent_id: { $in: ids } } },
      { $group: { _id: '$parent_id', count: { $sum: 1 } } },
    ]);
    const childesByParent = new Map(childCounts.map((c) => [c._id, c.count]));

    return cats.map((c) => ({
      id: c.mysql_id,
      name: c.name,
      image: c.image,
      image_full_url: this.fullUrl('category', c.image),
      parent_id: c.parent_id ?? 0,
      childes_count: childesByParent.get(c.mysql_id ?? 0) ?? 0,
      position: c.position ?? 0,
      priority: c.priority ?? 0,
      status: c.status ? 1 : 0,
    }));
  }

  async listChildCategories(parentId: number) {
    const cats = await this.categoryModel
      .find({ status: true, parent_id: parentId })
      .lean();
    return cats.map((c) => ({
      id: c.mysql_id,
      name: c.name,
      image: c.image,
      image_full_url: this.fullUrl('category', c.image),
      parent_id: c.parent_id ?? 0,
      position: c.position ?? 0,
      priority: c.priority ?? 0,
      status: c.status ? 1 : 0,
    }));
  }

  async listBanners() {
    const banners = await this.bannerModel.find({ status: true }).lean();
    return {
      campaigns: [],
      banners: banners.map((b) => ({
        id: b.mysql_id,
        title: b.title,
        type: b.type,
        image: b.image,
        image_full_url: this.fullUrl('banner', b.image),
        data: b.data,
        zone_id: b.zone_id,
        status: b.status ? 1 : 0,
      })),
    };
  }

  async listCuisines() {
    const rows = await this.cuisineModel.find({ status: true }).lean();
    return rows.map((c) => ({
      id: c.mysql_id,
      name: c.name,
      image: c.image,
      image_full_url: this.fullUrl('cuisine', c.image),
      status: c.status ? 1 : 0,
    }));
  }

  // ── Zones / currencies / advertisements (Mongo equivalents of the
  //    previously MySQL-only CatalogService methods) ────────────────────

  async listZones() {
    const rows = await this.mongo.findMany<{
      mysql_id: number; name?: string | null; status?: boolean;
      coordinates?: Array<{ lat: number; lng: number }>;
    }>('zones', { status: true }, { sort: { mysql_id: -1 } });
    return rows.map((z) => ({
      id: Number(z.mysql_id),
      name: z.name ?? null,
      coordinates: Array.isArray(z.coordinates) ? z.coordinates : null,
      status: z.status ? 1 : 0,
    }));
  }

  async checkZone(lat: number, lng: number) {
    const rows = await this.mongo.findMany<{
      mysql_id: number; name?: string | null;
      coordinates?: Array<{ lat: number; lng: number }>;
    }>('zones', { status: true });
    // Point-in-polygon (ray casting) against each zone's coverage polygon —
    // the JS equivalent of MySQL's ST_Contains used by the SQL version.
    const matched = rows.filter((z) =>
      Array.isArray(z.coordinates) && z.coordinates.length >= 3 && pointInPolygon(lat, lng, z.coordinates),
    );
    // If nothing matches (zones drawn loosely), fall back to a default zone so
    // the customer app still resolves a zone instead of "service unavailable".
    const list = matched.length > 0 ? matched : rows.slice(0, 1);
    return {
      zone_id: list.map((z) => Number(z.mysql_id)),
      zone_data: list.map((z) => ({ id: Number(z.mysql_id), name: z.name ?? null })),
    };
  }

  async listCurrencies() {
    const rows = await this.mongo.findMany<{
      mysql_id: number; country?: string | null; currency_code?: string | null;
      currency_symbol?: string | null; exchange_rate?: number | string | null;
    }>('currencies', {}, { sort: { mysql_id: 1 } });
    return rows.map((c) => ({
      id: Number(c.mysql_id),
      country: c.country ?? null,
      currency_code: c.currency_code ?? null,
      currency_symbol: c.currency_symbol ?? null,
      exchange_rate: c.exchange_rate ?? null,
    }));
  }

  async listAdvertisements() {
    const rows = await this.mongo.findMany<{
      mysql_id: number; title?: string | null; description?: string | null; status?: string | null;
    }>('advertisements', { status: 'approved' }, { sort: { mysql_id: -1 } });
    return rows.map((a) => ({
      id: Number(a.mysql_id),
      title: a.title ?? null,
      description: a.description ?? null,
      status: a.status ?? null,
    }));
  }
}

/** Ray-casting point-in-polygon over a [{lat,lng}] ring. */
function pointInPolygon(lat: number, lng: number, poly: Array<{ lat: number; lng: number }>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].lng, yi = poly[i].lat;
    const xj = poly[j].lng, yj = poly[j].lat;
    const intersect = (yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
