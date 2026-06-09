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
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const path = __importStar(require("path"));
const app_module_1 = require("./app.module");
const env_validation_1 = require("./common/env.validation");
const all_exceptions_filter_1 = require("./common/all-exceptions.filter");
const storage_url_1 = require("./common/storage-url");
const mongo_data_service_1 = require("./mongo/mongo-data.service");
BigInt.prototype.toJSON = function () {
    return Number(this);
};
async function bootstrap() {
    (0, env_validation_1.validateEnv)();
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: ['error', 'warn', 'log'],
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
    }));
    app.useGlobalFilters(new all_exceptions_filter_1.AllExceptionsFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['/', 'health', 'storage/(.*)'] });
    const corsOrigins = (process.env.CORS_ORIGINS ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    if (corsOrigins.length > 0) {
        app.enableCors({ origin: corsOrigins, credentials: true });
    }
    else {
        app.enableCors();
    }
    app.use((req, res, next) => {
        const started = Date.now();
        const ip = req.ip ?? req.socket.remoteAddress ?? '?';
        console.log(`→ ${req.method} ${req.originalUrl}  (from ${ip})`);
        res.on('finish', () => {
            const ms = Date.now() - started;
            console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} ${ms}ms`);
        });
        next();
    });
    app.use((req, res, next) => {
        const pick = (v) => (Array.isArray(v) ? v[0] : v);
        const host = pick(req.headers['x-forwarded-host']) || pick(req.headers['host']);
        const proto = (pick(req.headers['x-forwarded-proto']) || req.protocol || 'http').split(',')[0];
        const baseUrl = host ? `${proto}://${host}/storage` : undefined;
        storage_url_1.storageContext.run({ baseUrl }, () => next());
    });
    const fs = require('fs');
    const repoLocalStorage = path.resolve(__dirname, '../storage/app/public');
    const monorepoStorage = path.resolve(__dirname, '../../../storage/app/public');
    let storageRoot = process.env.STORAGE_ROOT;
    if (!storageRoot) {
        storageRoot = fs.existsSync(repoLocalStorage) ? repoLocalStorage : monorepoStorage;
    }
    app.useStaticAssets(storageRoot, { prefix: '/storage/' });
    const mongoData = app.get(mongo_data_service_1.MongoDataService, { strict: false });
    app.use('/storage', async (req, res, next) => {
        if (res.headersSent || req.method !== 'GET')
            return next();
        try {
            const key = decodeURIComponent(req.path.replace(/^\/+/, ''));
            if (!key)
                return next();
            const doc = await mongoData.findOne('uploads', { path: key });
            const raw = doc?.data;
            if (raw) {
                const buf = Buffer.isBuffer(raw) ? raw : raw.buffer ? Buffer.from(raw.buffer) : Buffer.from(raw);
                res
                    .status(200)
                    .set('content-type', doc?.content_type || 'image/png')
                    .set('cache-control', 'public, max-age=86400')
                    .send(buf);
                return;
            }
        }
        catch {
        }
        next();
    });
    app.use('/storage', (req, res, next) => {
        if (res.headersSent)
            return next();
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
    const port = parseInt(process.env.PORT ?? process.env.NODE_PORT ?? '3000', 10);
    await app.listen(port, host);
    console.log(`[stackfood-api] listening on http://${host}:${port}/api/v1`);
    console.log(`[stackfood-api] serving /storage from ${storageRoot}`);
}
bootstrap();
//# sourceMappingURL=main.js.map