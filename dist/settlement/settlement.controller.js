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
exports.SettlementController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const settlement_service_1 = require("./settlement.service");
let SettlementController = class SettlementController {
    settlement;
    constructor(settlement) {
        this.settlement = settlement;
    }
    list(limit, offset) {
        return this.settlement.listSettlements(parseInt(limit ?? '50', 10) || 50, parseInt(offset ?? '0', 10) || 0);
    }
    get(orderId) {
        return this.settlement.getSettlement(orderId);
    }
    run(orderId) {
        return this.settlement.settleOrder(orderId);
    }
    withdraw(body) {
        return this.settlement.requestWithdrawal(body);
    }
};
exports.SettlementController = SettlementController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SettlementController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':orderId'),
    __param(0, (0, common_1.Param)('orderId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], SettlementController.prototype, "get", null);
__decorate([
    (0, common_1.Post)(':orderId/run'),
    __param(0, (0, common_1.Param)('orderId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], SettlementController.prototype, "run", null);
__decorate([
    (0, common_1.Post)('withdrawals'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SettlementController.prototype, "withdraw", null);
exports.SettlementController = SettlementController = __decorate([
    (0, common_1.Controller)('admin/settlements'),
    (0, auth_guard_1.RequireAuth)('admin'),
    __metadata("design:paramtypes", [settlement_service_1.SettlementService])
], SettlementController);
//# sourceMappingURL=settlement.controller.js.map