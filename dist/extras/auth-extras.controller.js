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
exports.AuthExtrasController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const mongo_data_service_1 = require("../mongo/mongo-data.service");
let AuthExtrasController = class AuthExtrasController {
    prisma;
    mongo;
    constructor(prisma, mongo) {
        this.prisma = prisma;
        this.mongo = mongo;
    }
    useMongo() {
        const v = (process.env.USE_MONGO_EXTRAS ?? '1').toLowerCase();
        return v === '1' || v === 'true' || v === 'yes';
    }
    identifier(body) {
        const v = body.phone ?? body.email ?? body.identity ?? body.email_or_phone ?? body.contact;
        return v !== undefined && v !== null && String(v).trim() !== '' ? String(v).trim() : null;
    }
    async findAccount(collection, ident) {
        return this.mongo.findOne(collection, { $or: [{ phone: ident }, { email: ident }] });
    }
    async requestOtp(collection, body) {
        const ident = this.identifier(body);
        if (!ident)
            return { errors: [{ code: 'identity', message: 'Phone or email is required' }] };
        if (!this.useMongo())
            return { message: 'OTP sent (demo)' };
        const account = await this.findAccount(collection, ident);
        if (!account)
            return { errors: [{ code: 'account', message: 'No account found with that phone/email' }] };
        const otp = String(Math.floor(1000 + Math.random() * 9000));
        const now = new Date();
        await this.mongo.deleteMany('password_resets', { collection, identifier: ident });
        await this.mongo.insertOne('password_resets', {
            collection, identifier: ident, mysql_id: account.mysql_id, otp,
            expires_at: new Date(now.getTime() + 10 * 60 * 1000), created_at: now,
        });
        console.log(`[OTP] ${collection} ${ident} -> ${otp}`);
        return { message: 'OTP sent', demo_otp: otp };
    }
    async verifyOtp(collection, body) {
        const ident = this.identifier(body);
        const otp = body.otp ?? body.token ?? body.reset_token;
        if (!ident || otp === undefined)
            return { errors: [{ code: 'input', message: 'identity and otp required' }] };
        if (!this.useMongo())
            return { message: 'token verified' };
        const row = await this.mongo.findOne('password_resets', { collection, identifier: ident });
        if (!row || String(row.otp) !== String(otp))
            return { errors: [{ code: 'otp', message: 'Invalid OTP' }] };
        if (new Date(row.expires_at) < new Date())
            return { errors: [{ code: 'otp', message: 'OTP expired' }] };
        return { message: 'token verified' };
    }
    async resetPassword(collection, body) {
        const ident = this.identifier(body);
        const otp = body.otp ?? body.token ?? body.reset_token;
        const password = body.password ?? body.new_password;
        if (!ident || otp === undefined || !password)
            return { errors: [{ code: 'input', message: 'identity, otp and password required' }] };
        if (body.confirm_password !== undefined && String(body.confirm_password) !== String(password)) {
            return { errors: [{ code: 'confirm_password', message: 'Passwords do not match' }] };
        }
        if (!this.useMongo())
            return { message: 'Password reset (demo)' };
        const row = await this.mongo.findOne('password_resets', { collection, identifier: ident });
        if (!row || String(row.otp) !== String(otp))
            return { errors: [{ code: 'otp', message: 'Invalid OTP' }] };
        if (new Date(row.expires_at) < new Date())
            return { errors: [{ code: 'otp', message: 'OTP expired' }] };
        const bcrypt = await import('bcrypt');
        const hash = (await bcrypt.hash(String(password), 10)).replace(/^\$2b\$/, '$2y$');
        await this.mongo.updateOne(collection, { mysql_id: row.mysql_id }, { password: hash, updated_at: new Date() });
        await this.mongo.deleteMany('password_resets', { collection, identifier: ident });
        return { message: 'Password reset successfully' };
    }
    forgot(body = {}) { return this.requestOtp('users', body); }
    reset(body = {}) { return this.resetPassword('users', body); }
    verifyToken(body = {}) { return this.verifyOtp('users', body); }
    verifyEmail() { return { message: 'email verified' }; }
    verifyPhone() { return { message: 'phone verified' }; }
    checkEmail() { return { message: 'available' }; }
    updateInfo() { return { message: 'info updated' }; }
    firebaseVerify() { return { message: 'verified' }; }
    firebaseReset() { return { message: 'password reset (demo)' }; }
    vendorForgot(body = {}) { return this.requestOtp('vendors', body); }
    vendorReset(body = {}) { return this.resetPassword('vendors', body); }
    vendorVerifyToken(body = {}) { return this.verifyOtp('vendors', body); }
    vendorRegister(_body) {
        return { message: 'Vendor registration is disabled in this demo' };
    }
    packageRenew() { return { message: 'not available' }; }
    subscriptionPayment() { return { redirect_url: null }; }
    dmForgot(body = {}) { return this.requestOtp('delivery_men', body); }
    dmReset(body = {}) { return this.resetPassword('delivery_men', body); }
    dmVerifyToken(body = {}) { return this.verifyOtp('delivery_men', body); }
    dmFirebaseVerify() { return { message: 'verified' }; }
    dmCheckPassword() { return { message: 'ok' }; }
    dmBiometric() { return { message: 'Biometric login not enabled in demo' }; }
    dmEnableBio() { return { message: 'enabled' }; }
    dmDisableBio() { return { message: 'disabled' }; }
    dmStore() { return { message: 'DM created (demo)' }; }
};
exports.AuthExtrasController = AuthExtrasController;
__decorate([
    (0, common_1.Post)('forgot-password'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthExtrasController.prototype, "forgot", null);
__decorate([
    (0, common_1.Post)('reset-password'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthExtrasController.prototype, "reset", null);
__decorate([
    (0, common_1.Post)('verify-token'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthExtrasController.prototype, "verifyToken", null);
__decorate([
    (0, common_1.Post)('verify-email'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthExtrasController.prototype, "verifyEmail", null);
__decorate([
    (0, common_1.Post)('verify-phone'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthExtrasController.prototype, "verifyPhone", null);
__decorate([
    (0, common_1.Post)('check-email'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthExtrasController.prototype, "checkEmail", null);
__decorate([
    (0, common_1.Post)('update-info'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthExtrasController.prototype, "updateInfo", null);
__decorate([
    (0, common_1.Post)('firebase-verify-token'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthExtrasController.prototype, "firebaseVerify", null);
__decorate([
    (0, common_1.Post)('firebase-reset-password'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthExtrasController.prototype, "firebaseReset", null);
__decorate([
    (0, common_1.Post)('vendor/forgot-password'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthExtrasController.prototype, "vendorForgot", null);
__decorate([
    (0, common_1.Post)('vendor/reset-password'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthExtrasController.prototype, "vendorReset", null);
__decorate([
    (0, common_1.Post)('vendor/verify-token'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthExtrasController.prototype, "vendorVerifyToken", null);
__decorate([
    (0, common_1.Post)('vendor/register'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthExtrasController.prototype, "vendorRegister", null);
__decorate([
    (0, common_1.Post)('vendor/package-renew'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthExtrasController.prototype, "packageRenew", null);
__decorate([
    (0, common_1.Post)('vendor/subscription/payment/api'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthExtrasController.prototype, "subscriptionPayment", null);
__decorate([
    (0, common_1.Post)('delivery-man/forgot-password'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthExtrasController.prototype, "dmForgot", null);
__decorate([
    (0, common_1.Post)('delivery-man/reset-password'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthExtrasController.prototype, "dmReset", null);
__decorate([
    (0, common_1.Post)('delivery-man/verify-token'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthExtrasController.prototype, "dmVerifyToken", null);
__decorate([
    (0, common_1.Post)('delivery-man/firebase-verify-token'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthExtrasController.prototype, "dmFirebaseVerify", null);
__decorate([
    (0, common_1.Post)('delivery-man/check-password'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthExtrasController.prototype, "dmCheckPassword", null);
__decorate([
    (0, common_1.Post)('delivery-man/biometric-login'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthExtrasController.prototype, "dmBiometric", null);
__decorate([
    (0, common_1.Post)('delivery-man/enable-biometric'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthExtrasController.prototype, "dmEnableBio", null);
__decorate([
    (0, common_1.Post)('delivery-man/disable-biometric'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthExtrasController.prototype, "dmDisableBio", null);
__decorate([
    (0, common_1.Post)('delivery-man/store'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthExtrasController.prototype, "dmStore", null);
exports.AuthExtrasController = AuthExtrasController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        mongo_data_service_1.MongoDataService])
], AuthExtrasController);
//# sourceMappingURL=auth-extras.controller.js.map