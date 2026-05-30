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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let CatalogService = class CatalogService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    storageBase() {
        return process.env.STORAGE_BASE_URL ?? 'http://192.168.0.159:3000/storage';
    }
    fullUrl(folder, file) {
        return file ? `${this.storageBase()}/${folder}/${file}` : null;
    }
    async listZones() {
        const rows = await this.prisma.$queryRawUnsafe(`SELECT id, name, status, ST_AsGeoJSON(coordinates) AS coords_geojson FROM zones WHERE status = 1`);
        return rows.map((r) => ({
            id: r.id,
            name: r.name,
            coordinates: r.coords_geojson ? JSON.parse(r.coords_geojson) : null,
            status: r.status,
        }));
    }
    async checkZone(lat, lng) {
        const rows = await this.prisma.$queryRawUnsafe(`SELECT id, name FROM zones WHERE status = 1 AND ST_Contains(coordinates, ST_PointFromText(?))`, `POINT(${lng} ${lat})`);
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
    async listChildCategories(parentId) {
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
        const rows = await this.prisma.advertisements.findMany({ where: { status: 'approved' } }).catch(() => []);
        return rows.map((a) => ({
            id: a.id,
            title: a.title,
            description: a.description,
            status: a.status,
        }));
    }
};
exports.CatalogService = CatalogService;
exports.CatalogService = CatalogService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CatalogService);
//# sourceMappingURL=catalog.service.js.map