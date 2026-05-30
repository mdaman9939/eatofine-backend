import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from './auth.service';
type ActorKind = 'customer' | 'vendor' | 'deliveryman' | 'admin';
export declare const REQUIRE_AUTH = "requireAuth";
export declare const RequireAuth: (...kinds: ActorKind[]) => import("@nestjs/common").CustomDecorator<string>;
export interface AuthedRequest extends Request {
    actor?: {
        kind: ActorKind;
        id: bigint;
    };
}
export declare class AuthGuard implements CanActivate {
    private readonly reflector;
    private readonly auth;
    constructor(reflector: Reflector, auth: AuthService);
    canActivate(ctx: ExecutionContext): Promise<boolean>;
}
export {};
