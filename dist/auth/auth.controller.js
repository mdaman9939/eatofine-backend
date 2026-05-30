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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
let AuthController = class AuthController {
    auth;
    constructor(auth) {
        this.auth = auth;
    }
    async customerLogin(body) {
        if (body.login_type !== 'manual') {
            throw new common_1.BadRequestException({
                errors: [{ code: 'login_type', message: 'Only manual login supported in this demo.' }],
            });
        }
        if (!body.email_or_phone || !body.password) {
            throw new common_1.BadRequestException({
                errors: [{ code: 'email_or_phone', message: 'email_or_phone and password required' }],
            });
        }
        if (body.field_type === 'email') {
            return this.auth.customerLoginByEmail(body.email_or_phone, body.password);
        }
        return this.auth.customerLoginByPhone(body.email_or_phone, body.password);
    }
    async customerRegister(body) {
        if (!body.phone || !body.password || !body.f_name) {
            throw new common_1.BadRequestException({
                errors: [{ code: 'phone', message: 'f_name, phone, and password are required' }],
            });
        }
        return this.auth.customerRegister({
            f_name: body.f_name,
            l_name: body.l_name,
            phone: body.phone,
            email: body.email,
            password: body.password,
        });
    }
    async vendorLogin(body) {
        if (!body.email || !body.password) {
            throw new common_1.BadRequestException({
                errors: [{ code: 'email', message: 'email and password required' }],
            });
        }
        return this.auth.vendorLogin(body.email, body.password);
    }
    async deliveryManLogin(body) {
        if (!body.phone || !body.password) {
            throw new common_1.BadRequestException({
                errors: [{ code: 'phone', message: 'phone and password required' }],
            });
        }
        return this.auth.deliveryManLogin(body.phone, body.password);
    }
    async guestRequest(body) {
        return this.auth.createGuest({ fcm_token: body?.fcm_token });
    }
    async adminLogin(body) {
        if (!body.email || !body.password) {
            throw new common_1.BadRequestException({
                errors: [{ code: 'email', message: 'email and password required' }],
            });
        }
        return this.auth.adminLogin(body.email, body.password);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "customerLogin", null);
__decorate([
    (0, common_1.Post)('sign-up'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "customerRegister", null);
__decorate([
    (0, common_1.Post)('vendor/login'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "vendorLogin", null);
__decorate([
    (0, common_1.Post)('delivery-man/login'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "deliveryManLogin", null);
__decorate([
    (0, common_1.Post)('guest/request'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "guestRequest", null);
__decorate([
    (0, common_1.Post)('admin/login'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "adminLogin", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map