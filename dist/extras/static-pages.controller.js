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
exports.StaticPagesController = void 0;
const common_1 = require("@nestjs/common");
const business_settings_service_1 = require("../business-settings/business-settings.service");
let StaticPagesController = class StaticPagesController {
    bs;
    constructor(bs) {
        this.bs = bs;
    }
    async page(key) {
        const value = await this.bs.get(key);
        return { value: value ?? null };
    }
    terms() { return this.page('terms_and_conditions'); }
    privacy() { return this.page('privacy_policy'); }
    about() { return this.page('about_us'); }
    refund() { return this.page('refund_policy'); }
    cancellation() { return this.page('cancellation_policy'); }
    shipping() { return this.page('shipping_policy'); }
};
exports.StaticPagesController = StaticPagesController;
__decorate([
    (0, common_1.Get)('terms-and-conditions'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StaticPagesController.prototype, "terms", null);
__decorate([
    (0, common_1.Get)('privacy-policy'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StaticPagesController.prototype, "privacy", null);
__decorate([
    (0, common_1.Get)('about-us'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StaticPagesController.prototype, "about", null);
__decorate([
    (0, common_1.Get)('refund-policy'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StaticPagesController.prototype, "refund", null);
__decorate([
    (0, common_1.Get)('cancellation-policy'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StaticPagesController.prototype, "cancellation", null);
__decorate([
    (0, common_1.Get)('shipping-policy'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StaticPagesController.prototype, "shipping", null);
exports.StaticPagesController = StaticPagesController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [business_settings_service_1.BusinessSettingsService])
], StaticPagesController);
//# sourceMappingURL=static-pages.controller.js.map