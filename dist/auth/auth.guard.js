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
exports.AuthGuard = exports.RequireAuth = exports.REQUIRE_AUTH = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const auth_service_1 = require("./auth.service");
exports.REQUIRE_AUTH = 'requireAuth';
const RequireAuth = (...kinds) => (0, common_1.SetMetadata)(exports.REQUIRE_AUTH, kinds);
exports.RequireAuth = RequireAuth;
let AuthGuard = class AuthGuard {
    reflector;
    auth;
    constructor(reflector, auth) {
        this.reflector = reflector;
        this.auth = auth;
    }
    async canActivate(ctx) {
        const required = this.reflector.getAllAndOverride(exports.REQUIRE_AUTH, [
            ctx.getHandler(),
            ctx.getClass(),
        ]);
        if (!required || required.length === 0)
            return true;
        const req = ctx.switchToHttp().getRequest();
        const header = req.header('authorization') ?? '';
        const token = header.replace(/^Bearer\s+/i, '').trim();
        if (!token)
            throw new common_1.UnauthorizedException({ errors: [{ code: 'auth-001', message: 'Unauthenticated.' }] });
        const actor = await this.auth.findActorByToken(token);
        if (!actor || !required.includes(actor.kind)) {
            throw new common_1.UnauthorizedException({ errors: [{ code: 'auth-001', message: 'Unauthenticated.' }] });
        }
        req.actor = actor;
        return true;
    }
};
exports.AuthGuard = AuthGuard;
exports.AuthGuard = AuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        auth_service_1.AuthService])
], AuthGuard);
//# sourceMappingURL=auth.guard.js.map