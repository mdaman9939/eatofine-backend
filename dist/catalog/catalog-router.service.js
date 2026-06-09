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
exports.CatalogRouterService = void 0;
const common_1 = require("@nestjs/common");
const catalog_service_1 = require("./catalog.service");
const catalog_mongo_service_1 = require("./catalog-mongo.service");
let CatalogRouterService = class CatalogRouterService {
    mysql;
    mongo;
    log = new common_1.Logger('Catalog');
    constructor(mysql, mongo) {
        this.mysql = mysql;
        this.mongo = mongo;
        const flag = this.useMongo();
        this.log.log(`Catalog backend: ${flag ? 'MongoDB' : 'MySQL'}`);
    }
    useMongo() {
        const v = (process.env.USE_MONGO_CATALOG ?? '1').toLowerCase();
        return v === '1' || v === 'true' || v === 'yes';
    }
    listCategories() {
        return this.useMongo() ? this.mongo.listCategories() : this.mysql.listCategories();
    }
    listChildCategories(parentId) {
        return this.useMongo()
            ? this.mongo.listChildCategories(parentId)
            : this.mysql.listChildCategories(parentId);
    }
    listBanners() {
        return this.useMongo() ? this.mongo.listBanners() : this.mysql.listBanners();
    }
    listCuisines() {
        return this.useMongo() ? this.mongo.listCuisines() : this.mysql.listCuisines();
    }
    listZones() {
        return this.useMongo() ? this.mongo.listZones() : this.mysql.listZones();
    }
    checkZone(lat, lng) {
        return this.useMongo() ? this.mongo.checkZone(lat, lng) : this.mysql.checkZone(lat, lng);
    }
    listCurrencies() {
        return this.useMongo() ? this.mongo.listCurrencies() : this.mysql.listCurrencies();
    }
    listAdvertisements() {
        return this.useMongo() ? this.mongo.listAdvertisements() : this.mysql.listAdvertisements();
    }
};
exports.CatalogRouterService = CatalogRouterService;
exports.CatalogRouterService = CatalogRouterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [catalog_service_1.CatalogService,
        catalog_mongo_service_1.CatalogMongoService])
], CatalogRouterService);
//# sourceMappingURL=catalog-router.service.js.map