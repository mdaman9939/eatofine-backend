"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const auth_service_1 = require("./auth.service");
const auth_controller_1 = require("./auth.controller");
const auth_guard_1 = require("./auth.guard");
const migration_module_1 = require("../mongo/migration.module");
function resolveJwtSecret() {
    const fromEnv = process.env.JWT_SECRET?.trim();
    if (fromEnv && fromEnv.length >= 16)
        return fromEnv;
    const isProd = process.env.NODE_ENV === 'production';
    const strict = process.env.STRICT_ENV_CHECK === '1';
    if (strict && isProd) {
        throw new Error('JWT_SECRET is missing or too short. Set a strong value (32+ chars). ' +
            'STRICT_ENV_CHECK=1 is enabled — unset it to allow boot with a dev fallback.');
    }
    console.warn(isProd
        ? '\n⚠️  [auth] JWT_SECRET MISSING IN PRODUCTION — using dev fallback. ' +
            'Tokens are forge-able. Set JWT_SECRET in Render dashboard and redeploy.\n'
        : '[auth] JWT_SECRET not set — using dev fallback (development).');
    return 'stackfood-admin-dev-secret-change-me';
}
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [
            jwt_1.JwtModule.register({
                secret: resolveJwtSecret(),
                signOptions: { expiresIn: '12h' },
            }),
            migration_module_1.MigrationModule,
        ],
        controllers: [auth_controller_1.AuthController],
        providers: [auth_service_1.AuthService, auth_guard_1.AuthGuard],
        exports: [auth_service_1.AuthService, auth_guard_1.AuthGuard],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map