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
    const storageRoot = process.env.STORAGE_ROOT ??
        path.resolve(__dirname, '../../../storage/app/public');
    app.useStaticAssets(storageRoot, { prefix: '/storage/' });
    const host = process.env.NODE_HOST ?? '0.0.0.0';
    const port = parseInt(process.env.PORT ?? process.env.NODE_PORT ?? '3000', 10);
    await app.listen(port, host);
    console.log(`[stackfood-api] listening on http://${host}:${port}/api/v1`);
    console.log(`[stackfood-api] serving /storage from ${storageRoot}`);
}
bootstrap();
//# sourceMappingURL=main.js.map