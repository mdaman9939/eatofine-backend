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
exports.SettingsService = void 0;
const common_1 = require("@nestjs/common");
const mongo_data_service_1 = require("../mongo/mongo-data.service");
let SettingsService = class SettingsService {
    mongo;
    cache = new Map();
    prefixCache = new Map();
    TTL_MS = 30_000;
    constructor(mongo) {
        this.mongo = mongo;
    }
    useMongo() {
        const v = (process.env.USE_MONGO_ADMIN ?? '1').toLowerCase();
        return v === '1' || v === 'true' || v === 'yes';
    }
    async get(key) {
        const cached = this.cache.get(key);
        if (cached && cached.expires > Date.now())
            return cached.value;
        if (!this.useMongo())
            return null;
        const row = await this.mongo.findOne('business_settings', { key });
        const value = row?.value ?? null;
        this.cache.set(key, { value, expires: Date.now() + this.TTL_MS });
        return value;
    }
    async getOr(key, fallback) {
        const v = await this.get(key);
        return v ?? fallback;
    }
    async getBool(key, fallback = false) {
        const v = await this.get(key);
        if (v === null)
            return fallback;
        return /^(true|1|yes|on)$/i.test(v.trim());
    }
    async getNum(key, fallback = 0) {
        const v = await this.get(key);
        if (v === null)
            return fallback;
        const n = parseFloat(v);
        return Number.isFinite(n) ? n : fallback;
    }
    async getByPrefix(prefix) {
        const cached = this.prefixCache.get(prefix);
        if (cached && cached.expires > Date.now())
            return cached.rows;
        if (!this.useMongo())
            return {};
        const escape = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const rows = await this.mongo.findMany('business_settings', { key: { $regex: `^${escape}` } });
        const obj = {};
        for (const r of rows)
            obj[r.key] = r.value;
        this.prefixCache.set(prefix, { rows: obj, expires: Date.now() + this.TTL_MS });
        return obj;
    }
    invalidate() {
        this.cache.clear();
        this.prefixCache.clear();
    }
};
exports.SettingsService = SettingsService;
exports.SettingsService = SettingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [mongo_data_service_1.MongoDataService])
], SettingsService);
//# sourceMappingURL=settings.service.js.map