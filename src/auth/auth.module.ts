import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { MigrationModule } from '../mongo/migration.module';

/** Require JWT_SECRET to be set — refuse to boot with the dev fallback in
 *  production. In development a deterministic fallback is fine so the app
 *  starts without setup, but we log a loud warning. */
function resolveJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET environment variable is missing or too short. Set a strong ' +
      'value (32+ chars, e.g. `openssl rand -hex 32`) before starting in production.',
    );
  }
  // eslint-disable-next-line no-console
  console.warn(
    '[auth] JWT_SECRET not set — using dev fallback. NEVER deploy without setting it.',
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
