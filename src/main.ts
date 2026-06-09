import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { json, urlencoded } from 'express';
import * as path from 'path';
import { AppModule } from './app.module';
import { validateEnv } from './common/env.validation';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { storageContext } from './common/storage-url';
import { MongoDataService } from './mongo/mongo-data.service';

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
    // Disable the default body parser (100 kb limit) so we can register our own
    // with a generous limit — base64 image uploads (admin banner/logo etc.)
    // otherwise fail with "request entity too large" (HTTP 413).
    bodyParser: false,
  });

  // Body parsers with a 25 MB ceiling. Multipart file uploads still go through
  // multer (FileInterceptor); these cover JSON/urlencoded payloads, including
  // base64-encoded images sent by the admin panel.
  app.use(json({ limit: '25mb' }));
  app.use(urlencoded({ extended: true, limit: '25mb' }));

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

  // Capture the request's public origin so every image URL we return points at
  // the SAME host the client used to reach us (works behind Render's proxy via
  // x-forwarded-* headers). This makes uploaded images load without anyone
  // having to set STORAGE_BASE_URL correctly.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const pick = (v: unknown) => (Array.isArray(v) ? v[0] : v) as string | undefined;
    const host = pick(req.headers['x-forwarded-host']) || pick(req.headers['host']);
    const proto = (pick(req.headers['x-forwarded-proto']) || req.protocol || 'http').split(',')[0];
    const baseUrl = host ? `${proto}://${host}/storage` : undefined;
    storageContext.run({ baseUrl }, () => next());
  });

  // Serve uploaded images at /storage/*.
  //
  // Resolution order:
  //   1. STORAGE_ROOT env var (explicit deployment override).
  //   2. Repo-local `<api>/storage/app/public/` — preferred for cloud
  //      deploys (Render, Railway) because everything ships in one git
  //      tree and 166 demo image files just work after `git push`.
  //   3. Legacy project-root `../../storage/app/public/` for local
  //      monorepo dev where the Laravel-style storage folder is still
  //      shared between PHP and Node sides.
  //
  // First path that actually exists on disk wins; otherwise we fall back
  // to (3) so the dev workflow keeps working.
  const fs = require('fs');
  const repoLocalStorage = path.resolve(__dirname, '../storage/app/public');
  const monorepoStorage = path.resolve(__dirname, '../../../storage/app/public');
  let storageRoot = process.env.STORAGE_ROOT;
  if (!storageRoot) {
    storageRoot = fs.existsSync(repoLocalStorage) ? repoLocalStorage : monorepoStorage;
  }
  app.useStaticAssets(storageRoot, { prefix: '/storage/' });

  // Durable image fallback — when a file isn't on the (ephemeral) disk, try the
  // Mongo `uploads` collection. saveUploaded() writes every upload there too,
  // so images survive Render redeploys without S3 / a persistent disk.
  const mongoData = app.get(MongoDataService, { strict: false });
  app.use('/storage', async (req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent || req.method !== 'GET') return next();
    try {
      const key = decodeURIComponent(req.path.replace(/^\/+/, ''));
      if (!key) return next();
      const doc = await mongoData.findOne<{ data?: unknown; content_type?: string }>('uploads', { path: key });
      const raw = doc?.data as { buffer?: Buffer } | Buffer | undefined;
      if (raw) {
        const buf = Buffer.isBuffer(raw) ? raw : raw.buffer ? Buffer.from(raw.buffer) : Buffer.from(raw as ArrayBuffer);
        res
          .status(200)
          .set('content-type', doc?.content_type || 'image/png')
          .set('cache-control', 'public, max-age=86400')
          .send(buf);
        return;
      }
    } catch {
      // fall through to the SVG placeholder
    }
    next();
  });

  // Placeholder fallback for /storage/* — when a real file isn't on disk
  // (Render's ephemeral disk loses uploads on every restart, and a lot of
  // legacy DB rows reference filenames that were never migrated), serve
  // an inline SVG so Flutter's NetworkImage doesn't crash with a 404 and
  // the UI shows a sensible placeholder instead of a broken-image icon.
  //
  // Two flavours:
  //   • profile/* and conversation/* → generic avatar
  //   • everything else (restaurant, food, category, banner, etc.) → generic image
  app.use('/storage', (req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next();
    const isAvatar = /^\/(profile|conversation|delivery-man|vendor|users?)\//i.test(req.path);
    const svg = isAvatar
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
           <rect width="200" height="200" fill="#10b981"/>
           <circle cx="100" cy="78" r="32" fill="#fff"/>
           <path d="M40 180c0-33 27-60 60-60s60 27 60 60v20H40z" fill="#fff"/>
         </svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
           <rect width="400" height="300" fill="#f3f4f6"/>
           <path d="M150 110l40 40 30-30 60 60H120z" fill="#9ca3af"/>
           <circle cx="170" cy="100" r="14" fill="#9ca3af"/>
           <text x="200" y="240" text-anchor="middle" font-family="system-ui, sans-serif"
                 font-size="14" fill="#6b7280">No image</text>
         </svg>`;
    res
      .status(200)
      .set('content-type', 'image/svg+xml')
      .set('cache-control', 'public, max-age=86400')
      .send(svg.replace(/\s+/g, ' ').trim());
  });

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
