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
exports.RefundController = void 0;
const common_1 = require("@nestjs/common");
const refund_service_1 = require("./refund.service");
let RefundController = class RefundController {
    svc;
    constructor(svc) {
        this.svc = svc;
    }
    catalogue() {
        return this.svc.catalogue();
    }
    ledger(limit, offset, actorType) {
        return this.svc.ledger(toInt(limit, 100), toInt(offset, 0), actorType);
    }
    applicable(orderId) {
        return this.svc.applicable(orderId);
    }
    preview(orderId, scenario) {
        return this.svc.preview(orderId, scenario);
    }
    apply(orderId, body) {
        return this.svc.apply(orderId, body.scenario, body.remarks);
    }
    history(orderId) {
        return this.svc.historyFor(orderId);
    }
};
exports.RefundController = RefundController;
__decorate([
    (0, common_1.Get)('catalogue'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], RefundController.prototype, "catalogue", null);
__decorate([
    (0, common_1.Get)('ledger'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __param(2, (0, common_1.Query)('actor_type')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], RefundController.prototype, "ledger", null);
__decorate([
    (0, common_1.Get)(':orderId/applicable'),
    __param(0, (0, common_1.Param)('orderId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], RefundController.prototype, "applicable", null);
__decorate([
    (0, common_1.Get)(':orderId/preview'),
    __param(0, (0, common_1.Param)('orderId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('scenario')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", void 0)
], RefundController.prototype, "preview", null);
__decorate([
    (0, common_1.Post)(':orderId/apply'),
    __param(0, (0, common_1.Param)('orderId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], RefundController.prototype, "apply", null);
__decorate([
    (0, common_1.Get)(':orderId/history'),
    __param(0, (0, common_1.Param)('orderId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], RefundController.prototype, "history", null);
exports.RefundController = RefundController = __decorate([
    (0, common_1.Controller)('admin/refund-engine'),
    __metadata("design:paramtypes", [refund_service_1.RefundService])
], RefundController);
function toInt(v, def) {
    if (v === undefined)
        return def;
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : def;
}
//# sourceMappingURL=refund.controller.js.map