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
exports.MigrationController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const migration_service_1 = require("./migration.service");
const generic_migration_service_1 = require("./generic-migration.service");
const seed_service_1 = require("./seed.service");
let MigrationController = class MigrationController {
    svc;
    generic;
    seed;
    constructor(svc, generic, seed) {
        this.svc = svc;
        this.generic = generic;
        this.seed = seed;
    }
    seedDemo() {
        return this.seed.seedAll();
    }
    topUpOrders(body = {}) {
        return this.seed.topUpOrders(body.count ?? 60);
    }
    seedPolicyPages() { return this.seed.seedPolicyPages(); }
    seedConversations() { return this.seed.seedConversations(); }
    seedSubscriptionOrders() { return this.seed.seedSubscriptionOrders(); }
    async seedCustomerAppFixes() {
        const policies = await this.seed.seedPolicyPages();
        const conversations = await this.seed.seedConversations();
        const subscriptions = await this.seed.seedSubscriptionOrders();
        return { policies, conversations, subscriptions };
    }
    counts() {
        return this.svc.counts();
    }
    migrateAll() {
        return this.svc.runAll();
    }
    migrateUsers() {
        return this.svc.migrateUsers();
    }
    migrateVendors() {
        return this.svc.migrateVendors();
    }
    migrateDeliveryMen() {
        return this.svc.migrateDeliveryMen();
    }
    migrateRestaurants() {
        return this.svc.migrateRestaurants();
    }
    migrateFoods() {
        return this.svc.migrateFoods();
    }
    migrateOrders() {
        return this.svc.migrateOrders();
    }
    migrateCategories() {
        return this.svc.migrateCategories();
    }
    migrateCuisines() {
        return this.svc.migrateCuisines();
    }
    migrateBanners() {
        return this.svc.migrateBanners();
    }
    migrateAllTables(body = {}) {
        return this.generic.migrateAllTables({
            includeTyped: !!body.include_typed,
            includeSystem: !!body.include_system,
        });
    }
    migrateOneTable(table) {
        return this.generic.migrateTable(table);
    }
    listMysqlTables() {
        return this.generic.listMysqlTables();
    }
    listMongoCollections() {
        return this.generic.listMongoCollections();
    }
    dropCollection(name) {
        return this.generic.dropCollection(name);
    }
};
exports.MigrationController = MigrationController;
__decorate([
    (0, common_1.Post)('seed-demo'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MigrationController.prototype, "seedDemo", null);
__decorate([
    (0, common_1.Post)('top-up-orders'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MigrationController.prototype, "topUpOrders", null);
__decorate([
    (0, common_1.Post)('seed-policy-pages'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MigrationController.prototype, "seedPolicyPages", null);
__decorate([
    (0, common_1.Post)('seed-conversations'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MigrationController.prototype, "seedConversations", null);
__decorate([
    (0, common_1.Post)('seed-subscription-orders'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MigrationController.prototype, "seedSubscriptionOrders", null);
__decorate([
    (0, common_1.Post)('seed-customer-app-fixes'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MigrationController.prototype, "seedCustomerAppFixes", null);
__decorate([
    (0, common_1.Get)('counts'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MigrationController.prototype, "counts", null);
__decorate([
    (0, common_1.Post)('migrate-all'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MigrationController.prototype, "migrateAll", null);
__decorate([
    (0, common_1.Post)('migrate-users'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MigrationController.prototype, "migrateUsers", null);
__decorate([
    (0, common_1.Post)('migrate-vendors'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MigrationController.prototype, "migrateVendors", null);
__decorate([
    (0, common_1.Post)('migrate-delivery-men'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MigrationController.prototype, "migrateDeliveryMen", null);
__decorate([
    (0, common_1.Post)('migrate-restaurants'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MigrationController.prototype, "migrateRestaurants", null);
__decorate([
    (0, common_1.Post)('migrate-foods'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MigrationController.prototype, "migrateFoods", null);
__decorate([
    (0, common_1.Post)('migrate-orders'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MigrationController.prototype, "migrateOrders", null);
__decorate([
    (0, common_1.Post)('migrate-categories'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MigrationController.prototype, "migrateCategories", null);
__decorate([
    (0, common_1.Post)('migrate-cuisines'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MigrationController.prototype, "migrateCuisines", null);
__decorate([
    (0, common_1.Post)('migrate-banners'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MigrationController.prototype, "migrateBanners", null);
__decorate([
    (0, common_1.Post)('migrate-all-tables'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MigrationController.prototype, "migrateAllTables", null);
__decorate([
    (0, common_1.Post)('migrate-table/:table'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('table')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MigrationController.prototype, "migrateOneTable", null);
__decorate([
    (0, common_1.Get)('mysql-tables'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MigrationController.prototype, "listMysqlTables", null);
__decorate([
    (0, common_1.Get)('mongo-collections'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MigrationController.prototype, "listMongoCollections", null);
__decorate([
    (0, common_1.Delete)('collection/:name'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('name')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MigrationController.prototype, "dropCollection", null);
exports.MigrationController = MigrationController = __decorate([
    (0, common_1.Controller)('admin/mongo'),
    (0, auth_guard_1.RequireAuth)('admin'),
    __metadata("design:paramtypes", [migration_service_1.MigrationService,
        generic_migration_service_1.GenericMigrationService,
        seed_service_1.SeedService])
], MigrationController);
//# sourceMappingURL=migration.controller.js.map