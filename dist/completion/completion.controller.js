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
exports.CompletionController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const completion_service_1 = require("./completion.service");
let CompletionController = class CompletionController {
    svc;
    constructor(svc) {
        this.svc = svc;
    }
    listInvoices(vendorId, status, limit) {
        return this.svc.listInvoices({
            vendorId: vendorId ? parseInt(vendorId, 10) : undefined,
            status,
            limit: limit ? parseInt(limit, 10) : undefined,
        });
    }
    invoiceStats() { return this.svc.getInvoiceStats(); }
    generateInvoices(body) {
        return this.svc.generateMonthlyInvoices(body.period_start, body.period_end);
    }
    markPaid(id) { return this.svc.markInvoicePaid(id); }
    cancelInvoice(id, body) {
        return this.svc.cancelInvoice(id, body.notes);
    }
    listCreditNotes(status, limit) {
        return this.svc.listCreditNotes({ status, limit: limit ? parseInt(limit, 10) : undefined });
    }
    cnStats() { return this.svc.getCreditNoteStats(); }
    createCreditNote(req, body) {
        return this.svc.createCreditNote({ ...body, issued_by: Number(req.actor?.id ?? 0) });
    }
    listSettings(category) {
        return this.svc.listSettings(category);
    }
    updateSetting(req, key, body) {
        return this.svc.updateSetting(key, body.value, Number(req.actor?.id ?? 0));
    }
    listFlags(status, subjectType, limit) {
        return this.svc.listFraudFlags({ status, subjectType, limit: limit ? parseInt(limit, 10) : undefined });
    }
    flagStats() { return this.svc.getFraudStats(); }
    createFlag(req, body) {
        return this.svc.createFraudFlag({ ...body, flagged_by: Number(req.actor?.id ?? 0) });
    }
    resolveFlag(req, id, body) {
        return this.svc.resolveFraudFlag(id, body.status, body.notes, Number(req.actor?.id ?? 0));
    }
    listPromos(status, vendorId, limit) {
        return this.svc.listVendorPromos({
            status,
            vendorId: vendorId ? parseInt(vendorId, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
        });
    }
    promoStats() { return this.svc.getPromoStats(); }
    approvePromo(req, id, body) {
        return this.svc.approvePromo(id, Number(req.actor?.id ?? 0), body.remarks);
    }
    rejectPromo(req, id, body) {
        return this.svc.rejectPromo(id, Number(req.actor?.id ?? 0), body.remarks);
    }
    pausePromo(id, body) {
        return this.svc.pausePromo(id, body.paused);
    }
};
exports.CompletionController = CompletionController;
__decorate([
    (0, common_1.Get)('vendor-invoices'),
    __param(0, (0, common_1.Query)('vendor_id')),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], CompletionController.prototype, "listInvoices", null);
__decorate([
    (0, common_1.Get)('vendor-invoices/stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CompletionController.prototype, "invoiceStats", null);
__decorate([
    (0, common_1.Post)('vendor-invoices/generate'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CompletionController.prototype, "generateInvoices", null);
__decorate([
    (0, common_1.Patch)('vendor-invoices/:id/paid'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], CompletionController.prototype, "markPaid", null);
__decorate([
    (0, common_1.Patch)('vendor-invoices/:id/cancel'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], CompletionController.prototype, "cancelInvoice", null);
__decorate([
    (0, common_1.Get)('credit-notes'),
    __param(0, (0, common_1.Query)('status')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], CompletionController.prototype, "listCreditNotes", null);
__decorate([
    (0, common_1.Get)('credit-notes/stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CompletionController.prototype, "cnStats", null);
__decorate([
    (0, common_1.Post)('credit-notes'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CompletionController.prototype, "createCreditNote", null);
__decorate([
    (0, common_1.Get)('platform-settings'),
    __param(0, (0, common_1.Query)('category')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CompletionController.prototype, "listSettings", null);
__decorate([
    (0, common_1.Patch)('platform-settings/:key'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('key')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], CompletionController.prototype, "updateSetting", null);
__decorate([
    (0, common_1.Get)('fraud-flags'),
    __param(0, (0, common_1.Query)('status')),
    __param(1, (0, common_1.Query)('subject_type')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], CompletionController.prototype, "listFlags", null);
__decorate([
    (0, common_1.Get)('fraud-flags/stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CompletionController.prototype, "flagStats", null);
__decorate([
    (0, common_1.Post)('fraud-flags'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CompletionController.prototype, "createFlag", null);
__decorate([
    (0, common_1.Patch)('fraud-flags/:id/resolve'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Object]),
    __metadata("design:returntype", void 0)
], CompletionController.prototype, "resolveFlag", null);
__decorate([
    (0, common_1.Get)('vendor-promotions'),
    __param(0, (0, common_1.Query)('status')),
    __param(1, (0, common_1.Query)('vendor_id')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], CompletionController.prototype, "listPromos", null);
__decorate([
    (0, common_1.Get)('vendor-promotions/stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CompletionController.prototype, "promoStats", null);
__decorate([
    (0, common_1.Patch)('vendor-promotions/:id/approve'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Object]),
    __metadata("design:returntype", void 0)
], CompletionController.prototype, "approvePromo", null);
__decorate([
    (0, common_1.Patch)('vendor-promotions/:id/reject'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Object]),
    __metadata("design:returntype", void 0)
], CompletionController.prototype, "rejectPromo", null);
__decorate([
    (0, common_1.Patch)('vendor-promotions/:id/pause'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], CompletionController.prototype, "pausePromo", null);
exports.CompletionController = CompletionController = __decorate([
    (0, common_1.Controller)('admin'),
    (0, auth_guard_1.RequireAuth)('admin'),
    __metadata("design:paramtypes", [completion_service_1.CompletionService])
], CompletionController);
//# sourceMappingURL=completion.controller.js.map