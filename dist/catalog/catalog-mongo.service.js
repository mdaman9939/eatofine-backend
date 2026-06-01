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
exports.CatalogMongoService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const category_schema_1 = require("../mongo/schemas/category.schema");
const cuisine_schema_1 = require("../mongo/schemas/cuisine.schema");
const banner_schema_1 = require("../mongo/schemas/banner.schema");
let CatalogMongoService = class CatalogMongoService {
    categoryModel;
    cuisineModel;
    bannerModel;
    constructor(categoryModel, cuisineModel, bannerModel) {
        this.categoryModel = categoryModel;
        this.cuisineModel = cuisineModel;
        this.bannerModel = bannerModel;
    }
    storageBase() {
        return process.env.STORAGE_BASE_URL ?? 'http://127.0.0.1:3000/storage';
    }
    fullUrl(folder, file) {
        return file ? `${this.storageBase()}/${folder}/${file}` : null;
    }
    async listCategories() {
        const cats = await this.categoryModel
            .find({ status: true, position: 0 })
            .lean();
        const ids = cats.map((c) => c.mysql_id).filter((x) => x !== undefined);
        const childCounts = await this.categoryModel.aggregate([
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
    async listChildCategories(parentId) {
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
};
exports.CatalogMongoService = CatalogMongoService;
exports.CatalogMongoService = CatalogMongoService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(category_schema_1.Category.name)),
    __param(1, (0, mongoose_1.InjectModel)(cuisine_schema_1.Cuisine.name)),
    __param(2, (0, mongoose_1.InjectModel)(banner_schema_1.Banner.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], CatalogMongoService);
//# sourceMappingURL=catalog-mongo.service.js.map