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
exports.OrderLifecycleController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const order_lifecycle_service_1 = require("./order-lifecycle.service");
let OrderLifecycleController = class OrderLifecycleController {
    lifecycle;
    constructor(lifecycle) {
        this.lifecycle = lifecycle;
    }
    async runJobs() {
        const [autoCancel, refunds] = await Promise.all([
            this.lifecycle.autoCancelStalePending(),
            this.lifecycle.processPendingRefunds(),
        ]);
        return { ok: true, auto_cancelled: autoCancel.cancelled, refunds_processed: refunds.processed };
    }
    async cron(key) {
        const secret = process.env.LIFECYCLE_CRON_SECRET;
        if (!secret || key !== secret) {
            throw new common_1.ForbiddenException({ errors: [{ code: 'cron', message: 'invalid key' }] });
        }
        const [autoCancel, refunds] = await Promise.all([
            this.lifecycle.autoCancelStalePending(),
            this.lifecycle.processPendingRefunds(),
        ]);
        return { ok: true, auto_cancelled: autoCancel.cancelled, refunds_processed: refunds.processed };
    }
};
exports.OrderLifecycleController = OrderLifecycleController;
__decorate([
    (0, common_1.Post)('admin/lifecycle/run-jobs'),
    (0, auth_guard_1.RequireAuth)('admin'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OrderLifecycleController.prototype, "runJobs", null);
__decorate([
    (0, common_1.Get)('cron/order-jobs'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Query)('key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OrderLifecycleController.prototype, "cron", null);
exports.OrderLifecycleController = OrderLifecycleController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [order_lifecycle_service_1.OrderLifecycleService])
], OrderLifecycleController);
//# sourceMappingURL=order-lifecycle.controller.js.map