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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const mongo_data_service_1 = require("../mongo/mongo-data.service");
let AuthService = class AuthService {
    prisma;
    jwt;
    mongo;
    constructor(prisma, jwt, mongo) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.mongo = mongo;
    }
    useMongo() {
        const v = (process.env.USE_MONGO_AUTH ?? '').toLowerCase();
        return v === '1' || v === 'true' || v === 'yes';
    }
    generateToken() {
        return (0, crypto_1.randomBytes)(90).toString('base64url').slice(0, 120);
    }
    async verifyPassword(plain, hash) {
        if (!hash)
            return false;
        const phpStyle = hash.replace(/^\$2y\$/, '$2b$');
        return bcrypt.compare(plain, phpStyle);
    }
    async customerLoginByEmail(email, password) {
        if (this.useMongo()) {
            const user = await this.mongo.findOne('users', { email });
            if (!user || !(await this.verifyPassword(password, user.password))) {
                throw new common_1.UnauthorizedException({
                    errors: [{ code: 'auth-001', message: 'User_credential_does_not_match' }],
                });
            }
            if (user.status === false || user.status === 0) {
                throw new common_1.UnauthorizedException({
                    errors: [{ code: 'auth-003', message: 'your_account_is_blocked' }],
                });
            }
            const token = this.generateToken();
            await this.mongo.updateOne('users', { mysql_id: user.mysql_id }, { auth_token: token, login_medium: 'manual' });
            return {
                token,
                is_phone_verified: 1,
                is_email_verified: 1,
                is_personal_info: user.f_name ? 1 : 0,
                is_exist_user: null,
                login_type: 'manual',
                email: user.email ?? null,
            };
        }
        const user = await this.prisma.users.findFirst({ where: { email } });
        if (!user || !(await this.verifyPassword(password, user.password))) {
            throw new common_1.UnauthorizedException({
                errors: [{ code: 'auth-001', message: 'User_credential_does_not_match' }],
            });
        }
        if (!user.status) {
            throw new common_1.UnauthorizedException({
                errors: [{ code: 'auth-003', message: 'your_account_is_blocked' }],
            });
        }
        const token = this.generateToken();
        await this.prisma.users.update({ where: { id: user.id }, data: { auth_token: token, login_medium: 'manual' } });
        return {
            token,
            is_phone_verified: 1,
            is_email_verified: 1,
            is_personal_info: user.f_name ? 1 : 0,
            is_exist_user: null,
            login_type: 'manual',
            email: user.email ?? null,
        };
    }
    async customerLoginByPhone(phone, password) {
        if (this.useMongo()) {
            const user = await this.mongo.findOne('users', { phone });
            if (!user || !(await this.verifyPassword(password, user.password))) {
                throw new common_1.UnauthorizedException({
                    errors: [{ code: 'auth-001', message: 'User_credential_does_not_match' }],
                });
            }
            if (user.status === false || user.status === 0) {
                throw new common_1.UnauthorizedException({
                    errors: [{ code: 'auth-003', message: 'your_account_is_blocked' }],
                });
            }
            const token = this.generateToken();
            await this.mongo.updateOne('users', { mysql_id: user.mysql_id }, { auth_token: token, login_medium: 'manual' });
            return {
                token,
                is_phone_verified: 1,
                is_email_verified: 1,
                is_personal_info: user.f_name ? 1 : 0,
                is_exist_user: null,
                login_type: 'manual',
                email: user.email ?? null,
            };
        }
        const user = await this.prisma.users.findFirst({ where: { phone } });
        if (!user || !(await this.verifyPassword(password, user.password))) {
            throw new common_1.UnauthorizedException({
                errors: [{ code: 'auth-001', message: 'User_credential_does_not_match' }],
            });
        }
        if (!user.status) {
            throw new common_1.UnauthorizedException({
                errors: [{ code: 'auth-003', message: 'your_account_is_blocked' }],
            });
        }
        const token = this.generateToken();
        await this.prisma.users.update({ where: { id: user.id }, data: { auth_token: token, login_medium: 'manual' } });
        return {
            token,
            is_phone_verified: 1,
            is_email_verified: 1,
            is_personal_info: user.f_name ? 1 : 0,
            is_exist_user: null,
            login_type: 'manual',
            email: user.email ?? null,
        };
    }
    async customerRegister(input) {
        const passwordHash = (await bcrypt.hash(input.password, 10)).replace(/^\$2b\$/, '$2y$');
        if (this.useMongo()) {
            const existing = await this.mongo.findOne('users', { phone: input.phone });
            if (existing) {
                throw new common_1.UnauthorizedException({
                    errors: [{ code: 'phone', message: 'phone_already_taken' }],
                });
            }
            const token = this.generateToken();
            const nextId = await this.mongo.nextMysqlId('users');
            const now = new Date();
            await this.mongo.insertOne('users', {
                mysql_id: nextId,
                f_name: input.f_name,
                l_name: input.l_name ?? '',
                phone: input.phone,
                email: input.email ?? null,
                password: passwordHash,
                status: true,
                is_phone_verified: true,
                auth_token: token,
                login_medium: 'manual',
                created_at: now,
                updated_at: now,
            });
            return {
                token,
                is_phone_verified: 1,
                is_email_verified: 1,
                is_personal_info: 1,
                is_exist_user: null,
                login_type: 'manual',
                email: input.email ?? null,
            };
        }
        const existing = await this.prisma.users.findFirst({ where: { phone: input.phone } });
        if (existing) {
            throw new common_1.UnauthorizedException({
                errors: [{ code: 'phone', message: 'phone_already_taken' }],
            });
        }
        const token = this.generateToken();
        const user = await this.prisma.users.create({
            data: {
                f_name: input.f_name,
                l_name: input.l_name ?? '',
                phone: input.phone,
                email: input.email,
                password: passwordHash,
                status: true,
                is_phone_verified: true,
                auth_token: token,
                login_medium: 'manual',
            },
        });
        return {
            token,
            is_phone_verified: 1,
            is_email_verified: 1,
            is_personal_info: 1,
            is_exist_user: null,
            login_type: 'manual',
            email: user.email ?? null,
        };
    }
    async vendorLogin(email, password) {
        if (this.useMongo()) {
            const vendor = await this.mongo.findOne('vendors', { email });
            if (!vendor || !(await this.verifyPassword(password, vendor.password))) {
                throw new common_1.UnauthorizedException({
                    errors: [{ code: 'auth-001', message: 'Credential do not match, please try again' }],
                });
            }
            if (vendor.status === false || vendor.status === 0) {
                throw new common_1.UnauthorizedException({
                    errors: [{ code: 'auth-003', message: 'your_account_has_been_suspended' }],
                });
            }
            const token = this.generateToken();
            await this.mongo.updateOne('vendors', { mysql_id: vendor.mysql_id }, { auth_token: token });
            const restaurant = await this.mongo.findOne('restaurants', { mysql_vendor_id: vendor.mysql_id });
            return { token, restaurant_id: restaurant?.mysql_id ?? null, role: 'owner' };
        }
        const vendor = await this.prisma.vendors.findFirst({ where: { email } });
        if (!vendor || !(await this.verifyPassword(password, vendor.password))) {
            throw new common_1.UnauthorizedException({
                errors: [{ code: 'auth-001', message: 'Credential do not match, please try again' }],
            });
        }
        if (!vendor.status) {
            throw new common_1.UnauthorizedException({
                errors: [{ code: 'auth-003', message: 'your_account_has_been_suspended' }],
            });
        }
        const token = this.generateToken();
        await this.prisma.vendors.update({ where: { id: vendor.id }, data: { auth_token: token } });
        const restaurant = await this.prisma.restaurants.findFirst({ where: { vendor_id: vendor.id } });
        return { token, restaurant_id: restaurant?.id ?? null, role: 'owner' };
    }
    async deliveryManLogin(phone, password) {
        if (this.useMongo()) {
            const dm = await this.mongo.findOne('delivery_men', { phone });
            if (!dm || !(await this.verifyPassword(password, dm.password))) {
                throw new common_1.UnauthorizedException({
                    errors: [{ code: 'auth-001', message: 'User credentials does not match.' }],
                });
            }
            if (dm.application_status !== 'approved') {
                throw new common_1.UnauthorizedException({
                    errors: [{ code: 'auth-003', message: 'your_application_is_not_approved_yet' }],
                });
            }
            if (dm.status === false || dm.status === 0) {
                throw new common_1.UnauthorizedException({
                    errors: [{ code: 'auth-003', message: 'your_account_has_been_suspended' }],
                });
            }
            const token = this.generateToken();
            await this.mongo.updateOne('delivery_men', { mysql_id: dm.mysql_id }, { auth_token: token });
            const zoneId = dm.zone_id ?? dm.mysql_zone_id ?? 'unknown';
            const topic = [`zone_${zoneId}_delivery_man`];
            return { token, topic };
        }
        const dm = await this.prisma.delivery_men.findFirst({ where: { phone } });
        if (!dm || !(await this.verifyPassword(password, dm.password))) {
            throw new common_1.UnauthorizedException({
                errors: [{ code: 'auth-001', message: 'User credentials does not match.' }],
            });
        }
        if (dm.application_status !== 'approved') {
            throw new common_1.UnauthorizedException({
                errors: [{ code: 'auth-003', message: 'your_application_is_not_approved_yet' }],
            });
        }
        if (!dm.status) {
            throw new common_1.UnauthorizedException({
                errors: [{ code: 'auth-003', message: 'your_account_has_been_suspended' }],
            });
        }
        const token = this.generateToken();
        await this.prisma.delivery_men.update({ where: { id: dm.id }, data: { auth_token: token } });
        const topic = [`zone_${dm.zone_id ?? 'unknown'}_delivery_man`];
        return { token, topic };
    }
    async createGuest(input) {
        if (this.useMongo()) {
            const nextId = await this.mongo.nextMysqlId('guests');
            const now = new Date();
            await this.mongo.insertOne('guests', {
                mysql_id: nextId,
                ip_address: input.ip_address ?? null,
                fcm_token: input.fcm_token ?? null,
                created_at: now,
                updated_at: now,
            });
            return { guest_id: nextId };
        }
        const created = await this.prisma.guests.create({
            data: {
                ip_address: input.ip_address ?? null,
                fcm_token: input.fcm_token ?? null,
            },
        });
        return { guest_id: Number(created.id) };
    }
    async adminLogin(email, password) {
        let admin = null;
        if (this.useMongo()) {
            const found = await this.mongo.findOne('admins', { email, role_id: 1 });
            admin = found;
        }
        else {
            const found = await this.prisma.admins.findFirst({ where: { email, role_id: 1n } });
            admin = found;
        }
        if (!admin || !(await this.verifyPassword(password, admin.password))) {
            throw new common_1.UnauthorizedException({
                errors: [{ code: 'auth-001', message: 'Credential do not match, please try again' }],
            });
        }
        const adminId = Number(admin.mysql_id ?? admin.id ?? 0);
        const roleId = Number(admin.role_id ?? 1);
        const payload = {
            kind: 'admin',
            id: adminId,
            role_id: roleId,
            email: admin.email,
        };
        const token = await this.jwt.signAsync(payload);
        return {
            token,
            admin: {
                id: adminId,
                f_name: admin.f_name,
                l_name: admin.l_name,
                email: admin.email,
                image: admin.image,
                role_id: roleId,
            },
        };
    }
    async findActorByToken(token) {
        try {
            const payload = await this.jwt.verifyAsync(token);
            if (payload?.kind === 'admin' && typeof payload.id === 'number') {
                return { kind: 'admin', id: BigInt(payload.id) };
            }
        }
        catch {
        }
        if (this.useMongo()) {
            const u = await this.mongo.findOne('users', { auth_token: token });
            if (u)
                return { kind: 'customer', id: BigInt(u.mysql_id) };
            const v = await this.mongo.findOne('vendors', { auth_token: token });
            if (v)
                return { kind: 'vendor', id: BigInt(v.mysql_id) };
            const d = await this.mongo.findOne('delivery_men', { auth_token: token });
            if (d)
                return { kind: 'deliveryman', id: BigInt(d.mysql_id) };
            return null;
        }
        const u = await this.prisma.users.findFirst({ where: { auth_token: token }, select: { id: true } });
        if (u)
            return { kind: 'customer', id: u.id };
        const v = await this.prisma.vendors.findFirst({ where: { auth_token: token }, select: { id: true } });
        if (v)
            return { kind: 'vendor', id: v.id };
        const d = await this.prisma.delivery_men.findFirst({ where: { auth_token: token }, select: { id: true } });
        if (d)
            return { kind: 'deliveryman', id: d.id };
        return null;
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        mongo_data_service_1.MongoDataService])
], AuthService);
//# sourceMappingURL=auth.service.js.map