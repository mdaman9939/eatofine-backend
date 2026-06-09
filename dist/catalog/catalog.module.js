"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const catalog_controller_1 = require("./catalog.controller");
const catalog_service_1 = require("./catalog.service");
const catalog_mongo_service_1 = require("./catalog-mongo.service");
const catalog_router_service_1 = require("./catalog-router.service");
const category_schema_1 = require("../mongo/schemas/category.schema");
const cuisine_schema_1 = require("../mongo/schemas/cuisine.schema");
const banner_schema_1 = require("../mongo/schemas/banner.schema");
const migration_module_1 = require("../mongo/migration.module");
let CatalogModule = class CatalogModule {
};
exports.CatalogModule = CatalogModule;
exports.CatalogModule = CatalogModule = __decorate([
    (0, common_1.Module)({
        imports: [
            migration_module_1.MigrationModule,
            mongoose_1.MongooseModule.forFeature([
                { name: category_schema_1.Category.name, schema: category_schema_1.CategorySchema },
                { name: cuisine_schema_1.Cuisine.name, schema: cuisine_schema_1.CuisineSchema },
                { name: banner_schema_1.Banner.name, schema: banner_schema_1.BannerSchema },
            ]),
        ],
        controllers: [catalog_controller_1.CatalogController],
        providers: [catalog_service_1.CatalogService, catalog_mongo_service_1.CatalogMongoService, catalog_router_service_1.CatalogRouterService],
    })
], CatalogModule);
//# sourceMappingURL=catalog.module.js.map