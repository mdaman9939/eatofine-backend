import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  private storageBase(): string {
    return process.env.STORAGE_BASE_URL ?? 'http://127.0.0.1:3000/storage';
  }

  fullUrl(folder: string, file?: string | null) {
    return file ? `${this.storageBase()}/${folder}/${file}` : null;
  }

  async listZones() {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ id: number; name: string; status: number; coords_geojson: string }>
    >(`SELECT id, name, status, ST_AsGeoJSON(coordinates) AS coords_geojson FROM zones WHERE status = 1`);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      coordinates: r.coords_geojson ? JSON.parse(r.coords_geojson) : null,
      status: r.status,
    }));
  }

  async checkZone(lat: number, lng: number) {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: number; name: string }>>(
      `SELECT id, name FROM zones WHERE status = 1 AND ST_Contains(coordinates, ST_PointFromText(?))`,
      `POINT(${lng} ${lat})`,
    );
    return { zone_id: rows.map((r) => r.id), zone_data: rows };
  }

  async listCategories() {
    const cats = await this.prisma.categories.findMany({ where: { status: true, position: 0 } });
    const ids = cats.map((c) => c.id);
    const childesCounts = await this.prisma.categories.groupBy({
      by: ['parent_id'],
      where: { parent_id: { in: ids.map((id) => Number(id)) } },
      _count: { _all: true },
    });
    const childesByParent = new Map(childesCounts.map((c) => [BigInt(c.parent_id ?? 0), c._count._all]));
    return cats.map((c) => ({
      id: c.id,
      name: c.name,
      image: c.image,
      image_full_url: this.fullUrl('category', c.image),
      parent_id: c.parent_id ?? 0,
      position: c.position,
      status: c.status ? 1 : 0,
      slug: c.slug,
      childes_count: childesByParent.get(c.id) ?? 0,
      products_count: 0,
    }));
  }

  async listChildCategories(parentId: number) {
    const cats = await this.prisma.categories.findMany({ where: { status: true, parent_id: parentId } });
    return cats.map((c) => ({
      id: c.id,
      name: c.name,
      image: c.image,
      image_full_url: this.fullUrl('category', c.image),
      parent_id: c.parent_id ?? 0,
      position: c.position,
      status: c.status ? 1 : 0,
      slug: c.slug,
    }));
  }

  async listBanners() {
    const banners = await this.prisma.banners.findMany({ where: { status: true } });
    return {
      campaigns: [],
      banners: banners.map((b) => ({
        id: b.id,
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
    const rows = await this.prisma.cuisines.findMany({ where: { status: true } });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      image: c.image,
      image_full_url: this.fullUrl('cuisine', c.image),
      status: c.status ? 1 : 0,
    }));
  }

  async listCurrencies() {
    const rows = await this.prisma.currencies.findMany();
    return rows.map((c) => ({
      id: c.id,
      country: c.country,
      currency_code: c.currency_code,
      currency_symbol: c.currency_symbol,
      exchange_rate: c.exchange_rate,
    }));
  }

  async listAdvertisements() {
    const rows = await this.prisma.advertisements.findMany({ where: { status: 'approved' } }).catch(() => [] as { id: bigint; title: string | null; description: string | null; status: string }[]);
    return rows.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      status: a.status,
    }));
  }
}
