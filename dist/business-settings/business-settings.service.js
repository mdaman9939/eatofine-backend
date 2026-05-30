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
exports.BusinessSettingsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let BusinessSettingsService = class BusinessSettingsService {
    prisma;
    cache = new Map();
    cachedAt = 0;
    ttlMs = 30_000;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async onModuleInit() {
        await this.refresh();
    }
    async refresh() {
        const rows = await this.prisma.business_settings.findMany({
            select: { key: true, value: true },
        });
        this.cache.clear();
        for (const r of rows)
            this.cache.set(r.key, r.value);
        this.cachedAt = Date.now();
    }
    async ensureFresh() {
        if (Date.now() - this.cachedAt > this.ttlMs)
            await this.refresh();
    }
    async get(key) {
        await this.ensureFresh();
        return this.cache.get(key) ?? null;
    }
    async getJson(key) {
        const v = await this.get(key);
        if (v === null || v === undefined)
            return null;
        try {
            return JSON.parse(v);
        }
        catch {
            return null;
        }
    }
    async getBool(key) {
        const v = await this.get(key);
        if (v === null)
            return false;
        return v === '1' || v === 'true';
    }
    async getInt(key, fallback = 0) {
        const v = await this.get(key);
        if (v === null)
            return fallback;
        const n = parseInt(v, 10);
        return Number.isFinite(n) ? n : fallback;
    }
    async getStatus(key) {
        const o = await this.getJson(key);
        return o ? o.status === '1' || o.status === 1 : false;
    }
};
exports.BusinessSettingsService = BusinessSettingsService;
exports.BusinessSettingsService = BusinessSettingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BusinessSettingsService);
//# sourceMappingURL=business-settings.service.js.map