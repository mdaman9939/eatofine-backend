import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import * as path from 'path';
import { AppModule } from './app.module';
import { validateEnv } from './common/env.validation';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (this: bigint) {
  return Number(this);
};

async function bootstrap() {
  // Validate env BEFORE Nest tries to wire up modules — a missing JWT_SECRET
  // or bad MONGO_HOSTS should fail loudly with a useful message, not crash
  // halfway through DI with a cryptic stack trace.
  validateEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Global pipes: trim/coerce primitive bodies (only really kicks in once
  // controllers add DTO classes — until then it's a no-op safety net).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Global filter: uniform { errors: [{code, message}] } shape on every error.
  app.useGlobalFilters(new AllExceptionsFilter());
  // Root path `/` and `/health` are excluded so visiting the base URL of
  // the deployed API shows a friendly status message instead of a 404.
  app.setGlobalPrefix('api/v1', { exclude: ['/', 'health', 'storage/(.*)'] });

  // CORS — allow specific origins in production, anything in dev.
  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (corsOrigins.length > 0) {
    app.enableCors({ origin: corsOrigins, credentials: true });
  } else {
    app.enableCors();
  }

  // Request logger: logs on enter AND on finish (so we can see hits even
  // if the handler hangs and `finish` never fires).
  app.use((req: Request, res: Response, next: NextFunction) => {
    const started = Date.now();
    const ip = req.ip ?? req.socket.remoteAddress ?? '?';
    // eslint-disable-next-line no-console
    console.log(`→ ${req.method} ${req.originalUrl}  (from ${ip})`);
    res.on('finish', () => {
      const ms = Date.now() - started;
      // eslint-disable-next-line no-console
      console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} ${ms}ms`);
    });
    next();
  });

  // Serve the project-local storage/app/public/ folder at /storage/*
  // (previously this lived inside the old Laravel project folder).
  const storageRoot =
    process.env.STORAGE_ROOT ??
    path.resolve(__dirname, '../../../storage/app/public');
  app.useStaticAssets(storageRoot, { prefix: '/storage/' });

  const host = process.env.NODE_HOST ?? '0.0.0.0';
  // PORT is auto-injected by Render / Railway / Fly. Fall back to NODE_PORT or 3000.
  const port = parseInt(process.env.PORT ?? process.env.NODE_PORT ?? '3000', 10);
  await app.listen(port, host);
  // eslint-disable-next-line no-console
  console.log(`[stackfood-api] listening on http://${host}:${port}/api/v1`);
  // eslint-disable-next-line no-console
  console.log(`[stackfood-api] serving /storage from ${storageRoot}`);
}
bootstrap();
