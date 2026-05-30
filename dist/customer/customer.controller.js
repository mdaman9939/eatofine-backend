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
exports.CustomerController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const auth_service_1 = require("../auth/auth.service");
const customer_service_1 = require("./customer.service");
let CustomerController = class CustomerController {
    customer;
    auth;
    constructor(customer, auth) {
        this.customer = customer;
        this.auth = auth;
    }
    info(req) {
        return this.customer.info(req.actor.id);
    }
    addresses(req) {
        return this.customer.listAddresses(req.actor.id);
    }
    addAddress(req, body) {
        return this.customer.addAddress(req.actor.id, body);
    }
    async cart(req, guestIdStr) {
        const id = await this.resolveCartIdentity(req, guestIdStr);
        return this.customer.getCart(id);
    }
    async cartAdd(req, body, guestIdStr) {
        const id = await this.resolveCartIdentity(req, guestIdStr);
        return this.customer.addToCart(id, body);
    }
    async cartUpdate(req, body, guestIdStr) {
        const id = await this.resolveCartIdentity(req, guestIdStr);
        return this.customer.updateCart(id, body.cart_id ?? 0, body.quantity ?? 1);
    }
    async cartRemoveItem(req, cartId, guestIdStr) {
        const id = await this.resolveCartIdentity(req, guestIdStr);
        return this.customer.removeCartItem(id, cartId);
    }
    async cartClear(req, guestIdStr) {
        const id = await this.resolveCartIdentity(req, guestIdStr);
        return this.customer.clearCart(id);
    }
    async resolveCartIdentity(req, guestIdStr) {
        const header = req.header('authorization') ?? '';
        const token = header.replace(/^Bearer\s+/i, '').trim();
        if (token) {
            const actor = await this.auth.findActorByToken(token);
            if (actor?.kind === 'customer') {
                req.actor = actor;
                return { id: actor.id, guest: false };
            }
        }
        const gid = parseInt(guestIdStr ?? '', 10);
        if (Number.isFinite(gid) && gid > 0) {
            return { id: BigInt(gid), guest: true };
        }
        throw new common_1.UnauthorizedException({
            errors: [{ code: 'auth-001', message: 'either Bearer token or guest_id query required' }],
        });
    }
};
exports.CustomerController = CustomerController;
__decorate([
    (0, common_1.Get)('info'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CustomerController.prototype, "info", null);
__decorate([
    (0, common_1.Get)('address/list'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CustomerController.prototype, "addresses", null);
__decorate([
    (0, common_1.Post)('address/add'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CustomerController.prototype, "addAddress", null);
__decorate([
    (0, common_1.Get)('cart/list'),
    (0, auth_guard_1.RequireAuth)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('guest_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CustomerController.prototype, "cart", null);
__decorate([
    (0, common_1.Post)('cart/add'),
    (0, common_1.HttpCode)(200),
    (0, auth_guard_1.RequireAuth)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('guest_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], CustomerController.prototype, "cartAdd", null);
__decorate([
    (0, common_1.Post)('cart/update'),
    (0, common_1.HttpCode)(200),
    (0, auth_guard_1.RequireAuth)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('guest_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], CustomerController.prototype, "cartUpdate", null);
__decorate([
    (0, common_1.Delete)('cart/remove-item'),
    (0, common_1.HttpCode)(200),
    (0, auth_guard_1.RequireAuth)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('cart_id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Query)('guest_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, String]),
    __metadata("design:returntype", Promise)
], CustomerController.prototype, "cartRemoveItem", null);
__decorate([
    (0, common_1.Delete)('cart/remove'),
    (0, common_1.HttpCode)(200),
    (0, auth_guard_1.RequireAuth)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('guest_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CustomerController.prototype, "cartClear", null);
exports.CustomerController = CustomerController = __decorate([
    (0, common_1.Controller)('customer'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, auth_guard_1.RequireAuth)('customer'),
    __metadata("design:paramtypes", [customer_service_1.CustomerService,
        auth_service_1.AuthService])
], CustomerController);
//# sourceMappingURL=customer.controller.js.map