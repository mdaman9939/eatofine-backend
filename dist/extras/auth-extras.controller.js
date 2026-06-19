"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthExtrasController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const prisma_service_1 = require("../prisma/prisma.service");
const mongo_data_service_1 = require("../mongo/mongo-data.service");
const business_settings_service_1 = require("../business-settings/business-settings.service");
const image_compress_1 = require("../common/image-compress");
let AuthExtrasController = class AuthExtrasController {
    prisma;
    mongo;
    bs;
    constructor(prisma, mongo, bs) {
        this.prisma = prisma;
        this.mongo = mongo;
        this.bs = bs;
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
    async vendorRegister(body = {}, files = []) {
        const registrationOn = await this.bs.getBoolDefault('toggle_restaurant_registration', true);
        if (!registrationOn) {
            throw new common_1.BadRequestException({ errors: [{ code: 'registration', message: 'Restaurant registration is currently disabled' }] });
        }
        if (!this.useMongo()) {
            throw new common_1.BadRequestException({ errors: [{ code: 'config', message: 'Restaurant registration requires Mongo' }] });
        }
        const b = body ?? {};
        const str = (k) => (b[k] !== undefined && b[k] !== null ? String(b[k]).trim() : '');
        const fName = str('fName') || str('f_name');
        const lName = str('lName') || str('l_name');
        const phone = str('phone');
        const email = str('email');
        const password = str('password');
        let translations = [];
        if (b.translations) {
            try {
                translations = JSON.parse(String(b.translations)) ?? [];
            }
            catch {
                translations = [];
            }
        }
        const pick = (key) => translations.find((t) => (t?.locale === 'en' || t?.locale === 'default') && t?.key === key)?.value
            ?? translations.find((t) => t?.key === key)?.value;
        const name = pick('name') || str('restaurant_name') || str('name');
        const address = pick('address') || str('restaurant_address') || str('address');
        if (!name)
            throw new common_1.BadRequestException({ errors: [{ code: 'name', message: 'Restaurant name is required' }] });
        if (!fName)
            throw new common_1.BadRequestException({ errors: [{ code: 'f_name', message: 'First name is required' }] });
        if (!phone)
            throw new common_1.BadRequestException({ errors: [{ code: 'phone', message: 'Phone number is required' }] });
        if (!email)
            throw new common_1.BadRequestException({ errors: [{ code: 'email', message: 'Email is required' }] });
        if (!password || password.length < 8) {
            throw new common_1.BadRequestException({ errors: [{ code: 'password', message: 'Password must be at least 8 characters' }] });
        }
        if (await this.mongo.findOne('vendors', { email })) {
            throw new common_1.BadRequestException({ errors: [{ code: 'email', message: 'This email is already registered' }] });
        }
        if (await this.mongo.findOne('vendors', { phone })) {
            throw new common_1.BadRequestException({ errors: [{ code: 'phone', message: 'This phone number is already registered' }] });
        }
        const now = new Date();
        const bcrypt = await import('bcrypt');
        const passwordHash = (await bcrypt.hash(password, 10)).replace(/^\$2b\$/, '$2y$');
        const vendorId = await this.mongo.nextMysqlId('vendors');
        await this.mongo.insertOne('vendors', {
            mysql_id: vendorId,
            f_name: fName, l_name: lName,
            email, phone, password: passwordHash, image: null,
            status: true, created_at: now, updated_at: now,
        });
        let cuisineIds = [];
        if (b.cuisine_ids) {
            try {
                const arr = JSON.parse(String(b.cuisine_ids));
                if (Array.isArray(arr))
                    cuisineIds = arr.map(Number).filter(Number.isFinite);
            }
            catch {
                cuisineIds = String(b.cuisine_ids).split(',').map((s) => Number(s.trim())).filter(Number.isFinite);
            }
        }
        const minT = str('min_delivery_time');
        const maxT = str('max_delivery_time');
        const unit = str('delivery_time_type') || 'minute';
        const deliveryTime = minT && maxT ? `${minT}-${maxT}-${unit}` : null;
        const fileByField = (field) => files.find((f) => f.fieldname === field);
        const logoName = await this.saveUploaded(fileByField('logo'), 'restaurant');
        const coverName = await this.saveUploaded(fileByField('cover_photo'), 'restaurant/cover');
        const tinCert = await this.saveUploaded(fileByField('tin_certificate_image'), 'restaurant');
        const knownFields = new Set(['logo', 'cover_photo', 'tin_certificate_image']);
        const additionalDocs = [];
        for (const f of files) {
            if (knownFields.has(f.fieldname))
                continue;
            const saved = await this.saveUploaded(f, 'restaurant/documents');
            if (saved)
                additionalDocs.push({ key: f.fieldname, file: saved });
        }
        let additionalData = {};
        if (b.additional_data) {
            try {
                additionalData = JSON.parse(String(b.additional_data)) ?? {};
            }
            catch {
                additionalData = {};
            }
        }
        const commission = await this.bs.getNumber('admin_commission', 0);
        const plan = str('business_plan') === 'subscription' ? 'subscription' : 'commission';
        const packageIdRaw = str('package_id');
        const packageId = plan === 'subscription' && packageIdRaw && Number.isFinite(Number(packageIdRaw))
            ? Number(packageIdRaw) : null;
        const zoneId = Number(str('zone_id')) || 1;
        const restaurantId = await this.mongo.nextMysqlId('restaurants');
        await this.mongo.insertOne('restaurants', {
            mysql_id: restaurantId,
            name,
            translations,
            address,
            email,
            phone,
            latitude: str('lat') || null,
            longitude: str('lng') || null,
            zone_id: zoneId,
            mysql_zone_id: zoneId,
            mysql_vendor_id: vendorId,
            cuisine_ids: cuisineIds,
            delivery_time: deliveryTime,
            minimum_order: 0,
            tax: 0,
            comission: commission,
            restaurant_model: plan,
            subscription_id: packageId,
            additional_data: additionalData,
            additional_documents: additionalDocs.map((d) => d.file),
            restaurant_documents: additionalDocs,
            tax_registration_number: str('tin') || null,
            tax_registration_expire_date: str('tin_expire_date') || null,
            tin_certificate_image: tinCert,
            logo: logoName,
            cover_photo: coverName,
            delivery: true,
            take_away: true,
            veg: true,
            non_veg: true,
            status: false,
            active: false,
            approval_status: 'pending',
            created_at: now,
            updated_at: now,
        });
        return {
            restaurant_id: restaurantId,
            package_id: packageId,
            message: 'Restaurant registration submitted. An admin will review and approve your restaurant shortly.',
        };
    }
    storageDir(folder) {
        const root = process.env.STORAGE_ROOT ?? path.resolve(__dirname, '../../storage/app/public');
        const dir = path.join(root, folder);
        fs.mkdirSync(dir, { recursive: true });
        return dir;
    }
    async saveUploaded(file, folder) {
        if (!file || !file.buffer || file.buffer.length === 0)
            return null;
        let data = file.buffer;
        let ext = path.extname(file.originalname || '').toLowerCase() || '.png';
        let contentType = file.mimetype || 'image/png';
        if (/^image\//i.test(contentType) && !/svg/i.test(contentType)) {
            const compressed = await (0, image_compress_1.compressImage)(file.buffer);
            if (compressed) {
                data = compressed.buffer;
                ext = compressed.ext;
                contentType = compressed.contentType;
            }
        }
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        try {
            fs.writeFileSync(path.join(this.storageDir(folder), filename), data);
        }
        catch { }
        if (this.useMongo() && data.length < 15 * 1024 * 1024) {
            this.mongo.insertOne('uploads', {
                path: `${folder}/${filename}`,
                content_type: contentType,
                data,
                size: data.length,
                created_at: new Date(),
            }).catch(() => undefined);
        }
        return filename;
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
    (0, common_1.UseInterceptors)((0, platform_express_1.AnyFilesInterceptor)({ limits: { fileSize: 10 * 1024 * 1024 } })),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Array]),
    __metadata("design:returntype", Promise)
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
        mongo_data_service_1.MongoDataService,
        business_settings_service_1.BusinessSettingsService])
], AuthExtrasController);
//# sourceMappingURL=auth-extras.controller.js.map