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
exports.EnhancementsController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const enhancements_service_1 = require("./enhancements.service");
const dm_charges_service_1 = require("./dm-charges.service");
const user_delivery_charges_service_1 = require("./user-delivery-charges.service");
let EnhancementsController = class EnhancementsController {
    svc;
    dm;
    user;
    constructor(svc, dm, user) {
        this.svc = svc;
        this.dm = dm;
        this.user = user;
    }
    slabs(vid) {
        return this.svc.listSlabs(vid ? parseInt(vid, 10) : undefined);
    }
    createSlab(body) {
        return this.svc.createSlab(body);
    }
    toggleSlab(id, body) {
        return this.svc.toggleSlabStatus(id, body.status);
    }
    deleteSlab(id) {
        return this.svc.deleteSlab(id);
    }
    taxes() {
        return this.svc.listTaxes();
    }
    createTax(body) {
        return this.svc.createTax(body);
    }
    updateTax(id, body) {
        return this.svc.updateTaxRate(id, body);
    }
    deleteTax(id) {
        return this.svc.deleteTax(id);
    }
    calculate(body) {
        return this.svc.calculateOrderCharges(body);
    }
    listAdditionalCharges() { return this.svc.listAdditionalCharges(); }
    createAdditionalCharge(body) {
        return this.svc.createAdditionalCharge(body);
    }
    updateAdditionalCharge(id, body) {
        return this.svc.updateAdditionalCharge(id, body);
    }
    deleteAdditionalCharge(id) {
        return this.svc.deleteAdditionalCharge(id);
    }
    invoices(l, o) {
        return this.svc.listInvoices(parseInt(l ?? '50', 10), parseInt(o ?? '0', 10));
    }
    invoice(id) {
        return this.svc.getInvoice(id);
    }
    tds(vid, rate, threshold) {
        return this.svc.tdsReport({
            vendor_id: vid ? parseInt(vid, 10) : undefined,
            rate: rate ? parseFloat(rate) : undefined,
            threshold: threshold ? parseFloat(threshold) : undefined,
        });
    }
    tdsSettings() { return this.svc.getTdsSettings(); }
    updateTdsSettings(body) {
        return this.svc.updateTdsSettings(body);
    }
    dmSlabs() { return this.dm.listSlabs(); }
    dmCreateSlab(body) { return this.dm.createSlab(body); }
    dmUpdateSlab(id, body) { return this.dm.updateSlab(id, body); }
    dmDeleteSlab(id) { return this.dm.deleteSlab(id); }
    dmSurcharges() { return this.dm.listSurcharges(); }
    dmCreateSurcharge(body) { return this.dm.createSurcharge(body); }
    dmUpdateSurcharge(id, body) { return this.dm.updateSurcharge(id, body); }
    dmDeleteSurcharge(id) { return this.dm.deleteSurcharge(id); }
    dmCalculate(body) { return this.dm.calculate(body); }
    userSlabs() { return this.user.listSlabs(); }
    userCreateSlab(body) { return this.user.createSlab(body); }
    userUpdateSlab(id, body) { return this.user.updateSlab(id, body); }
    userDeleteSlab(id) { return this.user.deleteSlab(id); }
    userSurcharges() { return this.user.listSurcharges(); }
    userCreateSurcharge(body) { return this.user.createSurcharge(body); }
    userUpdateSurcharge(id, body) { return this.user.updateSurcharge(id, body); }
    userDeleteSurcharge(id) { return this.user.deleteSurcharge(id); }
    userFreeDelivery() { return this.user.getFreeDelivery(); }
    userUpdateFreeDelivery(body) { return this.user.updateFreeDelivery(body); }
    userSurgeGrid() { return this.user.getSurgeGrid(); }
    userUpdateSurgeCell(body) { return this.user.updateSurgeCell(body); }
    userCalculate(body) { return this.user.calculate(body); }
};
exports.EnhancementsController = EnhancementsController;
__decorate([
    (0, common_1.Get)('business-plans/slabs'),
    __param(0, (0, common_1.Query)('vendor_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "slabs", null);
__decorate([
    (0, common_1.Post)('business-plans/slabs'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "createSlab", null);
__decorate([
    (0, common_1.Patch)('business-plans/slabs/:id/status'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "toggleSlab", null);
__decorate([
    (0, common_1.Delete)('business-plans/slabs/:id'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "deleteSlab", null);
__decorate([
    (0, common_1.Get)('tax-engine/master'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "taxes", null);
__decorate([
    (0, common_1.Post)('tax-engine/master'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "createTax", null);
__decorate([
    (0, common_1.Patch)('tax-engine/master/:id'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "updateTax", null);
__decorate([
    (0, common_1.Delete)('tax-engine/master/:id'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "deleteTax", null);
__decorate([
    (0, common_1.Post)('tax-engine/calculate'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "calculate", null);
__decorate([
    (0, common_1.Get)('additional-charges'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "listAdditionalCharges", null);
__decorate([
    (0, common_1.Post)('additional-charges'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "createAdditionalCharge", null);
__decorate([
    (0, common_1.Patch)('additional-charges/:id'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "updateAdditionalCharge", null);
__decorate([
    (0, common_1.Delete)('additional-charges/:id'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "deleteAdditionalCharge", null);
__decorate([
    (0, common_1.Get)('invoices'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "invoices", null);
__decorate([
    (0, common_1.Get)('invoices/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "invoice", null);
__decorate([
    (0, common_1.Get)('tds/report'),
    __param(0, (0, common_1.Query)('vendor_id')),
    __param(1, (0, common_1.Query)('rate')),
    __param(2, (0, common_1.Query)('threshold')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "tds", null);
__decorate([
    (0, common_1.Get)('tds/settings'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "tdsSettings", null);
__decorate([
    (0, common_1.Patch)('tds/settings'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "updateTdsSettings", null);
__decorate([
    (0, common_1.Get)('dm-charges/slabs'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "dmSlabs", null);
__decorate([
    (0, common_1.Post)('dm-charges/slabs'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "dmCreateSlab", null);
__decorate([
    (0, common_1.Patch)('dm-charges/slabs/:id'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "dmUpdateSlab", null);
__decorate([
    (0, common_1.Delete)('dm-charges/slabs/:id'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "dmDeleteSlab", null);
__decorate([
    (0, common_1.Get)('dm-charges/surcharges'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "dmSurcharges", null);
__decorate([
    (0, common_1.Post)('dm-charges/surcharges'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "dmCreateSurcharge", null);
__decorate([
    (0, common_1.Patch)('dm-charges/surcharges/:id'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "dmUpdateSurcharge", null);
__decorate([
    (0, common_1.Delete)('dm-charges/surcharges/:id'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "dmDeleteSurcharge", null);
__decorate([
    (0, common_1.Post)('dm-charges/calculate'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "dmCalculate", null);
__decorate([
    (0, common_1.Get)('user-delivery-charges/slabs'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "userSlabs", null);
__decorate([
    (0, common_1.Post)('user-delivery-charges/slabs'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "userCreateSlab", null);
__decorate([
    (0, common_1.Patch)('user-delivery-charges/slabs/:id'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "userUpdateSlab", null);
__decorate([
    (0, common_1.Delete)('user-delivery-charges/slabs/:id'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "userDeleteSlab", null);
__decorate([
    (0, common_1.Get)('user-delivery-charges/surcharges'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "userSurcharges", null);
__decorate([
    (0, common_1.Post)('user-delivery-charges/surcharges'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "userCreateSurcharge", null);
__decorate([
    (0, common_1.Patch)('user-delivery-charges/surcharges/:id'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "userUpdateSurcharge", null);
__decorate([
    (0, common_1.Delete)('user-delivery-charges/surcharges/:id'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "userDeleteSurcharge", null);
__decorate([
    (0, common_1.Get)('user-delivery-charges/free-delivery'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "userFreeDelivery", null);
__decorate([
    (0, common_1.Patch)('user-delivery-charges/free-delivery'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "userUpdateFreeDelivery", null);
__decorate([
    (0, common_1.Get)('user-delivery-charges/surge-grid'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "userSurgeGrid", null);
__decorate([
    (0, common_1.Patch)('user-delivery-charges/surge-grid'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "userUpdateSurgeCell", null);
__decorate([
    (0, common_1.Post)('user-delivery-charges/calculate'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EnhancementsController.prototype, "userCalculate", null);
exports.EnhancementsController = EnhancementsController = __decorate([
    (0, common_1.Controller)('admin'),
    (0, auth_guard_1.RequireAuth)('admin'),
    __metadata("design:paramtypes", [enhancements_service_1.EnhancementsService,
        dm_charges_service_1.DmChargesService,
        user_delivery_charges_service_1.UserDeliveryChargesService])
], EnhancementsController);
//# sourceMappingURL=enhancements.controller.js.map