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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogController = void 0;
const common_1 = require("@nestjs/common");
const catalog_router_service_1 = require("./catalog-router.service");
let CatalogController = class CatalogController {
    catalog;
    constructor(catalog) {
        this.catalog = catalog;
    }
    zones() {
        return this.catalog.listZones();
    }
    checkZone(latStr, lngStr) {
        return this.catalog.checkZone(Number(latStr), Number(lngStr));
    }
    categories() {
        return this.catalog.listCategories();
    }
    childCategories(parentIdStr) {
        return this.catalog.listChildCategories(parseInt(parentIdStr, 10) || 0);
    }
    banners() {
        return this.catalog.listBanners();
    }
    cuisines() {
        return this.catalog.listCuisines();
    }
    currencies() {
        return this.catalog.listCurrencies();
    }
    ads() {
        return this.catalog.listAdvertisements();
    }
};
exports.CatalogController = CatalogController;
__decorate([
    (0, common_1.Get)('zone/list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "zones", null);
__decorate([
    (0, common_1.Get)('zone/check'),
    __param(0, (0, common_1.Query)('lat')),
    __param(1, (0, common_1.Query)('lng')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "checkZone", null);
__decorate([
    (0, common_1.Get)('categories'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "categories", null);
__decorate([
    (0, common_1.Get)('categories/childes/:parentId'),
    __param(0, (0, common_1.Param)('parentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "childCategories", null);
__decorate([
    (0, common_1.Get)('banners'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "banners", null);
__decorate([
    (0, common_1.Get)('cuisine/list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "cuisines", null);
__decorate([
    (0, common_1.Get)('currencies'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "currencies", null);
__decorate([
    (0, common_1.Get)('advertisement/list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "ads", null);
exports.CatalogController = CatalogController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [catalog_router_service_1.CatalogRouterService])
], CatalogController);
//# sourceMappingURL=catalog.controller.js.map