import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category, CategoryDocument } from '../mongo/schemas/category.schema';
import { Cuisine, CuisineDocument } from '../mongo/schemas/cuisine.schema';
import { Banner, BannerDocument } from '../mongo/schemas/banner.schema';

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
  ) {}

  private storageBase(): string {
    return process.env.STORAGE_BASE_URL ?? 'http://192.168.0.159:3000/storage';
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
}
