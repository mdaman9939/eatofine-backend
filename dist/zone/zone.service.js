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
exports.ZoneService = void 0;
exports.pointInPolygon = pointInPolygon;
const common_1 = require("@nestjs/common");
const mongo_data_service_1 = require("../mongo/mongo-data.service");
const prisma_service_1 = require("../prisma/prisma.service");
function pointInPolygon(lat, lng, poly) {
    if (!Array.isArray(poly) || poly.length < 3)
        return false;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = Number(poly[i]?.lng), yi = Number(poly[i]?.lat);
        const xj = Number(poly[j]?.lng), yj = Number(poly[j]?.lat);
        if (![xi, yi, xj, yj].every(Number.isFinite))
            continue;
        const denom = yj - yi || 1e-12;
        const intersect = (yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / denom + xi;
        if (intersect)
            inside = !inside;
    }
    return inside;
}
function parseCoordinates(raw) {
    let arr = raw;
    if (typeof raw === 'string') {
        try {
            arr = JSON.parse(raw);
        }
        catch {
            return [];
        }
    }
    if (!Array.isArray(arr))
        return [];
    return arr
        .map((p) => ({ lat: Number(p?.lat), lng: Number(p?.lng) }))
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
}
let ZoneService = class ZoneService {
    mongo;
    prisma;
    constructor(mongo, prisma) {
        this.mongo = mongo;
        this.prisma = prisma;
    }
    useMongo() {
        const v = (process.env.USE_MONGO_CONFIG ?? '1').toLowerCase();
        return v === '1' || v === 'true' || v === 'yes';
    }
    async loadActiveZones() {
        if (this.useMongo()) {
            const zones = await this.mongo.findMany('zones', { status: true }, { sort: { mysql_id: 1 } });
            return zones.map((z) => ({
                id: Number(z.mysql_id),
                name: z.name ?? null,
                coordinates: parseCoordinates(z.coordinates),
            }));
        }
        const zones = await this.prisma.zones.findMany({ where: { status: true }, orderBy: { id: 'asc' } });
        return zones.map((z) => ({
            id: Number(z.id),
            name: z.name ?? null,
            coordinates: parseCoordinates(z.coordinates),
        }));
    }
    async classifyPoint(lat, lng) {
        const all = await this.loadActiveZones();
        const polygonZones = all.filter((z) => z.coordinates.length >= 3);
        const geofencingActive = polygonZones.length > 0;
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            const matches = polygonZones
                .filter((z) => pointInPolygon(lat, lng, z.coordinates))
                .map((z) => ({ id: z.id, name: z.name }));
            if (matches.length)
                return { zones: matches, geofencingActive, serviceable: true };
        }
        if (!geofencingActive) {
            const fb = all[0];
            return { zones: fb ? [{ id: fb.id, name: fb.name }] : [], geofencingActive, serviceable: !!fb };
        }
        return { zones: [], geofencingActive, serviceable: false };
    }
    async resolveZoneIds(lat, lng) {
        return (await this.classifyPoint(lat, lng)).zones.map((z) => z.id);
    }
};
exports.ZoneService = ZoneService;
exports.ZoneService = ZoneService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [mongo_data_service_1.MongoDataService,
        prisma_service_1.PrismaService])
], ZoneService);
//# sourceMappingURL=zone.service.js.map