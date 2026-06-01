import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { MigrationModule } from '../mongo/migration.module';

/** Resolve the JWT signing secret. Returns the env value when present and
 *  long enough; otherwise warns loudly and falls back to a dev secret.
 *
 *  We don't throw in production by default anymore — that crashed Render on
 *  every cold start before JWT_SECRET was set. The fallback is insecure
 *  (tokens are forge-able), but the app boots so the operator can fix it.
 *
 *  Set STRICT_ENV_CHECK=1 to restore the old throw-in-prod behavior. */
function resolveJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 16) return fromEnv;

  const isProd = process.env.NODE_ENV === 'production';
  const strict = process.env.STRICT_ENV_CHECK === '1';
  if (strict && isProd) {
    throw new Error(
      'JWT_SECRET is missing or too short. Set a strong value (32+ chars). ' +
      'STRICT_ENV_CHECK=1 is enabled — unset it to allow boot with a dev fallback.',
    );
  }

  // eslint-disable-next-line no-console
  console.warn(
    isProd
      ? '\n⚠️  [auth] JWT_SECRET MISSING IN PRODUCTION — using dev fallback. ' +
        'Tokens are forge-able. Set JWT_SECRET in Render dashboard and redeploy.\n'
      : '[auth] JWT_SECRET not set — using dev fallback (development).',
  );
  return 'stackfood-admin-dev-secret-change-me';
}

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: resolveJwtSecret(),
      signOptions: { expiresIn: '12h' },
    }),
    MigrationModule, // exports MongoDataService so AuthService can inject it
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
