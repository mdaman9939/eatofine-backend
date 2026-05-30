import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from './auth.service';

type ActorKind = 'customer' | 'vendor' | 'deliveryman' | 'admin';

export const REQUIRE_AUTH = 'requireAuth';
export const RequireAuth = (...kinds: ActorKind[]) => SetMetadata(REQUIRE_AUTH, kinds);

export interface AuthedRequest extends Request {
  actor?: { kind: ActorKind; id: bigint };
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<ActorKind[] | undefined>(REQUIRE_AUTH, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.header('authorization') ?? '';
    const token = header.replace(/^Bearer\s+/i, '').trim();
    if (!token) throw new UnauthorizedException({ errors: [{ code: 'auth-001', message: 'Unauthenticated.' }] });

    const actor = await this.auth.findActorByToken(token);
    if (!actor || !required.includes(actor.kind)) {
      throw new UnauthorizedException({ errors: [{ code: 'auth-001', message: 'Unauthenticated.' }] });
    }
    req.actor = actor;
    return true;
  }
}
