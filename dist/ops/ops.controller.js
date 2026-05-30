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
exports.OpsController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const ops_service_1 = require("./ops.service");
let OpsController = class OpsController {
    ops;
    constructor(ops) {
        this.ops = ops;
    }
    vendorOrders(req, status) {
        return this.ops.vendorOrders(req.actor.id, status);
    }
    vendorAllOrders(req, status) {
        return this.ops.vendorOrders(req.actor.id, status);
    }
    vendorOrderDetail(req, orderId) {
        return this.ops.vendorOrderDetail(req.actor.id, orderId);
    }
    vendorUpdateStatus(req, body) {
        return this.ops.vendorUpdateStatus(req.actor.id, body.order_id ?? 0, body.order_status ?? '');
    }
    vendorAssignDM(req, body) {
        return this.ops.vendorAssignDeliveryMan(req.actor.id, body.order_id ?? 0, body.delivery_man_id ?? 0);
    }
    vendorAllDMs(req) {
        return this.ops.vendorAllDeliveryMen(req.actor.id);
    }
    dmCurrent(req) {
        return this.ops.dmCurrentOrders(req.actor.id);
    }
    dmLatest(req) {
        return this.ops.dmLatestOrders(req.actor.id);
    }
    dmDetail(req, orderId) {
        return this.ops.dmOrderDetail(req.actor.id, orderId);
    }
    dmUpdate(req, body) {
        return this.ops.dmUpdateStatus(req.actor.id, body.order_id ?? 0, body.order_status ?? '');
    }
};
exports.OpsController = OpsController;
__decorate([
    (0, common_1.Get)('vendor/orders/:status'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, auth_guard_1.RequireAuth)('vendor'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OpsController.prototype, "vendorOrders", null);
__decorate([
    (0, common_1.Get)('vendor/all-orders'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, auth_guard_1.RequireAuth)('vendor'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OpsController.prototype, "vendorAllOrders", null);
__decorate([
    (0, common_1.Get)('vendor/order-details/:orderId'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, auth_guard_1.RequireAuth)('vendor'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('orderId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", void 0)
], OpsController.prototype, "vendorOrderDetail", null);
__decorate([
    (0, common_1.Post)('vendor/update-order-status'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, auth_guard_1.RequireAuth)('vendor'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], OpsController.prototype, "vendorUpdateStatus", null);
__decorate([
    (0, common_1.Post)('vendor/order/assign-delivery-man'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, auth_guard_1.RequireAuth)('vendor'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], OpsController.prototype, "vendorAssignDM", null);
__decorate([
    (0, common_1.Get)('vendor/all-deliveryman'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, auth_guard_1.RequireAuth)('vendor'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OpsController.prototype, "vendorAllDMs", null);
__decorate([
    (0, common_1.Get)('delivery-man/current-orders'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, auth_guard_1.RequireAuth)('deliveryman'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OpsController.prototype, "dmCurrent", null);
__decorate([
    (0, common_1.Get)('delivery-man/latest-orders'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, auth_guard_1.RequireAuth)('deliveryman'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OpsController.prototype, "dmLatest", null);
__decorate([
    (0, common_1.Get)('delivery-man/order-details/:orderId'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, auth_guard_1.RequireAuth)('deliveryman'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('orderId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", void 0)
], OpsController.prototype, "dmDetail", null);
__decorate([
    (0, common_1.Post)('delivery-man/update-order-status'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, auth_guard_1.RequireAuth)('deliveryman'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], OpsController.prototype, "dmUpdate", null);
exports.OpsController = OpsController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [ops_service_1.OpsService])
], OpsController);
//# sourceMappingURL=ops.controller.js.map