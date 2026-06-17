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
exports.InvoiceCronService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const completion_service_1 = require("./completion.service");
let InvoiceCronService = class InvoiceCronService {
    completion;
    logger = new common_1.Logger('InvoiceCron');
    constructor(completion) {
        this.completion = completion;
    }
    async runMonthly() {
        try {
            const res = (await this.completion.generateMonthlyInvoices());
            this.logger.log(`Monthly vendor invoices generated: ${res?.created ?? 0} (period ${res?.period?.start} → ${res?.period?.end})`);
        }
        catch (e) {
            this.logger.error('Monthly vendor-invoice generation failed', e instanceof Error ? e.stack : String(e));
        }
    }
};
exports.InvoiceCronService = InvoiceCronService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], InvoiceCronService.prototype, "runMonthly", null);
exports.InvoiceCronService = InvoiceCronService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [completion_service_1.CompletionService])
], InvoiceCronService);
//# sourceMappingURL=invoice-cron.service.js.map