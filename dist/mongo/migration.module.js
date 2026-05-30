"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const migration_controller_1 = require("./migration.controller");
const migration_service_1 = require("./migration.service");
const generic_migration_service_1 = require("./generic-migration.service");
const mongo_data_service_1 = require("./mongo-data.service");
const user_schema_1 = require("./schemas/user.schema");
const vendor_schema_1 = require("./schemas/vendor.schema");
const restaurant_schema_1 = require("./schemas/restaurant.schema");
const food_schema_1 = require("./schemas/food.schema");
const delivery_man_schema_1 = require("./schemas/delivery-man.schema");
const order_schema_1 = require("./schemas/order.schema");
const category_schema_1 = require("./schemas/category.schema");
const cuisine_schema_1 = require("./schemas/cuisine.schema");
const banner_schema_1 = require("./schemas/banner.schema");
let MigrationModule = class MigrationModule {
};
exports.MigrationModule = MigrationModule;
exports.MigrationModule = MigrationModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: user_schema_1.User.name, schema: user_schema_1.UserSchema },
                { name: vendor_schema_1.Vendor.name, schema: vendor_schema_1.VendorSchema },
                { name: restaurant_schema_1.Restaurant.name, schema: restaurant_schema_1.RestaurantSchema },
                { name: food_schema_1.Food.name, schema: food_schema_1.FoodSchema },
                { name: delivery_man_schema_1.DeliveryMan.name, schema: delivery_man_schema_1.DeliveryManSchema },
                { name: order_schema_1.Order.name, schema: order_schema_1.OrderSchema },
                { name: category_schema_1.Category.name, schema: category_schema_1.CategorySchema },
                { name: cuisine_schema_1.Cuisine.name, schema: cuisine_schema_1.CuisineSchema },
                { name: banner_schema_1.Banner.name, schema: banner_schema_1.BannerSchema },
            ]),
        ],
        controllers: [migration_controller_1.MigrationController],
        providers: [migration_service_1.MigrationService, generic_migration_service_1.GenericMigrationService, mongo_data_service_1.MongoDataService],
        exports: [mongoose_1.MongooseModule, migration_service_1.MigrationService, generic_migration_service_1.GenericMigrationService, mongo_data_service_1.MongoDataService],
    })
], MigrationModule);
//# sourceMappingURL=migration.module.js.map