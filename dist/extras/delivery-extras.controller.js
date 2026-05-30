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
exports.DeliveryExtrasController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const prisma_service_1 = require("../prisma/prisma.service");
let DeliveryExtrasController = class DeliveryExtrasController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async profile(req) {
        const d = await this.prisma.delivery_men.findUnique({ where: { id: req.actor.id } });
        if (!d)
            return {};
        return {
            id: Number(d.id),
            f_name: d.f_name,
            l_name: d.l_name,
            email: d.email,
            phone: d.phone,
            image: d.image,
            status: d.status,
            application_status: d.application_status,
            zone_id: d.zone_id ? Number(d.zone_id) : null,
        };
    }
    async updateProfile(req, body) {
        const data = {};
        for (const [k, v] of Object.entries(body))
            if (v !== undefined)
                data[k] = v;
        if (Object.keys(data).length) {
            await this.prisma.delivery_men.update({ where: { id: req.actor.id }, data });
        }
        return { message: 'Profile updated' };
    }
    toggleActive() { return { message: 'updated' }; }
    fcmToken() { return { message: 'token-updated' }; }
    remove() { return { message: 'Not available in demo' }; }
    async allOrders(req) {
        const rows = await this.prisma.orders.findMany({ where: { delivery_man_id: req.actor.id }, orderBy: { id: 'desc' }, take: 50 });
        return rows.map((r) => ({ ...r, id: Number(r.id), user_id: r.user_id ? Number(r.user_id) : null, restaurant_id: Number(r.restaurant_id), order_amount: Number(r.order_amount) }));
    }
    async order(idStr) {
        const id = parseInt(idStr ?? '', 10);
        if (!Number.isFinite(id))
            return null;
        const o = await this.prisma.orders.findUnique({ where: { id: BigInt(id) } });
        return o ? { ...o, id: Number(o.id), user_id: o.user_id ? Number(o.user_id) : null, restaurant_id: Number(o.restaurant_id), order_amount: Number(o.order_amount) } : null;
    }
    acceptOrder() { return { message: 'order accepted' }; }
    updatePayment() { return { message: 'updated' }; }
    sendOtp() { return { otp: '1234' }; }
    recordLocation() { return { ok: true }; }
    lastLocation() { return { ok: true }; }
    earningReport() { return { today: 0, this_week: 0, this_month: 0, all_time: 0 }; }
    disbursementReport() { return { data: [], total: 0 }; }
    walletPayments() { return { data: [], total_size: 0 }; }
    collectedCash() { return { message: 'recorded' }; }
    walletAdjustment() { return { message: 'recorded' }; }
    async withdrawMethods() {
        const rows = await this.prisma.withdrawal_methods.findMany({ where: { is_active: 1 } });
        return rows.map((r) => ({ id: Number(r.id), method_name: r.method_name, method_fields: r.method_fields, is_default: r.is_default }));
    }
    withdrawStore() { return { message: 'method added' }; }
    withdrawDefault() { return { message: 'default set' }; }
    withdrawDelete() { return { message: 'deleted' }; }
    getWithdrawMethods() { return this.withdrawMethods(); }
    async dmShift() {
        const rows = await this.prisma.shifts.findMany({ where: { status: true } });
        return rows.map((r) => ({ id: Number(r.id), name: r.name, start_time: r.start_time, end_time: r.end_time, is_full_day: r.is_full_day }));
    }
    dmTopic(req) {
        return { topic: `zone_${req.actor.id}_delivery_man` };
    }
    submitReview() { return { message: 'review submitted' }; }
    async notifications() {
        const rows = await this.prisma.notifications.findMany({ where: { status: true }, orderBy: { id: 'desc' }, take: 50 });
        return rows.map((r) => ({ id: Number(r.id), title: r.title, description: r.description }));
    }
    messageList() { return { conversations: [], total_size: 0 }; }
    messageDetails() { return { messages: [] }; }
    messageSearch() { return { conversations: [] }; }
    messageSend() { return { message: 'sent' }; }
};
exports.DeliveryExtrasController = DeliveryExtrasController;
__decorate([
    (0, common_1.Get)('profile'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "profile", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-profile'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-active-status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "toggleActive", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-fcm-token'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "fcmToken", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('remove-account'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)('all-orders'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "allOrders", null);
__decorate([
    (0, common_1.Get)('order'),
    __param(0, (0, common_1.Query)('order_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "order", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('accept-order'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "acceptOrder", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-payment-status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "updatePayment", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('send-order-otp'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "sendOtp", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('record-location-data'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "recordLocation", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('last-location'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "lastLocation", null);
__decorate([
    (0, common_1.Get)('earning-report'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "earningReport", null);
__decorate([
    (0, common_1.Get)('get-disbursement-report'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "disbursementReport", null);
__decorate([
    (0, common_1.Get)('wallet-payment-list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "walletPayments", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('make-collected-cash-payment'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "collectedCash", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('make-wallet-adjustment'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "walletAdjustment", null);
__decorate([
    (0, common_1.Get)('withdraw-method/list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "withdrawMethods", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('withdraw-method/store'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "withdrawStore", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('withdraw-method/make-default'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "withdrawDefault", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('withdraw-method/delete'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "withdrawDelete", null);
__decorate([
    (0, common_1.Get)('get-withdraw-method-list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "getWithdrawMethods", null);
__decorate([
    (0, common_1.Get)('dm-shift'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "dmShift", null);
__decorate([
    (0, common_1.Get)('dm-topic'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "dmTopic", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('reviews/submit'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "submitReview", null);
__decorate([
    (0, common_1.Get)('notifications'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "notifications", null);
__decorate([
    (0, common_1.Get)('message/list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "messageList", null);
__decorate([
    (0, common_1.Get)('message/details'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "messageDetails", null);
__decorate([
    (0, common_1.Get)('message/search-list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "messageSearch", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('message/send'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "messageSend", null);
exports.DeliveryExtrasController = DeliveryExtrasController = __decorate([
    (0, common_1.Controller)('delivery-man'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, auth_guard_1.RequireAuth)('deliveryman'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DeliveryExtrasController);
//# sourceMappingURL=delivery-extras.controller.js.map