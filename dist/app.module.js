"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const prisma_module_1 = require("./prisma/prisma.module");
const business_settings_module_1 = require("./business-settings/business-settings.module");
const config_module_1 = require("./config/config.module");
const auth_module_1 = require("./auth/auth.module");
const auth_guard_1 = require("./auth/auth.guard");
const catalog_module_1 = require("./catalog/catalog.module");
const browse_module_1 = require("./browse/browse.module");
const customer_module_1 = require("./customer/customer.module");
const order_module_1 = require("./order/order.module");
const ops_module_1 = require("./ops/ops.module");
const admin_module_1 = require("./admin/admin.module");
const extras_module_1 = require("./extras/extras.module");
const enhancements_module_1 = require("./enhancements/enhancements.module");
const documents_module_1 = require("./documents/documents.module");
const completion_module_1 = require("./completion/completion.module");
const mongo_module_1 = require("./mongo/mongo.module");
const migration_module_1 = require("./mongo/migration.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            prisma_module_1.PrismaModule,
            business_settings_module_1.BusinessSettingsModule,
            auth_module_1.AuthModule,
            config_module_1.ConfigModule,
            catalog_module_1.CatalogModule,
            browse_module_1.BrowseModule,
            customer_module_1.CustomerModule,
            order_module_1.OrderModule,
            ops_module_1.OpsModule,
            admin_module_1.AdminModule,
            extras_module_1.ExtrasModule,
            enhancements_module_1.EnhancementsModule,
            documents_module_1.DocumentsModule,
            completion_module_1.CompletionModule,
            mongo_module_1.MongoModule,
            migration_module_1.MigrationModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService, { provide: core_1.APP_GUARD, useClass: auth_guard_1.AuthGuard }],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map