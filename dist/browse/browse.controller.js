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
exports.parseZoneIdHeader = exports.BrowseController = void 0;
const common_1 = require("@nestjs/common");
const browse_service_1 = require("./browse.service");
const parseZoneIdHeader = (raw) => {
    if (!raw)
        return undefined;
    const v = Array.isArray(raw) ? raw[0] : raw;
    try {
        const parsed = JSON.parse(v);
        if (Array.isArray(parsed) && parsed.length > 0)
            return Number(parsed[0]);
        if (typeof parsed === 'number')
            return parsed;
    }
    catch {
        const n = parseInt(v, 10);
        if (Number.isFinite(n))
            return n;
    }
    return undefined;
};
exports.parseZoneIdHeader = parseZoneIdHeader;
let BrowseController = class BrowseController {
    browse;
    constructor(browse) {
        this.browse = browse;
    }
    async restaurantsList(filter, limit = '10', offset = '1', zoneHeader) {
        return this.browse.getRestaurants({
            zoneId: parseZoneIdHeader(zoneHeader),
            limit: parseInt(limit, 10) || 10,
            offset: parseInt(offset, 10) || 1,
            filter,
        });
    }
    restaurantsLatest(limit, offset, zoneHeader) {
        return this.browse.getRestaurantsLatest(parseZoneIdHeader(zoneHeader), parseInt(limit ?? '10', 10), parseInt(offset ?? '1', 10));
    }
    restaurantsPopular(limit, offset, zoneHeader) {
        return this.browse.getRestaurantsPopular(parseZoneIdHeader(zoneHeader), parseInt(limit ?? '10', 10), parseInt(offset ?? '1', 10));
    }
    async restaurantDetails(id) {
        const result = await this.browse.getRestaurantDetails(id);
        if (!result)
            throw new common_1.NotFoundException({ errors: [{ code: 'restaurant_id', message: 'not_found' }] });
        return result;
    }
    productsLatest(limit, offset, zoneHeader) {
        return this.browse.getProductsLatest(parseZoneIdHeader(zoneHeader), parseInt(limit ?? '10', 10), parseInt(offset ?? '1', 10));
    }
    productsPopular(limit, offset, zoneHeader) {
        return this.browse.getProductsPopular(parseZoneIdHeader(zoneHeader), parseInt(limit ?? '10', 10), parseInt(offset ?? '1', 10));
    }
    productsRecommended(limit, offset, zoneHeader) {
        return this.browse.getProductsRecommended(parseZoneIdHeader(zoneHeader), parseInt(limit ?? '10', 10), parseInt(offset ?? '1', 10));
    }
    productsMostReviewed(limit, offset, zoneHeader) {
        return this.browse.getProductsMostReviewed(parseZoneIdHeader(zoneHeader), parseInt(limit ?? '10', 10), parseInt(offset ?? '1', 10));
    }
    async productDetails(idStr) {
        const id = parseInt(idStr, 10);
        if (!Number.isFinite(id))
            throw new common_1.NotFoundException({ errors: [{ code: 'food_id', message: 'not_found' }] });
        const result = await this.browse.getProductDetails(id);
        if (!result)
            throw new common_1.NotFoundException({ errors: [{ code: 'food_id', message: 'not_found' }] });
        return result;
    }
    categoryProducts(categoryIdStr, limit, offset) {
        return this.browse.getCategoryProducts(parseInt(categoryIdStr, 10) || 0, parseInt(limit ?? '10', 10), parseInt(offset ?? '1', 10));
    }
    categoryRestaurants(categoryIdStr, limit, offset) {
        const categoryId = parseInt(categoryIdStr, 10) || 0;
        return this.browse.getCategoryRestaurants(categoryId, parseInt(limit ?? '10', 10), parseInt(offset ?? '1', 10));
    }
};
exports.BrowseController = BrowseController;
__decorate([
    (0, common_1.Get)('restaurants/get-restaurants/:filterData'),
    __param(0, (0, common_1.Param)('filterData')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('offset')),
    __param(3, (0, common_1.Headers)('zoneId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], BrowseController.prototype, "restaurantsList", null);
__decorate([
    (0, common_1.Get)('restaurants/latest'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __param(2, (0, common_1.Headers)('zoneId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], BrowseController.prototype, "restaurantsLatest", null);
__decorate([
    (0, common_1.Get)('restaurants/popular'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __param(2, (0, common_1.Headers)('zoneId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], BrowseController.prototype, "restaurantsPopular", null);
__decorate([
    (0, common_1.Get)('restaurants/details/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BrowseController.prototype, "restaurantDetails", null);
__decorate([
    (0, common_1.Get)('products/latest'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __param(2, (0, common_1.Headers)('zoneId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], BrowseController.prototype, "productsLatest", null);
__decorate([
    (0, common_1.Get)('products/popular'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __param(2, (0, common_1.Headers)('zoneId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], BrowseController.prototype, "productsPopular", null);
__decorate([
    (0, common_1.Get)('products/recommended'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __param(2, (0, common_1.Headers)('zoneId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], BrowseController.prototype, "productsRecommended", null);
__decorate([
    (0, common_1.Get)('products/most-reviewed'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __param(2, (0, common_1.Headers)('zoneId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], BrowseController.prototype, "productsMostReviewed", null);
__decorate([
    (0, common_1.Get)('products/details/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BrowseController.prototype, "productDetails", null);
__decorate([
    (0, common_1.Get)('categories/products/:categoryId'),
    __param(0, (0, common_1.Param)('categoryId')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], BrowseController.prototype, "categoryProducts", null);
__decorate([
    (0, common_1.Get)('categories/restaurants/:categoryId'),
    __param(0, (0, common_1.Param)('categoryId')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], BrowseController.prototype, "categoryRestaurants", null);
exports.BrowseController = BrowseController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [browse_service_1.BrowseService])
], BrowseController);
//# sourceMappingURL=browse.controller.js.map