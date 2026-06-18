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
exports.OrderAutoCancelCron = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const order_lifecycle_service_1 = require("./order-lifecycle.service");
let OrderAutoCancelCron = class OrderAutoCancelCron {
    lifecycle;
    logger = new common_1.Logger('OrderAutoCancelCron');
    running = false;
    constructor(lifecycle) {
        this.lifecycle = lifecycle;
    }
    async run() {
        if (this.running)
            return;
        this.running = true;
        try {
            await this.lifecycle.autoCancelStalePending();
        }
        catch (e) {
            this.logger.error('auto-cancel sweep failed', e instanceof Error ? e.stack : String(e));
        }
        finally {
            this.running = false;
        }
    }
};
exports.OrderAutoCancelCron = OrderAutoCancelCron;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_MINUTE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OrderAutoCancelCron.prototype, "run", null);
exports.OrderAutoCancelCron = OrderAutoCancelCron = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [order_lifecycle_service_1.OrderLifecycleService])
], OrderAutoCancelCron);
//# sourceMappingURL=order-autocancel.cron.js.map